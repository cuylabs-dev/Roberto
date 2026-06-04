// ============================================================================
// brand.js — Identidad por negocio: color, variante de layout, copy local.
// ============================================================================

import { config } from "./config.js";
import { llmGenerate } from "./llm/router.js";
import { LlmQuotaError } from "./llm/errors.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function norm(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function normalizeHex(hex) {
  if (!hex || typeof hex !== "string") return null;
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return h.toLowerCase();
}

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const R = Math.round(255 * f(0));
  const G = Math.round(255 * f(8));
  const B = Math.round(255 * f(4));
  return [R, G, B].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** Color unico y estable por nombre (nunca el mismo rojo para todos). */
export function hashColorFromName(name) {
  const s = norm(name) || "negocio";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  const sat = 52 + (h % 28);
  const light = 38 + (h % 14);
  return hslToHex(hue, sat, light);
}

const NAME_BRAND_RULES = [
  { re: /baransu/i, primary: "f97316", variant: "fit" },
  { re: /bunker/i, primary: "1e293b", variant: "fit" },
  { re: /triumph|fight|mma|boxeo|muay|combat|spartakus|warrior/i, primary: "1e3a8a", variant: "fight" },
  { re: /crossfit|cross fit|wod|cf /i, primary: "ea580c", variant: "crossfit" },
  { re: /orange|theory|hiit|cycle/i, primary: "f97316", variant: "studio" },
  { re: /yoga|pilates|wellness|zen|spa gym/i, primary: "059669", variant: "wellness" },
  { re: /matrix|premium|elite|platinum|gold gym/i, primary: "7c3aed", variant: "premium" },
  { re: /trim|body|factory|iron|steel|power/i, primary: "0f766e", variant: "fit" },
  { re: /b2|aarmy|colonia|maes/i, primary: "2563eb", variant: "fit" },
];

const TEMPLATE_VARIANT = {
  gimnasios: "fit",
  colegios: "classic",
  clinicas: "care",
  tiendas: "shop",
  corporativo: "corp",
};

/** Color + variante de layout segun nombre del negocio. */
export function inferBrandFromName(name, template) {
  const n = norm(name);
  for (const rule of NAME_BRAND_RULES) {
    if (rule.re.test(n)) {
      return {
        brand_primary: rule.primary,
        variant: rule.variant,
        brandLocked: true,
      };
    }
  }
  return {
    brand_primary: hashColorFromName(name),
    variant: TEMPLATE_VARIANT[template] || "fit",
    brandLocked: false,
  };
}

export function nearestColorEnum(hex) {
  const palettes = {
    blue: "2563eb",
    green: "059669",
    red: "dc2626",
    violet: "7c3aed",
    orange: "ea580c",
    slate: "475569",
  };
  const h = normalizeHex(hex);
  if (!h) return "slate";
  const tr = parseInt(h.slice(0, 2), 16);
  const tg = parseInt(h.slice(2, 4), 16);
  const tb = parseInt(h.slice(4, 6), 16);
  if (tr > 180 && tg < 120 && tb < 120) return "orange";
  if (tr < 80 && tg < 80 && tb < 80) return "slate";
  if (tg > tr && tg > tb) return "green";
  let best = "slate";
  let bestD = Infinity;
  for (const [key, ref] of Object.entries(palettes)) {
    const rr = parseInt(ref.slice(0, 2), 16);
    const rg = parseInt(ref.slice(2, 4), 16);
    const rb = parseInt(ref.slice(4, 6), 16);
    const d = (tr - rr) ** 2 + (tg - rg) ** 2 + (tb - rb) ** 2;
    if (d < bestD) {
      bestD = d;
      best = key;
    }
  }
  return best;
}

/** Copy local por rubro + negocio (siempre disponible, sin API). */
export function localCopyFor(lead, template, variant) {
  const name = lead.name || "Tu negocio";
  const short = name.split(/[-|]/)[0].trim();

  const gym = {
    fight: {
      headline: `${short}: fight night y técnica de campeones`,
      subhead: `Tecnica, potencia y coaches con experiencia real. En ${name} cada sesion cuenta.`,
      eyebrow: "Artes marciales · Lima",
    },
    crossfit: {
      headline: `Tu proximo WOD empieza en ${short}`,
      subhead: `Fuerza, resistencia y comunidad. Coaches certificados y ambiente que te exige mas.`,
      eyebrow: "Box funcional",
    },
    wellness: {
      headline: `Encuentra tu equilibrio en ${short}`,
      subhead: `Clases que cuidan tu cuerpo y tu mente. Espacios amplios y horarios que se adaptan a ti.`,
      eyebrow: "Bienestar activo",
    },
    premium: {
      headline: `Experiencia premium en ${short}`,
      subhead: `Equipamiento de primer nivel, coaches dedicados y un club pensado para resultados.`,
      eyebrow: "Fitness de alto nivel",
    },
    fit: {
      headline: `Tu mejor version empieza en ${short}`,
      subhead: `Entrena con plan, seguimiento y un equipo que te acompana en cada repeticion.`,
      eyebrow: `${short} · Gimnasio`,
    },
  };

  const byTemplate = {
    gimnasios: gym[variant] || gym.fit,
    colegios: {
      headline: `Formacion integral en ${short}`,
      subhead: `Excelencia academica, valores y una comunidad que acompana a cada familia.`,
      eyebrow: "Admision abierta",
    },
    clinicas: {
      headline: `Cuidado profesional en ${short}`,
      subhead: `Atencion humana, tecnologia y resultados que puedes sentir desde la primera visita.`,
      eyebrow: "Salud integral",
    },
    tiendas: {
      headline: `Todo lo que buscas en ${short}`,
      subhead: `Productos seleccionados, atencion cercana y compra facil en tienda o en linea.`,
      eyebrow: "Compra hoy",
    },
    corporativo: {
      headline: `${short} impulsa tu operacion`,
      subhead: `Soluciones claras, equipo experto y resultados medibles para tu empresa.`,
      eyebrow: "Servicios B2B",
    },
  };

  const pack = byTemplate[template] || byTemplate.corporativo;
  return {
    headline: pack.headline,
    subhead: pack.subhead,
    eyebrow: pack.eyebrow,
    wa_text: `Hola, vi ${name} y prepare una maqueta web con los colores y estilo de tu marca. Te la comparto sin compromiso — te va a gustar verla.`,
  };
}

