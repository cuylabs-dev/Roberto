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

export const config = {
  geminiApiKey: process.env.GEMINI_API_KEY?.trim() || "",
  geminiModel: process.env.GEMINI_MODEL?.trim() || "gemini-1.5-flash",
  notionToken: process.env.NOTION_TOKEN?.trim() || "",
  notionDatabaseId: process.env.NOTION_DATABASE_ID?.trim() || "",
  factoriaBaseUrl: (process.env.FACTORIA_BASE_URL?.trim() || "https://plantillas-web-maestra.vercel.app").replace(/\/+$/, ""),
  searchQuery: process.env.SEARCH_QUERY?.trim() || "gimnasios Lima",
  leadsPerDay: parseInt(process.env.LEADS_PER_DAY || "10", 10),
  nichoNotion: process.env.NICHO_NOTION?.trim() || "",
  chromeUserDataDir: process.env.CHROME_USER_DATA_DIR?.trim() || "",
  chromeProfileDirectory: process.env.CHROME_PROFILE_DIRECTORY?.trim() || "Default",
};

// Valida solo lo necesario segun el modo de ejecucion.
export function assertConfig({ dryRun }) {
  required("GEMINI_API_KEY");
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
