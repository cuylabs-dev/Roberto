// ============================================================================
// qualify.js — Calificación de oportunidad web (cadenas, audit HTTP, Gemini)
// ============================================================================

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { normName } from "./memoria.js";
import { llmGenerate } from "./llm/router.js";
import { LlmQuotaError } from "./llm/errors.js";
import { verifyWebPresenceOnGoogle, fetchEmailFromGoogle } from "./googleWebDiscovery.js";
import { extractDomain, isSocialOnlyUrl } from "./urlHosts.js";

export { extractDomain, isSocialOnlyUrl };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHAINS_PATH = path.resolve(__dirname, "../data/chains.json");
const DATA_DIR = path.resolve("data");

const SOCIAL_HOSTS = [
  "facebook.com", "instagram.com", "linktr.ee", "wa.me", "whatsapp.com",
  "tiktok.com", "twitter.com", "x.com",
];

let chainsCache = null;
let quotaSkipQualifyGemini = false;

function loadChains() {
  if (chainsCache) return chainsCache;
  try {
    chainsCache = JSON.parse(fs.readFileSync(CHAINS_PATH, "utf-8"));
  } catch {
    chainsCache = { namePatterns: [], nameSignals: [], domains: [], strongWebKeywords: [], weakWebKeywords: [] };
  }
  return chainsCache;
}

function norm(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Normaliza nombres de marca para detectar cadenas (H&M, Pull&Bear, etc.). */
function normBrandName(name) {
  return norm(name)
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SHORT_CHAIN_TOKENS = new Set([
  "hm", "gap", "bcp", "kfc", "bbva", "wom", "gnc", "cat", "avon", "saga", "mac", "c a",
]);

/** Colegios, clínicas, etc. con " - Lima" en Maps NO son cadenas. */
const LOCAL_BIZ_KW =
  /colegio|clinic|clinica|gimnasio|gym|consultor|boutique|academia|studio|crossfit|dental|odontolog|barber|veterinari|ferreteria|restaurante|cafeteria|abogad|contador|tienda|spa |escuela|inicial|kinder|universidad|instituto/i;

/** Solo "Marca X - Miraflores" corto (franquicia), no "Colegio ... de Miraflores - Lima". */
function isFranchiseBranchSuffix(name) {
  const n = norm(name);
  if (LOCAL_BIZ_KW.test(n)) return { reject: false };
  const m = n.match(
    /^(.{2,42})\s[-–]\s(lima|miraflores|surco|san isidro|la molina|chorrillos|san borja|lince)$/,
  );
  if (!m) return { reject: false };
  const left = m[1].trim();
  if (LOCAL_BIZ_KW.test(left)) return { reject: false };
  const words = left.split(/\s+/).length;
  if (words <= 4) return { reject: true, reason: "senal_sucursal_cadena" };
  return { reject: false };
}

function matchesChainName(name) {
  const n = normBrandName(name);
  const branch = isFranchiseBranchSuffix(name);
  if (branch.reject) return branch;

  const { namePatterns, nameSignals } = loadChains();
  for (const p of namePatterns) {
    const pn = normBrandName(p);
    if (!pn) continue;
    const token = pn.trim();
    if (SHORT_CHAIN_TOKENS.has(token) || token.length <= 3) {
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`\\b${escaped}\\b`, "i").test(n)) {
        return { reject: true, reason: `cadena_nombre:${p.trim()}` };
      }
      continue;
    }
    if (n.includes(token)) return { reject: true, reason: `cadena_nombre:${p.trim()}` };
  }
  for (const s of nameSignals) {
    const sn = normBrandName(s).trim();
    if (!sn) continue;
    if (sn === "kids" || sn === "junior" || sn === "outlet") {
      if (new RegExp(`\\b${sn}\\b`, "i").test(n)) {
        return { reject: true, reason: `senal_cadena:${sn}` };
      }
      continue;
    }
    if (n.includes(sn)) return { reject: true, reason: `senal_cadena:${sn}` };
  }
  return { reject: false };
}

function matchesChainDomain(url) {
  const d = extractDomain(url);
  if (!d) return { reject: false };
  const { domains } = loadChains();
  for (const chain of domains) {
    if (d === chain || d.endsWith(`.${chain}`)) {
      if (SOCIAL_HOSTS.includes(chain)) return { reject: false, social: true };
      return { reject: true, reason: `cadena_dominio:${chain}` };
    }
  }
  return { reject: false };
}