/** Identidad base antes de Vision / Gemini. */
export function resolveBrandIdentity(lead, template) {
  const { brand_primary, variant, brandLocked } = inferBrandFromName(lead.name, template);
  const copy = localCopyFor(lead, template, variant);
  return {
    brand_primary,
    variant,
    brandLocked,
    color: nearestColorEnum(brand_primary),
    ...copy,
  };
}

export function paletteFromPrimary(hex) {
  const n = normalizeHex(hex);
  if (!n) return null;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const toHex = (R, G, B) =>
    `#${[R, G, B]
      .map((x) => Math.min(255, Math.max(0, Math.round(x))).toString(16).padStart(2, "0"))
      .join("")}`;
  const tint = (w) => toHex(r + (255 - r) * w, g + (255 - g) * w, b + (255 - b) * w);
  const shade = (f) => toHex(r * f, g * f, b * f);
  return { 50: tint(0.92), 100: tint(0.85), 500: `#${n}`, 600: shade(0.88), 700: shade(0.72) };
}

export async function extractLogoFromPage(page) {
  const og = await page
    .locator('meta[property="og:image"], meta[property="og:image:url"]')
    .first()
    .getAttribute("content")
    .catch(() => null);
  if (og && og.startsWith("http") && !og.includes("emoji")) return og;
  const tw = await page
    .locator('meta[name="twitter:image"]')
    .first()
    .getAttribute("content")
    .catch(() => null);
  if (tw && tw.startsWith("http")) return tw;
  const img = await page
    .locator(
      'img[src*="scontent"], img[src*="fbcdn"], img[alt*="profile" i], img[data-testid="profile_picture"], header img',
    )
    .first()
    .getAttribute("src")
    .catch(() => null);
  if (img && img.startsWith("http")) return img;
  return null;
}

export async function fetchImageBase64(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "image/*" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") || "image/jpeg").split(";")[0];
    if (!ct.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 200 || buf.length > 3_500_000) return null;
    return { data: buf.toString("base64"), mimeType: ct };
  } catch {
    return null;
  }
}

const VISION_PROMPT = (lead, rubro) => `Analiza la imagen del negocio "${lead.name}" (rubro: ${rubro}) en Peru.
Extrae el color DOMINANTE de su marca (no blanco/negro/gris neutro).
Devuelve SOLO JSON:
{
  "primary": "#RRGGBB",
  "headline": "titular unico para ESTE negocio, max 60 chars",
  "subhead": "frase de valor, max 140 chars",
  "eyebrow": "etiqueta corta, max 30 chars"
}`;

export async function analyzeBrandFromLogo(logoUrl, lead, rubro) {
  if (!logoUrl || !config.geminiApiKey) return null;
  const img = await fetchImageBase64(logoUrl);
  if (!img) return null;
  try {
    const out = await llmGenerate({
      task: "vision",
      prompt: VISION_PROMPT(lead, rubro),
      images: [{ inlineData: { mimeType: img.mimeType, data: img.data } }],
    });
    if (!out?.text) return null;
    const raw = out.text;
    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    const primary = normalizeHex(parsed.primary);
    if (!primary) return null;
    return {
      brand_primary: primary,
      headline: typeof parsed.headline === "string" ? parsed.headline.trim() : "",
      subhead: typeof parsed.subhead === "string" ? parsed.subhead.trim() : "",
      eyebrow: typeof parsed.eyebrow === "string" ? parsed.eyebrow.trim() : "",
    };
  } catch (err) {
    if (err instanceof LlmQuotaError) throw err;
    return null;
  }
}

export function logoForUrl(url) {
  if (!url || typeof url !== "string") return null;
  const u = url.trim();
  if (!u.startsWith("https://")) return null;
  if (u.length > 480) return null;
  return u;
}
