import { config, FONTS, BLOCKS, clampEnum } from "./config.js";
import { inferFromNiche } from "./classify.js";
import { resolveTemplateFromLead, blocksForTemplate } from "./templatePolicy.js";
import {
  analyzeBrandFromLogo,
  resolveBrandIdentity,
  normalizeHex,
  nearestColorEnum,
} from "./brand.js";
import { resetLlmRouter } from "./llm/router.js";
import { LlmQuotaError } from "./llm/errors.js";
import {
  SECTION_CATALOG,
  resolveSections,
  clampSectionsForGemini,
} from "./sections.js";
import { opportunityToNotionScore } from "./qualify.js";
import { buildLeadContextBlock } from "./leadContext.js";
import {
  copyFieldsAreGeneric,
  llmGenerateValidatedJson,
  wrapCopyPrompt,
} from "./copyQuality.js";

let quotaSkipGemini = false;

const buildCopyPrompt = (lead, hint, base) => {
  const allowed = SECTION_CATALOG[hint.template] || [];
  return wrapCopyPrompt(
    lead,
    `Eres copywriter comercial web en Peru. Rubro plantilla: ${hint.template}.
Color marca base: #${base.brand_primary}. Variante: ${base.variant}.
Diagnostico: ${lead.pitch_angle || ""}
Gaps: ${(lead.gaps || []).join(", ") || "ninguno"}
Elige 6-10 secciones SOLO de: ${allowed.join(", ")}
WhatsApp debe citar el gap real y la maqueta de ${lead.name}.
SOLO JSON:
{
  "headline": "max 60 chars, menciona el negocio o su especialidad",
  "subhead": "max 140 chars, beneficio concreto",
  "eyebrow": "max 30 chars",
  "primary": "#RRGGBB",
  "secondary": "#RRGGBB",
  "font": "${FONTS.join("|")}",
  "blocks": [],
  "sections": ["hero","..."],
  "pitch_angle": "1 frase venta",
  "wa_text": "3 lineas WhatsApp",
  "score": 1-10
}`,
  );
};

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

function clip(s, max) {
  if (typeof s !== "string") return "";
  const t = s.trim();
  return t.length > max ? t.slice(0, max).trim() : t;
}

function mergeResult(base, visual, parsed, hint, lead) {
  const primary = visual?.brand_primary
    ? normalizeHex(visual.brand_primary)
    : normalizeHex(lead.brand_primary) ||
      (base.brandLocked && normalizeHex(base.brand_primary)) ||
      normalizeHex(parsed?.primary) ||
      base.brand_primary;

  const secondary = visual?.brand_secondary
    ? normalizeHex(visual.brand_secondary)
    : normalizeHex(lead.brand_secondary) ||
      normalizeHex(parsed?.secondary) ||
      primary;

  const font = parsed?.font ? clampEnum(parsed.font, FONTS, hint.font) : hint.font;
  let blocks = blocksForTemplate(hint.template);
  if (hint.template === "tiendas" && lead.template_hint === "tiendas") {
    blocks = blocksForTemplate("tiendas");
  }

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

  const headline = clip(parsed?.headline || base.headline, 70);
  const subhead = clip(parsed?.subhead || base.subhead, 160);
  const eyebrow = clip(parsed?.eyebrow || base.eyebrow, 36);
  const pitch_angle =
    clip(parsed?.pitch_angle || lead.pitch_angle, 200) || lead.pitch_angle || "";
  const gaps = lead.gaps?.length ? lead.gaps : [];
  const diagnostico = [pitch_angle, gaps.length ? `Gaps: ${gaps.join(", ")}` : ""]
    .filter(Boolean)
    .join(" | ");

  const wa_text =
    typeof parsed?.wa_text === "string" && parsed.wa_text.trim() && !copyFieldsAreGeneric({ wa_text: parsed.wa_text })
      ? parsed.wa_text.trim()
      : buildWaFallback(lead, headline) || base.wa_text;

  return {
    template: hint.template,
    color: nearestColorEnum(primary),
    font,
    brand_primary: primary,
    brand_secondary: secondary,
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
  hint.template = resolveTemplateFromLead(lead) || hint.template;
  lead.template_hint = hint.template;

  const base = resolveBrandIdentity(lead, hint.template);

  let visual = null;
  const visionSources = [
    lead.maps_photo_blob,
    lead.logo_url,
    lead.maps_photo_url,
    lead.hero_image_url,
  ].filter(Boolean);
  const visionUrl = visionSources[0];
  if (visionUrl && !quotaSkipGemini) {
    try {
      visual = await analyzeBrandFromLogo(visionUrl, lead, hint.template);
    } catch (err) {
      if (err instanceof LlmQuotaError) quotaSkipGemini = true;
    }
  }

  if (quotaSkipGemini) {
    return mergeResult(base, visual, null, hint, lead);
  }

  try {
    const { parsed, llm_meta } = await llmGenerateValidatedJson({
      task: "copy",
      buildPrompt: () => buildCopyPrompt(lead, hint, base),
      validate: (p) => !copyFieldsAreGeneric(p),
    });
    if (!parsed) return fallbackEvaluation(lead, hint, base, "copy generico o JSON invalido");
    const merged = mergeResult(base, visual, parsed, hint, lead);
    merged.llm_meta = llm_meta;
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
