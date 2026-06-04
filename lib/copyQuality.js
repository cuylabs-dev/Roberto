/**
 * Validacion anti-copy generico + reintentos LLM.
 */
import { llmGenerateAt, getChainForTask } from "./llm/router.js";
import { LlmQuotaError } from "./llm/errors.js";
import { buildLeadContextBlock, COPY_STRICT_RULES } from "./leadContext.js";

const BANNED_RE =
  /servicio\s*(principal|\d|uno|dos|tres|1|2|3)\b|producto\s*\d|item\s*\d|plan\s*\d\b|placeholder|lorem\s+ipsum|texto\s+de\s+ejemplo|nombre\s+del\s+negocio|tu\s+negocio\b|servicio\s+gen[eé]rico|consulta\s+general\s*$|l[ií]der\s+en\s+su\s+industria|per[uú]\s+y\s+latam|contribuimos\s+a\s+mejorar\s+vidas|d[eé]cadas\s+de\s+experiencia|presencia\s+regional|\+500\s+colaboradores|pa[ií]ses\s+con\s+operaci[oó]n|l[ií]neas\s+de\s+negocio|portafolio\s+que\s+ampl[ií]a|referente\s+en\s+nuestro\s+sector|transformaci[oó]n\s+digital\s+al\s+servicio|sostenibilidad\s+integrada|venture\s+para\s+escalar|servicios\s+integrales\s+de\s+salud|plena\s+recuperaci[oó]n|equipo\s+multidisciplinario|consultor[ií]a que entiende tu operaci[oó]n|diagn[oó]stico, ejecuci[oó]n y acompañamiento|claridad, velocidad y resultados medibles|sin plantillas gen[eé]ricas/i;

export function isGenericCopy(text) {
  if (!text || typeof text !== "string") return true;
  const t = text.trim();
  if (t.length < 3) return true;
  return BANNED_RE.test(t);
}

export function sectionsCopyIsGeneric(sectionsCopy) {
  if (!sectionsCopy || typeof sectionsCopy !== "object") return true;
  const texts = [];
  const walk = (o) => {
    if (typeof o === "string") texts.push(o);
    else if (Array.isArray(o)) o.forEach(walk);
    else if (o && typeof o === "object") Object.values(o).forEach(walk);
  };
  walk(sectionsCopy);
  if (!texts.length) return true;
  const bad = texts.filter((t) => isGenericCopy(t));
  return bad.length > 0;
}

export function copyFieldsAreGeneric(parsed) {
  if (!parsed) return true;
  const fields = [
    parsed.headline,
    parsed.subhead,
    parsed.eyebrow,
    parsed.pitch_angle,
    parsed.wa_text,
  ];
  return fields.some((f) => isGenericCopy(f));
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

/**
 * Genera texto JSON validado; rota proveedores si el output es generico.
 */
export async function llmGenerateValidatedJson({ task, buildPrompt, validate, maxSteps = 8 }) {
  const chain = getChainForTask(task);
  let lastRaw = null;
  const limit = Math.min(maxSteps, chain.length);

  for (let i = 0; i < limit; i++) {
    const prompt =
      i > 0
        ? `${buildPrompt()}\n\nRECHAZO PREVIO: salida generica o invalida. Reescribe con servicios REALES del rubro. ${COPY_STRICT_RULES}`
        : buildPrompt();

    try {
      const out = await llmGenerateAt({ task, prompt, stepIndex: i });
      lastRaw = out;
      const parsed = safeParseJson(out?.text);
      if (parsed && validate(parsed)) {
        return { parsed, llm_meta: { provider: out.provider, model: out.model } };
      }
    } catch (err) {
      if (err instanceof LlmQuotaError) continue;
    }
  }
  return { parsed: null, llm_meta: lastRaw ? { provider: lastRaw.provider, model: lastRaw.model } : null };
}

export function wrapCopyPrompt(lead, body) {
  return `${COPY_STRICT_RULES}\n\n${buildLeadContextBlock(lead)}\n\n${body}`;
}
