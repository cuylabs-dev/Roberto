import { config, FONTS, BLOCKS, clampEnum } from "./config.js";
import { inferFromNiche } from "./classify.js";
import {
  analyzeBrandFromLogo,
  resolveBrandIdentity,
  normalizeHex,
  nearestColorEnum,
} from "./brand.js";
import { llmGenerate, resetLlmRouter } from "./llm/router.js";
import { LlmQuotaError } from "./llm/errors.js";
import {
  SECTION_CATALOG,
  resolveSections,
  clampSectionsForGemini,
} from "./sections.js";
import { opportunityToNotionScore } from "./qualify.js";

let quotaSkipGemini = false;

const PROMPT = (lead, hint, base) => {
  const gaps = (lead.gaps || []).join(", ") || "ninguno";
  const pitch = lead.pitch_angle || "";
  const allowed = SECTION_CATALOG[hint.template] || [];
  return `Eres copywriter comercial web en Peru. Negocio: "${lead.name}". Rubro: ${hint.template}.
Color marca: #${base.brand_primary}. Variante: ${base.variant}.
Diagnostico: ${pitch}
Gaps detectados: ${gaps}
Elige 6-10 secciones de esta lista EXACTA: ${allowed.join(", ")}
Copy UNICO (no generico de software salvo corporativo). WhatsApp debe mencionar el gap real y la maqueta.
SOLO JSON:
{
  "headline": "max 60 chars",
  "subhead": "max 140 chars",
  "eyebrow": "max 30 chars",
  "primary": "#RRGGBB",
  "font": "${FONTS.join("|")}",
  "blocks": [],
  "sections": ["hero","..."],
  "pitch_angle": "1 frase venta",
  "wa_text": "3 lineas WhatsApp citando gap",
  "score": 1-10
}`;
};

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

function clip(s, max) {
  if (typeof s !== "string") return "";
  const t = s.trim();
  return t.length > max ? t.slice(0, max).trim() : t;
}

function buildWaFallback(lead, headline) {
  const gap = lead.gaps?.[0] || "mejorar su presencia web";
  const gapText =
    gap === "sin_sitio_web"
      ? "vi que no tienen sitio web propio"
      : gap === "solo_redes"
        ? "solo tienen redes, sin web propia"
        : gap === "web_basica"
          ? "su web es muy basica"
          : `notamos ${gap.replace(/_/g, " ")}`;
  return `Hola, soy de CuyLabs. ${gapText}.\nPreparamos una maqueta para ${lead.name} con sus colores.\n¿Le comparto el link? ${headline ? `(${headline.slice(0, 40)})` : ""}`.trim();
}

async function generateText(prompt) {
  const out = await llmGenerate({ task: "copy", prompt });
  if (!out?.text) throw new Error("LLM no respondio");
  return { text: out.text, llm_meta: { provider: out.provider, model: out.model } };
}

function mergeResult(base, visual, parsed, hint, lead) {
  const primary =
    (base.brandLocked && normalizeHex(base.brand_primary)) ||
    normalizeHex(visual?.brand_primary) ||
    normalizeHex(parsed?.primary) ||
    base.brand_primary;

  const font = parsed?.font ? clampEnum(parsed.font, FONTS, hint.font) : hint.font;
  const blocks = Array.isArray(parsed?.blocks)
    ? parsed.blocks.map((b) => clampEnum(b, BLOCKS, null)).filter(Boolean)
    : [];

  const sectionIds = clampSectionsForGemini(parsed?.sections, hint.template);
  const tier = lead.web_tier || lead.tier;
  let sections = resolveSections(hint.template, sectionIds, tier);
  if (hint.template === "gimnasios" && base.variant === "fight") {
    const extra = ["coaches_campeones", "eventos", "eventos_peleas"];
    for (const id of extra) {
      if (!sections.includes(id)) sections.push(id);
    }
    sections = resolveSections(hint.template, sections, tier);
  }

  let score = parseInt(parsed?.score, 10);
  if (!Number.isFinite(score)) {
    score = opportunityToNotionScore(lead.opportunity_score);
  }
  score = Math.min(10, Math.max(1, score));

  const headline = clip(visual?.headline || parsed?.headline || base.headline, 70);
  const subhead = clip(visual?.subhead || parsed?.subhead || base.subhead, 160);
  const eyebrow = clip(visual?.eyebrow || parsed?.eyebrow || base.eyebrow, 36);
  const pitch_angle =
    clip(parsed?.pitch_angle || lead.pitch_angle, 200) || lead.pitch_angle || "";
  const gaps = lead.gaps?.length ? lead.gaps : [];
  const diagnostico = [pitch_angle, gaps.length ? `Gaps: ${gaps.join(", ")}` : ""]
    .filter(Boolean)
    .join(" | ");

  const wa_text =
    typeof parsed?.wa_text === "string" && parsed.wa_text.trim()
      ? parsed.wa_text.trim()
      : buildWaFallback(lead, headline) || base.wa_text;

  return {
    template: hint.template,
    color: nearestColorEnum(primary),
    font,
    brand_primary: primary,
    variant: base.variant,
    blocks,
    sections,
    headline,
    subhead,
    eyebrow,
    wa_text,
    pitch_angle,
    diagnostico,
    score,
    needsReview: !parsed && !visual,
  };
}

function fallbackEvaluation(lead, hint, base, reason) {
  const short = String(reason).split("\n")[0].slice(0, 120);
  console.warn(`   Copy local (${lead.name}): ${short}`);
  const tier = lead.web_tier || lead.tier;
  const sections = resolveSections(hint.template, null, tier);
  const merged = mergeResult(base, null, null, hint, lead);
  return {
    ...merged,
    sections,
    wa_text: buildWaFallback(lead, merged.headline),
    needsReview: true,
    reviewReason: reason,
  };
}

export async function evaluateWithGemini(lead) {
  const hint = inferFromNiche({
    searchQuery: lead.search_query || config.searchQuery || "",
    name: lead.name,
  });
  if (lead.template_hint) hint.template = lead.template_hint;

  const base = resolveBrandIdentity(lead, hint.template);

  let visual = null;
  if (lead.logo_url && !quotaSkipGemini) {
    try {
      visual = await analyzeBrandFromLogo(lead.logo_url, lead, hint.template);
    } catch (err) {
      if (err instanceof LlmQuotaError) quotaSkipGemini = true;
    }
  }

  if (quotaSkipGemini) {
    return mergeResult(base, visual, null, hint, lead);
  }

  try {
    const gen = await generateText(PROMPT(lead, hint, base));
    const parsed = safeParseJson(gen.text);
    if (!parsed) return fallbackEvaluation(lead, hint, base, "JSON invalido");
    const merged = mergeResult(base, visual, parsed, hint, lead);
    merged.llm_meta = gen.llm_meta;
    return merged;
  } catch (err) {
    if (err instanceof LlmQuotaError) {
      quotaSkipGemini = true;
      return mergeResult(base, visual, null, hint, lead);
    }
    return fallbackEvaluation(lead, hint, base, err.message);
  }
}

export function resetEvaluateState() {
  quotaSkipGemini = false;
  resetLlmRouter();
}
