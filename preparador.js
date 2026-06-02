// ============================================================================
// preparador.js — Bucle Outbound B2B (Investigador de Prospectos)
//   Fase 1: scrapeMaps()         -> Google Maps (stealth)
//   Fase 2: enrichFromSocial()   -> fallback FB/IG (perfil "cuy")
//   Fase 3: evaluateWithGemini() -> plantilla/color/font/blocks/score/wa_text
//   Fase 4: createLead()         -> inyeccion en Notion (schema real)
//
//   Uso:
//     node preparador.js            (produccion: escribe en Notion)
//     node preparador.js --dry-run  (no escribe en Notion, solo consola + JSON)
// ============================================================================

import fs from "node:fs";
import path from "node:path";
import pLimit from "p-limit";
import { config, assertConfig } from "./lib/config.js";
import { scrapeMaps, enrichFromSocial } from "./lib/scraper.js";
import { evaluateWithGemini } from "./lib/gemini.js";
import { normalizePhonePE } from "./lib/phone.js";
import { buildMaquetaUrl, buildWaLink } from "./lib/urls.js";
import { getSchema, isDuplicate, createLead, missingRecommended } from "./lib/notion.js";

const DRY_RUN = process.argv.includes("--dry-run");
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
  log(`=== Investigador de Prospectos ${DRY_RUN ? "(DRY-RUN)" : "(PRODUCCION)"} ===`);
  log(`Nicho: "${config.searchQuery}" | Objetivo: ${config.leadsPerDay} leads`);

  assertConfig({ dryRun: DRY_RUN });

  // --- Schema de Notion (solo en produccion) ---
  let schema = null;
  if (!DRY_RUN) {
    try {
      schema = await getSchema();
      const missing = missingRecommended(schema);
      if (missing.length) {
        log(`NOTA: Para aprovechar todo, crea en Notion estas columnas (opcional):`);
        missing.forEach((m) =>
          log(`   - "${m}" (${m === "Score" ? "Number" : "URL"}). Sin ella, ese dato no se escribe.`),
        );
      }
    } catch (err) {
      log(`ERROR al leer el schema de Notion: ${err.message}`);
      log(`Revisa NOTION_TOKEN, NOTION_DATABASE_ID y que la integracion este compartida con la DB.`);
      return;
    }
  }

  // --- FASE 1: Scraping Google Maps ---
  log("FASE 1: Scrapeando Google Maps...");
  let rawLeads = [];
  try {
    rawLeads = await scrapeMaps(config.searchQuery, config.leadsPerDay);
  } catch (err) {
    log(`FASE 1 abortada: ${err.message}`);
    if (err.message.includes("CAPTCHA")) {
      log("Espera ~30 min y reintenta. Revisa el screenshot en data/.");
    }
    return;
  }
  log(`FASE 1 OK: ${rawLeads.length} negocios extraidos.`);

  // --- FASE 2: Fallback FB/IG para los que no tienen telefono ---
  const processed = [];
  for (const lead of rawLeads) {
    let phone_raw = lead.phone_raw;
    let source = lead.source;
    let redes = null;

    if (!phone_raw) {
      log(`FASE 2: "${lead.name}" sin telefono -> buscando en FB/IG...`);
      const social = await enrichFromSocial(lead);
      phone_raw = social.phone_raw;
      source = social.source || source;
      redes = social.redes;
      if (social.note) log(`   ${social.note}`);
    }

    const { e164 } = normalizePhonePE(phone_raw);
    processed.push({
      ...lead,
      phone_raw,
      phone_e164: e164,
      source: source || (e164 ? "Maps" : "Ninguno"),
      redes,
    });
  }

  // --- FASE 3: Cerebro Gemini (concurrencia controlada) ---
  log("FASE 3: Analizando con Gemini Flash...");
  const limit = pLimit(3);
  await Promise.all(
    processed.map((lead) =>
      limit(async () => {
        const evalr = await evaluateWithGemini(lead);
        lead.template = evalr.template;
        lead.color = evalr.color;
        lead.font = evalr.font;
        lead.blocks = evalr.blocks;
        lead.score = evalr.score;
        lead.wa_text = evalr.wa_text;
        lead.needsReview = evalr.needsReview || false;

        lead.maqueta_url = buildMaquetaUrl({
          name: lead.name,
          template: lead.template,
          color: lead.color,
          font: lead.font,
          blocks: lead.blocks,
        });
        lead.wa_link = buildWaLink(lead.phone_e164, lead.wa_text);
        lead.estado = "Prospecto";
      }),
    ),
  );
  log("FASE 3 OK.");

  // --- FASE 4: Notion ---
  saveBackup(processed);

  if (DRY_RUN) {
    log("DRY-RUN: no se escribe en Notion. Vista previa:");
    processed.forEach((l, i) => {
      console.log(`\n  ${i + 1}. ${l.name}  [score ${l.score}]`);
      console.log(`     tel: ${l.phone_e164 || "—"} | fuente: ${l.source}`);
      console.log(`     maqueta: ${l.maqueta_url}`);
      console.log(`     wa: ${l.wa_link || "—"}`);
    });
    log(`\nDRY-RUN completo. ${processed.length} leads listos (no insertados).`);
    return;
  }

  log("FASE 4: Inyectando en Notion...");
  let inserted = 0;
  let skipped = 0;
  for (const lead of processed) {
    try {
      if (await isDuplicate(lead, schema)) {
        log(`   = "${lead.name}" ya existe, se omite.`);
        skipped++;
        continue;
      }
      await createLead(lead, schema);
      inserted++;
      log(`   + "${lead.name}" insertado.`);
    } catch (err) {
      log(`   ! "${lead.name}" fallo: ${err.message}`);
    }
  }
  log(`FASE 4 OK: ${inserted} insertados, ${skipped} duplicados omitidos.`);
  log("=== Corrida finalizada ===");
}

main().catch((err) => {
  console.error("Error fatal no controlado:", err);
  process.exit(1);
});
