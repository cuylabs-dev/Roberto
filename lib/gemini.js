import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  config,
  TEMPLATES,
  COLORS,
  FONTS,
  BLOCKS,
  DEFAULTS,
  clampEnum,
} from "./config.js";

const PROMPT = (lead) => `Eres un consultor de marketing digital para negocios B2B en Peru.
Analiza este negocio y devuelve SOLO un JSON valido (sin markdown, sin explicacion).

Negocio:
- Nombre: ${lead.name}
- Direccion: ${lead.address || "desconocida"}
- Tiene web propia: ${lead.has_website ? "si" : "no"}
- Nicho de busqueda: ${config.searchQuery}

Elige valores EXACTAMENTE de estas listas cerradas:
- template: ${TEMPLATES.join(" | ")}
- color: ${COLORS.join(" | ")}
- font: ${FONTS.join(" | ")}
- blocks: subconjunto (0 o mas) de ${BLOCKS.join(" | ")}

Devuelve este shape:
{
  "template": "<uno de template>",
  "color": "<uno de color>",
  "font": "<uno de font>",
  "blocks": ["<0+ de blocks>"],
  "wa_text": "<mensaje de WhatsApp en espanol, calido y directo, maximo 3 lineas, sin emojis excesivos, mencionando el nombre del negocio y ofreciendo una web moderna>",
  "score": <entero 1-10 segun potencial del lead>
}`;

function safeParseJson(text) {
  if (!text) return null;
  // Quita fences de markdown si Gemini los agrega.
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

function fallbackEvaluation(lead, reason) {
  return {
    template: DEFAULTS.template,
    color: DEFAULTS.color,
    font: DEFAULTS.font,
    blocks: [],
    wa_text: `Hola, vi ${lead.name} y me encantaria mostrarte una propuesta de web moderna para tu negocio. Te comparto una maqueta sin compromiso.`,
    score: 5,
    needsReview: true,
    reviewReason: reason,
  };
}

let _model = null;
function getModel() {
  if (_model) return _model;
  const genAI = new GoogleGenerativeAI(config.geminiApiKey);
  _model = genAI.getGenerativeModel({ model: config.geminiModel });
  return _model;
}

// Evalua un lead con Gemini Flash. Nunca lanza: si falla, devuelve fallback + needsReview.
export async function evaluateWithGemini(lead) {
  try {
    const model = getModel();
    const result = await model.generateContent(PROMPT(lead));
    const raw = result.response.text();
    const parsed = safeParseJson(raw);
    if (!parsed) return fallbackEvaluation(lead, "Gemini no devolvio JSON parseable");

    const template = clampEnum(parsed.template, TEMPLATES, DEFAULTS.template);
    const color = clampEnum(parsed.color, COLORS, DEFAULTS.color);
    const font = clampEnum(parsed.font, FONTS, DEFAULTS.font);
    const blocks = Array.isArray(parsed.blocks)
      ? parsed.blocks
          .map((b) => clampEnum(b, BLOCKS, null))
          .filter((b) => b !== null)
      : [];

    let score = parseInt(parsed.score, 10);
    if (!Number.isFinite(score)) score = 5;
    score = Math.min(10, Math.max(1, score));

    let wa_text = typeof parsed.wa_text === "string" ? parsed.wa_text.trim() : "";
    if (!wa_text) wa_text = fallbackEvaluation(lead, "").wa_text;

    // Marca para revision si Gemini devolvio algo fuera de enum (lo casteamos).
    const needsReview =
      parsed.template && clampEnum(parsed.template, TEMPLATES, null) === null;

    return { template, color, font, blocks, wa_text, score, needsReview };
  } catch (err) {
    return fallbackEvaluation(lead, `Error Gemini: ${err.message}`);
  }
}
