// ============================================================================
// preparador.js — Bucle Outbound B2B (Investigador de Prospectos)
//   Fase 1: scrapeMaps() por nicho (oversample + filtro rapido cadenas)
//   Fase 1.5: qualifyLead() — auditoria web, hard skip bajo umbral
//   Fase 2: enrichFromSocial()   -> fallback FB/IG (perfil "cuy")
//   Fase 2b: enrichBrandAssets() -> logo + colores de marca
//   Fase 3: evaluateWithGemini() -> copy + secciones + Maqueta URL
//   Fase 4: createLead()         -> Notion
// ============================================================================

import fs from "node:fs";
import path from "node:path";
import pLimit from "p-limit";
import { config, assertConfig } from "./lib/config.js";
import { scrapeMaps, enrichInstagramGallery, enrichBrandAssets } from "./lib/scraper.js";
import { buildBrandKit, finalizeBrandKit } from "./lib/brandKit.js";
import {
  qualifyLead,
  appendSkipped,
  opportunityToNotionScore,
  resetQualifyState,
} from "./lib/qualify.js";
import { evaluateWithGemini, resetEvaluateState } from "./lib/gemini.js";
import { normalizePhonePE } from "./lib/phone.js";
import { buildMaquetaUrl, buildWaLink } from "./lib/urls.js";
import { getSchema, getDatabaseTitle, isDuplicate, createLead, missingRecommended } from "./lib/notion.js";
import {
  cargarRegistro,
  guardarEnRegistro,
  memoriaDisponible,
  vaciarRegistro,
  normName,
} from "./lib/memoria.js";
import { planBusquedas, describePlan } from "./lib/rotacion.js";

const DRY_RUN = process.argv.includes("--dry-run");
const RESET_MEMORIA = process.argv.includes("--reset-memoria");
const DATA_DIR = path.resolve("data");

function log(msg) {
  console.log(`[${new Date().toLocaleTimeString("es-PE")}] ${msg}`);
}

function saveBackup(leads) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const file = path.join(DATA_DIR, "leads_del_dia.json");
  fs.writeFileSync(file, JSON.stringify(leads, null, 2), "utf-8");
  log(`Respaldo local guardado en ${file}`);
}

