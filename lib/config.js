import "dotenv/config";

// ---- Enums cerrados (deben coincidir EXACTO con la factoria Vercel) --------
export const TEMPLATES = ["clinicas", "corporativo", "gimnasios", "colegios", "tiendas"];
export const COLORS = ["blue", "green", "red", "violet", "orange", "slate"];
export const FONTS = ["inter", "roboto", "poppins", "montserrat"];
export const BLOCKS = ["login", "reservas", "ecommerce", "galeria"];

export const DEFAULTS = {
  template: "corporativo",
  color: "blue",
  font: "inter",
};

function required(name) {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`Falta la variable de entorno ${name}. Revisa tu .env`);
  }
  return v.trim();
}

/** Una o mas API keys; si la primera llega a cuota (429), usa la siguiente. */
function parseGeminiApiKeys() {
  const keys = [];
  const list = process.env.GEMINI_API_KEYS?.trim();
  if (list) {
    list.split(",").map((k) => k.trim()).filter(Boolean).forEach((k) => keys.push(k));
  }
  const k1 = process.env.GEMINI_API_KEY?.trim();
  const k2 = process.env.GEMINI_API_KEY_2?.trim();
  if (k1 && !keys.includes(k1)) keys.push(k1);
  if (k2 && !keys.includes(k2)) keys.push(k2);
  return keys;
}

function hasAnyLlmKey() {
  return (
    parseGeminiApiKeys().length > 0 ||
    Boolean(process.env.GROQ_API_KEY?.trim()) ||
    Boolean(process.env.OPENROUTER_API_KEY?.trim()) ||
    Boolean(process.env.MISTRAL_API_KEY?.trim()) ||
    Boolean(process.env.COHERE_API_KEY?.trim()) ||
    Boolean(process.env.CEREBRAS_API_KEY?.trim()) ||
    Boolean(process.env.SAMBANOVA_API_KEY?.trim()) ||
    Boolean(process.env.AI21_API_KEY?.trim()) ||
    Boolean(process.env.GITHUB_TOKEN?.trim()) ||
    (Boolean(process.env.CLOUDFLARE_ACCOUNT_ID?.trim()) &&
      Boolean(process.env.CLOUDFLARE_AI_API_TOKEN?.trim()))
  );
}

export const config = {
  geminiApiKeys: parseGeminiApiKeys(),
  /** Primera key (compatibilidad con codigo viejo). */
  get geminiApiKey() {
    return this.geminiApiKeys[0] || "";
  },
  geminiModel: process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash",
  groqApiKey: process.env.GROQ_API_KEY?.trim() || "",
  openRouterApiKey: process.env.OPENROUTER_API_KEY?.trim() || "",
  mistralApiKey: process.env.MISTRAL_API_KEY?.trim() || "",
  cohereApiKey: process.env.COHERE_API_KEY?.trim() || "",
  cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || "",
  cloudflareAiToken: process.env.CLOUDFLARE_AI_API_TOKEN?.trim() || "",
  cerebrasApiKey: process.env.CEREBRAS_API_KEY?.trim() || "",
  sambaNovaApiKey: process.env.SAMBANOVA_API_KEY?.trim() || "",
  ai21ApiKey: process.env.AI21_API_KEY?.trim() || "",
  githubToken: process.env.GITHUB_TOKEN?.trim() || "",
  llmRouterMode: (process.env.LLM_ROUTER_MODE?.trim() || "balanced").toLowerCase(),
  blobReadWriteToken: process.env.BLOB_READ_WRITE_TOKEN?.trim() || "",
  kitPublicBaseUrl: (process.env.KIT_PUBLIC_BASE_URL?.trim() || "").replace(/\/+$/, ""),
  supabaseUrl: process.env.SUPABASE_URL?.trim() || "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY?.trim() || "",
  supabaseBucket: process.env.SUPABASE_KITS_BUCKET?.trim() || "brand-kits",
  notionToken: process.env.NOTION_TOKEN?.trim() || "",
  notionDatabaseId: process.env.NOTION_DATABASE_ID?.trim() || "",
  factoriaBaseUrl: (
    process.env.FACTORIA_BASE_URL?.trim() || "https://plantillas-web-maestra-final.vercel.app"
  ).replace(/\/+$/, ""),
  // single = solo SEARCH_QUERY | balance = reparte igual (2-2-2-2-2 si son 10) | random = al azar
  searchMode: (process.env.SEARCH_MODE?.trim() || "balance").toLowerCase(),
  searchQuery: process.env.SEARCH_QUERY?.trim() || "",
  leadsPerDay: parseInt(process.env.LEADS_PER_DAY || "20", 10),
  nichoNotion: process.env.NICHO_NOTION?.trim() || "",
  chromeUserDataDir: process.env.CHROME_USER_DATA_DIR?.trim() || "",
  chromeProfileDirectory: process.env.CHROME_PROFILE_DIRECTORY?.trim() || "Default",
  // Carpeta del proyecto en Obsidian donde vive la memoria local (anti-repeticion).
  obsidianDbDir: process.env.OBSIDIAN_DB_DIR?.trim() || "",
  // Navegador en segundo plano. HEADLESS=false para verlo (debug).
  headless: (process.env.HEADLESS?.trim() || "true").toLowerCase() !== "false",
  qualifyMinScore: parseInt(process.env.QUALIFY_MIN_SCORE || "65", 10),
  qualifyOversample: Math.max(2, parseInt(process.env.QUALIFY_OVERSAMPLE || "4", 10)),
  qualifyFetchTimeoutMs: parseInt(process.env.QUALIFY_FETCH_TIMEOUT_MS || "8000", 10),
};

// Valida solo lo necesario segun el modo de ejecucion.
export function assertConfig({ dryRun }) {
  if (!hasAnyLlmKey()) {
    throw new Error(
      "Falta al menos una API LLM (Gemini, Groq, Guantelete: Cohere/Cerebras/Cloudflare/GitHub, etc.). Ver .env.example",
    );
  }
  if (!dryRun) {
    required("NOTION_TOKEN");
    required("NOTION_DATABASE_ID");
  }
}

export function clampEnum(value, allowed, fallback) {
  if (typeof value !== "string") return fallback;
  const clean = value.trim().toLowerCase();
  return allowed.includes(clean) ? clean : fallback;
}