/**
 * Capa 1: reglas instantáneas sin red.
 */
export function qualifyFast(lead) {
  const chainName = matchesChainName(lead.name);
  if (chainName.reject) {
    return {
      reject: true,
      reject_reason: chainName.reason,
      opportunity_score: 5,
      tier: "chain",
    };
  }

  if (!lead.has_website || !lead.website_url) {
    return {
      reject: false,
      opportunity_score: 92,
      tier: "no_web",
      pitch_angle: "No tienen sitio web propio en Google Maps — oportunidad clara de presencia digital.",
      gaps: ["sin_sitio_web", "visibilidad_google"],
    };
  }

  const url = lead.website_url;
  const domainEarly = matchesChainDomain(url);
  if (domainEarly.reject) {
    return {
      reject: true,
      reject_reason: domainEarly.reason,
      opportunity_score: 8,
      tier: "chain",
    };
  }

  if (isSocialOnlyUrl(url)) {
    return {
      reject: false,
      opportunity_score: 88,
      tier: "social_only",
      pitch_angle: "Solo enlazan redes sociales — una web propia les da credibilidad y reservas.",
      gaps: ["solo_redes", "sin_dominio_propio"],
    };
  }

  const domainCheck = matchesChainDomain(url);
  if (domainCheck.reject) {
    return {
      reject: true,
      reject_reason: domainCheck.reason,
      opportunity_score: 8,
      tier: "chain",
    };
  }

  return { reject: false, needs_audit: true, tier: "unknown" };
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countMatches(text, keywords) {
  const low = text.toLowerCase();
  return keywords.filter((k) => low.includes(k.toLowerCase())).length;
}

/**
 * Capa 2: fetch HTTP + heurísticas.
 */
export async function auditWebsite(url) {
  const domain = extractDomain(url);
  const signals = [];
  let opportunity_score = 50;
  let tier = "moderate";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.qualifyFetchTimeoutMs);

  try {
    const res = await fetch(url.startsWith("http") ? url : `https://${url}`, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "es-PE,es;q=0.9",
      },
    });

    const html = await res.text().catch(() => "");
    const text = stripHtml(html).slice(0, 12000);
    const htmlLen = html.length;

    const { strongWebKeywords, weakWebKeywords } = loadChains();
    const strongHits = countMatches(html + text, strongWebKeywords);
    const weakHits = countMatches(text, weakWebKeywords);

    const titleM = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleM ? titleM[1].trim() : "";
    const hasOg = /property=["']og:/i.test(html);
    const internalLinks = (html.match(/href=["'][^"']*["']/gi) || []).length;
    const isHttps = url.startsWith("https") || res.url?.startsWith("https");

    if (!isHttps) {
      signals.push("sin_https");
      opportunity_score += 12;
    }
    if (htmlLen < 8000) {
      signals.push("html_pequeno");
      opportunity_score += 15;
    }
    if (htmlLen > 80000 && strongHits >= 2) {
      signals.push("web_corporativa_grande");
      opportunity_score -= 35;
    }
    if (strongHits >= 3) {
      signals.push("ecommerce_fuerte");
      opportunity_score -= 40;
      tier = "strong_web";
    } else if (strongHits >= 2 && htmlLen > 40000) {
      signals.push("web_corporativa_fuerte");
      opportunity_score -= 45;
      tier = "strong_web";
    } else if (strongHits >= 1) {
      signals.push("ecommerce_parcial");
      opportunity_score -= 15;
    }
    if (weakHits >= 1) {
      signals.push("web_debil");
      opportunity_score += 20;
      tier = "weak_web";
    }
    if (internalLinks < 8 && htmlLen < 15000) {
      signals.push("landing_simple");
      opportunity_score += 10;
    }
    if (hasOg && strongHits === 0 && htmlLen > 20000) {
      signals.push("marca_establecida");
      opportunity_score -= 10;
    }
    if (/wix\.com|wordpress\.com|blogspot|weebly|squarespace/i.test(html) && htmlLen < 20000) {
      signals.push("plantilla_generica");
      opportunity_score += 8;
    }

    opportunity_score = Math.min(100, Math.max(0, opportunity_score));

    const gaps = [];
    if (signals.includes("sin_https")) gaps.push("sin_https");
    if (signals.includes("landing_simple") || signals.includes("html_pequeno")) gaps.push("web_basica");
    if (signals.includes("plantilla_generica")) gaps.push("plantilla_generica");
    if (signals.includes("ecommerce_fuerte")) gaps.push("ya_tiene_tienda_online");

    let pitch_angle =
      opportunity_score >= 70
        ? "Su web actual es limitada — una propuesta moderna puede mejorar reservas y confianza."
        : opportunity_score >= 50
          ? "Web mejorable: más secciones, mejor móvil y llamadas a la acción claras."
          : "Web establecida — revisar si realmente necesitan rediseño.";

    if (tier === "strong_web" && opportunity_score < 40) {
      pitch_angle = "Sitio corporativo o tienda online madura — baja prioridad para venta de web nueva.";
    }

    return {
      audit_ok: true,
      domain,
      title,
      html_snippet: text.slice(0, 3000),
      signals,
      opportunity_score,
      tier,
      gaps,
      pitch_angle,
    };
  } catch (err) {
    return {
      audit_ok: false,
      domain,
      signals: ["fetch_fallido"],
      opportunity_score: 72,
      tier: "audit_failed",
      gaps: ["auditoria_no_disponible"],
      pitch_angle: "No pudimos auditar la web — valorar manualmente.",
      error: err.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

function safeParseJson(text) {
  if (!text) return null;
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function needsGeminiAudit(score, lead) {
  if (quotaSkipQualifyGemini) return false;
  const nicho = (lead.nicho || "").toLowerCase();
  if (nicho.includes("tienda") || nicho.includes("corporativo")) return score >= 35 && score <= 80;
  return score >= 40 && score <= 75;
}

const GEMINI_AUDIT_PROMPT = (lead, snippet) => `Auditor comercial web en Peru. ¿Este negocio LOCAL necesita web nueva o mejora web?
Negocio: "${lead.name}"
Direccion: ${lead.address || "Lima"}
Nicho: ${lead.nicho || "?"}
Tiene link Maps: ${lead.has_website}
Dominio: ${extractDomain(lead.website_url) || "ninguno"}
Texto visible home:
${(snippet || "").slice(0, 2800)}

Responde SOLO JSON:
{"opportunity_score":0-100,"reject":true/false,"reject_reason":"cadena|web_fuerte|ok","pitch_angle":"1 frase","gaps":["gap1","gap2"]}`;

const LONG_HTML_CHARS = 8000;

export async function qualifyWithGemini(lead, audit) {
  if (quotaSkipQualifyGemini) return null;
  const snippet = audit?.html_snippet || "";
  const task = snippet.length >= LONG_HTML_CHARS ? "longcontext" : "audit";
  try {
    const raw = await llmGenerate({
      task,
      prompt: GEMINI_AUDIT_PROMPT(lead, snippet),
    });
    const parsed = safeParseJson(raw?.text);
    if (!parsed) return null;
    let score = parseInt(parsed.opportunity_score, 10);
    if (!Number.isFinite(score)) score = audit?.opportunity_score ?? 50;
    return {
      opportunity_score: Math.min(100, Math.max(0, score)),
      reject: Boolean(parsed.reject),
      reject_reason: parsed.reject_reason || (parsed.reject ? "gemini_reject" : null),
      pitch_angle: parsed.pitch_angle || audit?.pitch_angle,
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps : audit?.gaps || [],
      llm_meta: { provider: raw.provider, model: raw.model, task },
    };
  } catch (err) {
    if (err instanceof LlmQuotaError) quotaSkipQualifyGemini = true;
    return null;
  }
}

/**
 * Pipeline completo para un lead.
 */
export async function qualifyLead(lead) {
  const fast = qualifyFast(lead);
  if (fast.reject) {
    return {
      qualified: false,
      reject: true,
      reject_reason: fast.reject_reason,
      opportunity_score: fast.opportunity_score,
      tier: fast.tier,
      web_audit: fast,
    };
  }

  const mapsSinWeb =
    fast.tier === "no_web" ||
    fast.tier === "social_only" ||
    (!lead.has_website && !lead.website_url);

  // Maps sin web → obligatorio verificar en Google antes de ser candidato
  if (mapsSinWeb) {
    const verified = await verifyWebPresenceOnGoogle(lead);
    if (verified.email && !lead.email) lead.email = verified.email;

    if (verified.has_official_web) {
      return {
        qualified: false,
        reject: true,
        reject_reason: "web_confirmada_google",
        opportunity_score: 12,
        tier: "has_web_hidden",
        pitch_angle: `Tiene web propia (${verified.domain}) — Maps no la mostraba; no es prospecto sin sitio.`,
        gaps: ["sitio_web_existe"],
        web_audit: {
          ...fast,
          discovered_url: verified.website_url,
          discovered_domain: verified.domain,
          google_verified: true,
        },
      };
    }

    return {
      qualified: true,
      reject: false,
      opportunity_score: fast.opportunity_score,
      tier: fast.tier,
      pitch_angle: fast.pitch_angle,
      gaps: fast.gaps,
      web_audit: { ...fast, google_verified: true, sin_web_confirmado: true },
    };
  }

  if (!lead.email && lead.has_website) {
    const mail = await fetchEmailFromGoogle(lead);
    if (mail) lead.email = mail;
  }

  const hasRealWeb =
    lead.has_website && lead.website_url && !isSocialOnlyUrl(lead.website_url);

  let audit = null;
  if (hasRealWeb) {
    audit = await auditWebsite(lead.website_url);
    const domainCheck = matchesChainDomain(lead.website_url);
    if (domainCheck.reject) {
      return {
        qualified: false,
        reject: true,
        reject_reason: domainCheck.reason,
        opportunity_score: 10,
        tier: "chain",
        web_audit: audit,
      };
    }
  } else {
    audit = {
      opportunity_score: fast.opportunity_score ?? 85,
      tier: fast.tier || "no_web",
      gaps: fast.gaps || [],
      pitch_angle: fast.pitch_angle,
      signals: [],
    };
  }

  let score = audit.opportunity_score;
  let reject = false;
  let reject_reason = null;
  let pitch_angle = audit.pitch_angle;
  let gaps = audit.gaps || [];

  if (needsGeminiAudit(score, lead)) {
    const gem = await qualifyWithGemini(lead, audit);
    if (gem) {
      score = gem.opportunity_score;
      if (gem.reject) {
        reject = true;
        reject_reason = gem.reject_reason || "web_fuerte";
      }
      pitch_angle = gem.pitch_angle || pitch_angle;
      gaps = gem.gaps?.length ? gem.gaps : gaps;
    }
  }

  const strongSignals = audit.signals || [];
  const hasStrongWeb =
    audit.tier === "strong_web" ||
    strongSignals.includes("ecommerce_fuerte") ||
    strongSignals.includes("web_corporativa_grande") ||
    strongSignals.includes("web_corporativa_fuerte");

  if (!reject && hasStrongWeb) {
    reject = true;
    reject_reason = "web_corporativa_fuerte";
    score = Math.min(score, 30);
  }

  if (!reject && audit.tier === "strong_web" && score < config.qualifyMinScore) {
    reject = true;
    reject_reason = "web_corporativa_fuerte";
  }

  if (!reject && lead.has_website && lead.website_url && !isSocialOnlyUrl(lead.website_url)) {
    if (score < config.qualifyMinScore) {
      reject = true;
      reject_reason = reject_reason || "web_ya_suficiente";
    }
  }

  const qualified = !reject && score >= config.qualifyMinScore;

  return {
    qualified,
    reject,
    reject_reason,
    opportunity_score: score,
    tier: audit.tier,
    pitch_angle,
    gaps,
    web_audit: audit,
  };
}

export async function qualifyLeads(leads, { concurrency = 2 } = {}) {
  const pLimit = (await import("p-limit")).default;
  const limit = pLimit(concurrency);
  const results = await Promise.all(leads.map((lead) => limit(() => qualifyLead(lead))));
  for (let i = 0; i < leads.length; i++) {
    Object.assign(leads[i], results[i]);
  }
  return leads;
}

export function opportunityToNotionScore(score100) {
  const s = Math.round((score100 || 0) / 10);
  return Math.min(10, Math.max(1, s || 1));
}

export function appendSkipped(skipped) {
  if (!skipped?.length) return;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const file = path.join(DATA_DIR, `skipped_${day}.json`);
  let existing = [];
  if (fs.existsSync(file)) {
    try {
      existing = JSON.parse(fs.readFileSync(file, "utf-8"));
    } catch {
      existing = [];
    }
  }
  existing.push(...skipped);
  fs.writeFileSync(file, JSON.stringify(existing, null, 2), "utf-8");
}

export function resetQualifyState() {
  quotaSkipQualifyGemini = false;
}
