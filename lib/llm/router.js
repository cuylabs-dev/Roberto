/**
 * Router multi-proveedor: Gemini + Guantelete (Cohere, Cloudflare, Cerebras, etc.)
 */
import { config } from "../config.js";
import { generateContent as geminiGenerate, GeminiQuotaError } from "../geminiClient.js";
import { chatCompletion } from "./openaiCompatible.js";
import { isQuotaError, LlmQuotaError } from "./errors.js";
import {
  runCohere,
  runCloudflare,
  runCerebras,
  runSambaNova,
  runAi21,
  runGithubModels,
} from "./providers.js";

let quotaWarned = false;

export function resetLlmRouter() {
  quotaWarned = false;
}

export function wasLlmQuotaExhausted() {
  return quotaWarned;
}

/** @typedef {'vision'|'audit'|'copy'|'sections'|'longcontext'} LlmTask */

const CHAINS = {
  balanced: {
    vision: [
      { provider: "gemini" },
      { provider: "openrouter", model: "google/gemini-2.0-flash-lite" },
    ],
    audit: [
      { provider: "cerebras", model: "gpt-oss-120b" },
      { provider: "cohere", model: "command-r-plus-08-2024" },
      { provider: "groq", model: "llama-3.1-8b-instant" },
      { provider: "cloudflare", model: "@cf/meta/llama-3.1-8b-instruct" },
      { provider: "github", model: "gpt-4o-mini" },
      { provider: "gemini" },
      { provider: "ai21", model: "jamba-1.5-large" },
      { provider: "sambanova", model: "Meta-Llama-3.1-8B-Instruct" },
    ],
    copy: [
      { provider: "gemini" },
      { provider: "github", model: "gpt-4o-mini" },
      { provider: "cohere", model: "command-r-plus-08-2024" },
      { provider: "cloudflare", model: "@cf/meta/llama-3.1-8b-instruct" },
      { provider: "groq", model: "llama-3.1-8b-instant" },
      { provider: "cerebras", model: "gpt-oss-120b" },
      { provider: "sambanova", model: "Meta-Llama-3.1-8B-Instruct" },
    ],
    sections: [
      { provider: "github", model: "gpt-4o-mini" },
      { provider: "cohere", model: "command-r-plus-08-2024" },
      { provider: "cloudflare", model: "@cf/meta/llama-3.1-8b-instruct" },
      { provider: "groq", model: "llama-3.1-8b-instant" },
      { provider: "cerebras", model: "gpt-oss-120b" },
      { provider: "gemini" },
      { provider: "sambanova", model: "Meta-Llama-3.1-8B-Instruct" },
    ],
    longcontext: [
      { provider: "ai21", model: "jamba-1.5-large" },
      { provider: "cloudflare", model: "@cf/meta/llama-3.1-8b-instruct" },
      { provider: "gemini" },
      { provider: "cohere", model: "command-r-plus-08-2024" },
      { provider: "sambanova", model: "Meta-Llama-3.1-8B-Instruct" },
    ],
  },
  fast: {
    vision: [{ provider: "gemini" }, { provider: "cerebras" }],
    audit: [
      { provider: "cerebras" },
      { provider: "groq", model: "llama-3.1-8b-instant" },
      { provider: "cloudflare" },
    ],
    copy: [{ provider: "groq" }, { provider: "github" }, { provider: "gemini" }],
    sections: [{ provider: "groq" }, { provider: "github" }],
    longcontext: [{ provider: "ai21" }, { provider: "cerebras" }],
  },
  quality: {
    vision: [{ provider: "gemini" }, { provider: "openrouter", model: "google/gemini-2.0-flash" }],
    audit: [
      { provider: "gemini" },
      { provider: "cohere" },
      { provider: "ai21", model: "jamba-1.5-large" },
      { provider: "sambanova", model: "Meta-Llama-3.1-8B-Instruct" },
    ],
    copy: [{ provider: "gemini" }, { provider: "github" }, { provider: "openrouter" }],
    sections: [{ provider: "gemini" }, { provider: "github" }],
    longcontext: [{ provider: "ai21" }, { provider: "gemini" }],
  },
};

function providerAvailable(provider) {
  switch (provider) {
    case "gemini":
      return config.geminiApiKeys.length > 0;
    case "groq":
      return Boolean(config.groqApiKey);
    case "openrouter":
      return Boolean(config.openRouterApiKey);
    case "mistral":
      return Boolean(config.mistralApiKey);
    case "cohere":
      return Boolean(config.cohereApiKey);
    case "cloudflare":
      return Boolean(config.cloudflareAccountId && config.cloudflareAiToken);
    case "cerebras":
      return Boolean(config.cerebrasApiKey);
    case "sambanova":
      return Boolean(config.sambaNovaApiKey);
    case "ai21":
      return Boolean(config.ai21ApiKey);
    case "github":
      return Boolean(config.githubToken);
    default:
      return false;
  }
}

