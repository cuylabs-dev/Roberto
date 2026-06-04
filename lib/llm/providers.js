/**
 * Adapters Guantelete (APIs gratuitas) — OpenAI-compatible o REST nativo.
 */
import { config } from "../config.js";
import { chatCompletion } from "./openaiCompatible.js";

export async function runCohere(prompt, images, model) {
  if (!config.cohereApiKey) throw new Error("Sin COHERE_API_KEY");
  const res = await fetch("https://api.cohere.com/v2/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.cohereApiKey}`,
    },
    body: JSON.stringify({
      model: model || "command-r-plus-08-2024",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2048,
      temperature: 0.5,
    }),
  });
  const body = await res.text();
  if (!res.ok) {
    const err = new Error(`Cohere HTTP ${res.status}: ${body.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const json = JSON.parse(body);
  const text = json.message?.content?.[0]?.text ?? json.text;
  if (!text) throw new Error("Cohere sin contenido");
  return { text: String(text).trim(), model: model || "command-r-plus", provider: "cohere" };
}

export async function runCloudflare(prompt, _images, model) {
  if (!config.cloudflareAccountId || !config.cloudflareAiToken) {
    throw new Error("Sin CLOUDFLARE_ACCOUNT_ID o CLOUDFLARE_AI_API_TOKEN");
  }
  const m = model || "@cf/meta/llama-3.1-8b-instruct";
  const url = `https://api.cloudflare.com/client/v4/accounts/${config.cloudflareAccountId}/ai/v1/chat/completions`;
  const out = await chatCompletion({
    apiKey: config.cloudflareAiToken,
    baseUrl: url.replace(/\/chat\/completions$/, ""),
    model: m,
    prompt,
    maxTokens: 2048,
    extraHeaders: {},
  });
  return { ...out, provider: "cloudflare" };
}

export async function runCerebras(prompt, images, model) {
  if (!config.cerebrasApiKey) throw new Error("Sin CEREBRAS_API_KEY");
  const out = await chatCompletion({
    apiKey: config.cerebrasApiKey,
    baseUrl: "https://api.cerebras.ai/v1",
    model: model || "gpt-oss-120b",
    prompt,
    images,
  });
  return { ...out, provider: "cerebras" };
}

export async function runSambaNova(prompt, images, model) {
  if (!config.sambaNovaApiKey) throw new Error("Sin SAMBANOVA_API_KEY");
  const out = await chatCompletion({
    apiKey: config.sambaNovaApiKey,
    baseUrl: "https://api.sambanova.ai/v1",
    model: model || "Meta-Llama-3.1-8B-Instruct",
    prompt,
    images,
    maxTokens: 4096,
  });
  return { ...out, provider: "sambanova" };
}

export async function runAi21(prompt, _images, model) {
  if (!config.ai21ApiKey) throw new Error("Sin AI21_API_KEY");
  const m = model || "jamba-1.5-large";
  const res = await fetch("https://api.ai21.com/studio/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.ai21ApiKey}`,
    },
    body: JSON.stringify({
      model: m,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4096,
      temperature: 0.5,
    }),
  });
  const body = await res.text();
  if (!res.ok) {
    const err = new Error(`AI21 HTTP ${res.status}: ${body.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const json = JSON.parse(body);
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new Error("AI21 sin contenido");
  return { text: String(text).trim(), model: m, provider: "ai21" };
}

export async function runGithubModels(prompt, images, model) {
  if (!config.githubToken) throw new Error("Sin GITHUB_TOKEN");
  const out = await chatCompletion({
    apiKey: config.githubToken,
    baseUrl: "https://models.inference.ai.azure.com",
    model: model || "gpt-4o-mini",
    prompt,
    images,
    extraHeaders: { "User-Agent": "Investigador-Prospectos" },
  });
  return { ...out, provider: "github" };
}