async function main() {
  if (RESET_MEMORIA) {
    const r = vaciarRegistro();
    if (r.ok) {
      log(`Memoria Obsidian VACIADA en: ${r.path}`);
      log("Puedes borrar filas en Notion y correr el .bat: volvera a scrapear y generar maquetas.");
    } else {
      log(`No se pudo vaciar memoria: ${r.reason}`);
    }
    return;
  }

  const plan = planBusquedas(config.leadsPerDay);
  log(`=== Investigador de Prospectos ${DRY_RUN ? "(DRY-RUN)" : "(PRODUCCION)"} ===`);
  log(`Modo busqueda: ${config.searchMode} | Plan: ${describePlan(plan)}`);
  log(`Total objetivo: ${config.leadsPerDay} leads | Calificacion min: ${config.qualifyMinScore}`);

  assertConfig({ dryRun: DRY_RUN });
  resetQualifyState();

  let schema = null;
  if (!DRY_RUN) {
    try {
      schema = await getSchema();
      const dbTitle = await getDatabaseTitle();
      log(`Notion destino: "${dbTitle}" — si no ves filas nuevas, abre vista sin filtros y ordena por "Creado".`);
      const missing = missingRecommended(schema);
      if (missing.length) {
        log(`NOTA: Columnas recomendadas en Notion:`);
        missing.forEach((m) => log(`   - ${m}`));
      }
    } catch (err) {
      log(`ERROR al leer el schema de Notion: ${err.message}`);
      return;
    }
  }

  const registro = cargarRegistro();
  if (memoriaDisponible()) {
    log(`Memoria Obsidian: ${registro.entries.length} negocios conocidos (se saltan si ya estan).`);
  } else {
    log("Memoria Obsidian no configurada. Configura OBSIDIAN_DB_DIR en .env.");
  }

  const allSkipped = [];

  log("FASE 1: Scrapeando Google Maps por nicho...");
  const seenRun = new Set(registro.seen);
  let rawLeads = [];
  try {
    for (const slot of plan) {
      log(`   -> "${slot.query}" (meta ${slot.limit} calificados)`);
      const slotSkipped = [];
      const batch = await scrapeMaps(slot.query, slot.limit, seenRun, slotSkipped);
      for (const lead of batch) {
        lead.search_query = slot.query;
        lead.nicho = slot.nicho;
        lead.template_hint = slot.template;
        const key = normName(lead.name);
        if (key) seenRun.add(key);
      }
      allSkipped.push(...slotSkipped);
      rawLeads.push(...batch);
      if (rawLeads.length >= config.leadsPerDay) break;
    }
    rawLeads = rawLeads.slice(0, config.leadsPerDay);
  } catch (err) {
    log(`FASE 1 abortada: ${err.message}`);
    if (err.message.includes("CAPTCHA")) {
      log("Espera ~30 min y reintenta. Revisa data/captcha_*.png");
    }
    return;
  }
  log(`FASE 1 OK: ${rawLeads.length} candidatos (filtro rapido: ${allSkipped.length} descartados).`);

  log("FASE 1.5: Auditoria web (HTTP + Gemini borderline)...");
  const qualified = [];
  const auditLimit = pLimit(2);
  await Promise.all(
    rawLeads.map((lead) =>
      auditLimit(async () => {
        const q = await qualifyLead(lead);
        Object.assign(lead, q);
        if (!q.qualified) {
          allSkipped.push({
            name: lead.name,
            reject_reason: q.reject_reason || "score_bajo",
            opportunity_score: q.opportunity_score,
            nicho: lead.nicho,
            phase: "audit",
          });
          log(`   x ${lead.name} (${q.reject_reason || "score"} ${q.opportunity_score})`);
        } else {
          lead.opportunity_score = q.opportunity_score;
          lead.pitch_angle = q.pitch_angle;
          lead.gaps = q.gaps;
          lead.web_tier = q.tier;
          qualified.push(lead);
          log(`   + ${lead.name} (oportunidad ${q.opportunity_score})`);
        }
      }),
    ),
  );

  appendSkipped(allSkipped);
  log(`FASE 1.5 OK: ${qualified.length}/${rawLeads.length} pasan (umbral ${config.qualifyMinScore}).`);

  if (!qualified.length) {
    log("Sin leads calificados. Revisa data/skipped_*.json o baja QUALIFY_MIN_SCORE.");
    return;
  }

  log("FASE 2: Redes (Instagram/FB) + galeria...");
  const processed = [];
  for (const lead of qualified) {
    await enrichInstagramGallery(lead);
    const social = lead.social || {};
    const phone_raw = lead.phone_raw || social.phone_raw;
    const { e164 } = normalizePhonePE(phone_raw);
    processed.push({
      ...lead,
      phone_raw,
      phone_e164: e164,
      source: lead.source || social.source || (e164 ? "Maps" : "Ninguno"),
      redes: lead.redes || social.redes,
    });
  }
  log(`FASE 2 OK: ${processed.filter((l) => l.social?.post_images?.length).length}/${processed.length} con fotos IG.`);

  log("FASE 2b: Logos y colores de marca...");
  await enrichBrandAssets(processed);
  log(`FASE 2b OK: ${processed.filter((l) => l.logo_url).length}/${processed.length} con logo.`);

  log("FASE 3: LLM + maquetas personalizadas...");
  resetEvaluateState();
  const limit = pLimit(3);
  await Promise.all(
    processed.map((lead) =>
      limit(async () => {
        const evalr = await evaluateWithGemini(lead);
        lead.template = evalr.template;
        lead.color = evalr.color;
        lead.font = evalr.font;
        lead.blocks = evalr.blocks;
        lead.sections = evalr.sections;
        lead.score = evalr.score ?? opportunityToNotionScore(lead.opportunity_score);
        lead.wa_text = evalr.wa_text;
        lead.headline = evalr.headline;
        lead.subhead = evalr.subhead;
        lead.eyebrow = evalr.eyebrow;
        lead.brand_primary = evalr.brand_primary;
        lead.variant = evalr.variant;
        lead.pitch_angle = evalr.pitch_angle || lead.pitch_angle;
        lead.diagnostico = evalr.diagnostico;
        lead.needsReview = evalr.needsReview || false;

        lead.wa_link = buildWaLink(lead.phone_e164, lead.wa_text);

        const kit = buildBrandKit(lead, evalr, lead.social || {});
        kit.llm_meta = evalr.llm_meta || kit.llm_meta;
        const kitFinal = await finalizeBrandKit(kit);
        lead.kit_slug = kitFinal.slug;
        lead.kit_url = kitFinal.manifestUrl || null;

        lead.maqueta_url = buildMaquetaUrl({
          name: lead.name,
          template: lead.template,
          kitSlug: kitFinal.slug,
          phone_e164: lead.phone_e164,
          wa_link: lead.wa_link,
        });
        lead.estado = "Prospecto";
        log(`   + Kit ${kitFinal.slug}${kitFinal.publish?.provider ? ` (${kitFinal.publish.provider})` : ""}`);
      }),
    ),
  );
  log("FASE 3 OK (kits en data/kits/).");

  saveBackup(processed);

  if (DRY_RUN) {
    log("DRY-RUN: vista previa (no Notion):");
    processed.forEach((l, i) => {
      console.log(
        `\n  ${i + 1}. [${l.nicho}] ${l.name}  score=${l.score}  opp=${l.opportunity_score}  tier=${l.web_tier}`,
      );
      console.log(`     gaps: ${(l.gaps || []).join(", ")}`);
      console.log(`     sec: ${(l.sections || []).join(",")}`);
      console.log(`     maqueta: ${l.maqueta_url}`);
    });
    return;
  }

  if (memoriaDisponible()) {
    const { added } = guardarEnRegistro(registro, processed);
    log(`Memoria Obsidian: +${added} registrados.`);
  }

  log("FASE 4: Notion...");
  let inserted = 0;
  let skipped = 0;
  for (const lead of processed) {
    try {
      if (await isDuplicate(lead, schema)) {
        log(`   = "${lead.name}" ya en Notion, omitido.`);
        skipped++;
        continue;
      }
      await createLead(lead, schema);
      inserted++;
      log(`   + [${lead.nicho}] "${lead.name}"`);
    } catch (err) {
      log(`   ! "${lead.name}": ${err.message}`);
    }
  }
  log(`FASE 4 OK: ${inserted} insertados, ${skipped} duplicados.`);
  log(`Respaldo local: data/leads_del_dia.json (${processed.length} leads con maqueta_url).`);
  log(`Descartados en corrida: ${allSkipped.length} (ver data/skipped_*.json)`);
  log("=== Listo. En Notion abre cada fila: columna Maqueta URL / WhatsApp Link o el enlace en el cuerpo. ===");
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
