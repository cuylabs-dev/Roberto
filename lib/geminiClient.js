// Cliente Gemini — modelos vigentes + rotacion de API keys si una se queda sin cuota.
import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "./config.js";

const MODEL_CANDIDATES = ["gemini-2.0-flash", "gemini-2.0-flash-lite"];

let quotaWarned = false;
let activeKeyIndex = 0;

export function resetGeminiWarnings() {
  quotaWarned = false;
  activeKeyIndex = 0;
}

export function wasQuotaWarned() {
  return quotaWarned;
}

function modelList() {
  return [config.geminiModel, ...MODEL_CANDIDATES].filter(
    (m, i, a) => m && a.indexOf(m) === i,
  );
}

function isModelGone(err) {
  const m = String(err?.message || err);
  return m.includes("404") || m.includes("not found") || m.includes("is not supported");
}

function isQuota(err) {
  const m = String(err?.message || err);
  return m.includes("429") || m.includes("quota") || m.includes("RESOURCE_EXHAUSTED");
}

export class GeminiQuotaError extends Error {
  constructor(message) {
    super(message);
    this.name = "GeminiQuotaError";
  }
}

async function tryWithKey(apiKey, parts) {
  const genAI = new GoogleGenerativeAI(apiKey);
  let lastErr = null;

  for (const modelName of modelList()) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(parts);
      const text = result.response.text();
      if (text) return { ok: true, text, model: modelName };
    } catch (err) {
      lastErr = err;
      if (isQuota(err)) return { ok: false, quota: true, lastErr: err };
      if (isModelGone(err)) continue;
    }
  }
  return { ok: false, quota: false, lastErr };
}

/**
 * @returns {{ text: string, model: string, keyIndex: number } | null}
 */
export async function generateContent(parts) {
  const keys = config.geminiApiKeys;
  if (!keys.length) return null;

  for (let ki = activeKeyIndex; ki < keys.length; ki++) {
    const result = await tryWithKey(keys[ki], parts);

    if (result.ok) {
      activeKeyIndex = ki;
      return { text: result.text, model: result.model, keyIndex: ki };
    }

    if (result.quota && ki < keys.length - 1) {
      console.log(`   Gemini: API key #${ki + 1} sin cuota → cambiando a key #${ki + 2}...`);
      activeKeyIndex = ki + 1;
      continue;
    }

    if (result.quota) break;
    if (result.lastErr) throw result.lastErr;
  }

  if (!quotaWarned) {
    quotaWarned = true;
    console.log(
      `   Gemini: las ${keys.length} API key(s) sin cuota (429). Textos y colores LOCALES por negocio.`,
    );
  }
  throw new GeminiQuotaError("Cuota agotada en todas las API keys");
}