function getChain(task) {
  const mode = config.llmRouterMode in CHAINS ? config.llmRouterMode : "balanced";
  const raw = CHAINS[mode][task] || CHAINS.balanced[task] || [];
  const filtered = raw.filter((s) => providerAvailable(s.provider));
  return filtered.length ? filtered : raw.slice(0, 1);
}

export function getChainForTask(task) {
  return getChain(task);
}

/** Un solo proveedor de la cadena (para reintentos por calidad). */
export async function llmGenerateAt({ task, prompt, images, stepIndex = 0 }) {
  const chain = getChain(task);
  const step = chain[stepIndex];
  if (!step) throw new Error(`Sin proveedor LLM para ${task} idx ${stepIndex}`);
  return runStep(step, prompt, images);
}

async function runGemini(prompt, images) {
  try {
    const parts = images?.length ? [{ text: prompt }, ...images] : prompt;
    const out = await geminiGenerate(parts);
    if (!out?.text) throw new LlmQuotaError("Gemini sin respuesta");
    return { text: out.text, model: out.model, provider: "gemini", keyIndex: out.keyIndex };
  } catch (err) {
    if (err instanceof GeminiQuotaError || err instanceof LlmQuotaError) throw new LlmQuotaError();
    throw err;
  }
}

async function runGroq(prompt, images, model) {
  if (!config.groqApiKey) throw new Error("Sin GROQ_API_KEY");
  const out = await chatCompletion({
    apiKey: config.groqApiKey,
    baseUrl: "https://api.groq.com/openai/v1",
    model: model || "llama-3.1-8b-instant",
    prompt,
    images,
  });
  return { ...out, provider: "groq" };
}

async function runOpenRouter(prompt, images, model) {
  if (!config.openRouterApiKey) throw new Error("Sin OPENROUTER_API_KEY");
  const out = await chatCompletion({
    apiKey: config.openRouterApiKey,
    baseUrl: "https://openrouter.ai/api/v1",
    model: model || "meta-llama/llama-3.1-8b-instruct:free",
    prompt,
    images,
    extraHeaders: {
      "HTTP-Referer": config.factoriaBaseUrl,
      "X-Title": "Investigador Prospectos",
    },
  });
  return { ...out, provider: "openrouter" };
}

async function runMistral(prompt, images, model) {
  if (!config.mistralApiKey) throw new Error("Sin MISTRAL_API_KEY");
  const out = await chatCompletion({
    apiKey: config.mistralApiKey,
    baseUrl: "https://api.mistral.ai/v1",
    model: model || "mistral-small-latest",
    prompt,
    images,
  });
  return { ...out, provider: "mistral" };
}

async function runStep(step, prompt, images) {
  switch (step.provider) {
    case "gemini":
      return runGemini(prompt, images);
    case "groq":
      return runGroq(prompt, images, step.model);
    case "openrouter":
      return runOpenRouter(prompt, images, step.model);
    case "mistral":
      return runMistral(prompt, images, step.model);
    case "cohere":
      return runCohere(prompt, images, step.model);
    case "cloudflare":
      return runCloudflare(prompt, images, step.model);
    case "cerebras":
      return runCerebras(prompt, images, step.model);
    case "sambanova":
      return runSambaNova(prompt, images, step.model);
    case "ai21":
      return runAi21(prompt, images, step.model);
    case "github":
      return runGithubModels(prompt, images, step.model);
    default:
      throw new Error(`Proveedor desconocido: ${step.provider}`);
  }
}

/**
 * @param {{ task: LlmTask, prompt: string, images?: object[] }} opts
 */
export async function llmGenerate({ task, prompt, images }) {
  const chain = getChain(task);
  let lastErr = null;

  for (let i = 0; i < chain.length; i++) {
    const step = chain[i];
    try {
      const result = await runStep(step, prompt, images);
      if (i > 0) {
        console.log(`   LLM [${task}]: fallback → ${result.provider}/${result.model}`);
      }
      return result;
    } catch (err) {
      lastErr = err;
      if (isQuotaError(err) && i < chain.length - 1) {
        console.log(
          `   LLM [${task}]: ${step.provider} sin cuota → probando ${chain[i + 1].provider}...`,
        );
        continue;
      }
      if (i < chain.length - 1) {
        console.log(`   LLM [${task}]: ${step.provider} fallo → ${chain[i + 1].provider}...`);
        continue;
      }
    }
  }

  if (!quotaWarned) {
    quotaWarned = true;
    console.log(`   LLM: todos los proveedores agotados para tarea "${task}". Usando fallback local.`);
  }
  throw lastErr instanceof LlmQuotaError ? lastErr : new LlmQuotaError(lastErr?.message);
}

export async function generateContent(parts) {
  const prompt = typeof parts === "string" ? parts : parts.find((p) => p.text)?.text || "";
  const images = Array.isArray(parts) ? parts.filter((p) => p.inlineData) : [];
  const task = images.length ? "vision" : "copy";
  try {
    return await llmGenerate({ task, prompt, images });
  } catch (err) {
    if (err instanceof LlmQuotaError) throw err;
    throw err;
  }
}
