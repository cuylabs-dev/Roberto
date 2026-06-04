/**
 * Prueba cada proveedor del Guantelete con un ping mínimo.
 * Uso: node scripts/test-guantelete.js
 */
import "dotenv/config";
import { config } from "../lib/config.js";
import { llmGenerate, resetLlmRouter } from "../lib/llm/router.js";

const PROMPT = 'Responde SOLO JSON: {"ok":true,"provider":"test"}';

const TASK_PROBES = [
  { task: "audit", providers: ["cerebras", "cohere", "cloudflare", "github", "gemini", "ai21", "sambanova"] },
  { task: "copy", providers: ["gemini", "github", "cohere"] },
  { task: "sections", providers: ["github", "cohere"] },
];

function configured(name) {
  const map = {
    gemini: config.geminiApiKeys.length > 0,
    groq: Boolean(config.groqApiKey),
    cohere: Boolean(config.cohereApiKey),
    cloudflare: Boolean(config.cloudflareAccountId && config.cloudflareAiToken),
    cerebras: Boolean(config.cerebrasApiKey),
    sambanova: Boolean(config.sambaNovaApiKey),
    ai21: Boolean(config.ai21ApiKey),
    github: Boolean(config.githubToken),
  };
  return map[name] ?? false;
}

async function probeTask(task) {
  resetLlmRouter();
  try {
    const out = await llmGenerate({ task, prompt: PROMPT });
    return { ok: true, provider: out.provider, model: out.model };
  } catch (e) {
    return { ok: false, error: String(e.message).split("\n")[0] };
  }
}

async function main() {
  console.log("=== Test Guantelete ===\n");
  console.log("Configurado:");
  for (const p of ["gemini", "cohere", "cerebras", "cloudflare", "github", "ai21", "sambanova", "groq"]) {
    console.log(`  ${configured(p) ? "OK " : "NO "} ${p}`);
  }
  if (!config.cloudflareAccountId) {
    console.log("\n  AVISO: falta CLOUDFLARE_ACCOUNT_ID en .env (Workers AI no arranca)\n");
  }

  for (const { task } of TASK_PROBES) {
    const r = await probeTask(task);
    if (r.ok) console.log(`OK  [${task}] → ${r.provider}/${r.model}`);
    else console.log(`FAIL [${task}] ${r.error}`);
  }

  console.log("\n=== Fin ===");
}

main();
