/**
 * Google Search: verifica web/correo cuando Maps no muestra sitio.
 */
import { chromium } from "playwright";
import { extractDomain, isSocialOnlyUrl } from "./urlHosts.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const JUNK_EMAIL =
  /^(noreply|no-reply|soporte|support|info@google|mail@google|postmaster|wixpress|sentry)/i;

const DIRECTORY_HOST_RE =
  /paginasamarillas|paginas-amarillas|yellowpages|yelp\.|tripadvisor|facebook\.com|instagram\.com|linkedin\.com\/company|google\.com\/maps|maps\.google|wikipedia\.org|guiadelima|datosperu|bumeran|computrabajo|indeed\.|mercadolibre|olx\.|ubereats|rappi\.|pedidosya/i;

function pickEmail(text) {
  if (!text) return null;
  const found = [...text.matchAll(EMAIL_RE)]
    .map((m) => m[0].toLowerCase())
    .filter((e) => !e.includes("google.com") && !e.includes("gstatic") && !JUNK_EMAIL.test(e));
  return found[0] || null;
}

function nameTokens(name) {
  return (name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !["lima", "peru", "surco", "miraflores"].includes(t));
}

/** Similitud flexible: no hace falta dominio idéntico al nombre. */
function domainMatchesBusiness(domain, name) {
  const tokens = nameTokens(name);
  if (!tokens.length) return false;

  const host = (domain || "").replace(/^www\./, "").toLowerCase();
  const root = host.split(".")[0].replace(/[^a-z0-9]/g, "");
  const d = host.replace(/[^a-z0-9]/g, "");
  if (root.length < 3) return false;

  const norm = (s) => s.replace(/[^a-z0-9]/g, "");

  // Token del negocio contenido en dominio (ej. talent360 + "Talent 360")
  if (tokens.some((t) => {
    const tk = norm(t);
    return tk.length >= 3 && (d.includes(tk) || root.includes(tk) || tk.includes(root.slice(0, Math.min(5, root.length))));
  })) {
    return true;
  }

  // Nombre compacto vs raíz (ej. baransugym / "Baransu Gym")
  const compact = norm(tokens.join(""));
  if (compact.length >= 4) {
    if (root.includes(compact.slice(0, 6)) || compact.includes(root.slice(0, 6))) return true;
    if (d.includes(compact.slice(0, 5))) return true;
  }

  // Prefijo de 4+ letras de alguna palabra clave
  if (tokens.some((t) => {
    const pre = norm(t).slice(0, 4);
    return pre.length >= 4 && root.startsWith(pre);
  })) {
    return true;
  }

  // Iniciales (ej. t360 para Talent 360)
  if (tokens.length >= 2) {
    const initials = tokens.map((t) => norm(t)[0]).join("");
    const withDigits = tokens.map((t) => norm(t)).join("");
    if (initials.length >= 2 && root.includes(initials)) return true;
    if (/\d/.test(withDigits) && root.includes(withDigits.replace(/\s/g, "").slice(0, 8))) return true;
  }

  return false;
}

function isDirectoryUrl(url) {
  const d = extractDomain(url);
  if (!d) return true;
  return DIRECTORY_HOST_RE.test(d) || DIRECTORY_HOST_RE.test(url);
}

/** Web propia del negocio: dominio alineado al nombre (no basta ser #1 en Google). */
function isOfficialCandidate(url, leadName) {
  if (!url?.startsWith("http")) return false;
  if (isDirectoryUrl(url)) return false;
  if (isSocialOnlyUrl(url)) return false;
  const domain = extractDomain(url);
  if (!domain || domain.includes("google.")) return false;
  return domainMatchesBusiness(domain, leadName);
}

function decodeGoogleHref(href) {
  if (!href) return null;
  if (href.startsWith("/url?")) {
    try {
      const u = new URL(`https://www.google.com${href}`);
      return u.searchParams.get("q") || u.searchParams.get("url");
    } catch {
      return null;
    }
  }
  if (href.startsWith("http")) return href;
  return null;
}

async function fetchEmailFromWebsite(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url.startsWith("http") ? url : `https://${url}`, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "text/html" },
    });
    const html = await res.text();
    const mailto = html.match(/mailto:([a-zA-Z0-9._%+-]+@[^\s"'<>]+)/i);
    if (mailto) return mailto[1].toLowerCase();
    return pickEmail(html.slice(0, 50000));
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Verifica en Google si el negocio tiene web propia (cuando Maps no la muestra).
 * @returns {Promise<{ has_official_web: boolean, website_url?: string, domain?: string, email?: string }>}
 */
export async function verifyWebPresenceOnGoogle(lead, { city = "Lima" } = {}) {
  const out = { has_official_web: false, source: "google_verify" };
  const query = `"${lead.name}" ${city} sitio web`;
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--disable-blink-features=AutomationControlled"],
    });
    const page = await browser.newPage({ userAgent: UA, locale: "es-PE" });
    await page.goto(
      `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=es-PE&num=10`,
      { waitUntil: "domcontentloaded", timeout: 35000 },
    );
    await page.waitForTimeout(1200);

    const bodyText = await page.evaluate(() => document.body?.innerText || "").catch(() => "");
    const emailFromSerp = pickEmail(bodyText);
    if (emailFromSerp) out.email = emailFromSerp;

    const hrefs = await page.evaluate(() => {
      const outH = [];
      for (const a of document.querySelectorAll("#search a[href], div.g a[href]")) {
        const h = a.getAttribute("href");
        if (h) outH.push(h);
        if (outH.length >= 40) break;
      }
      return outH;
    });

    const candidates = [];
    for (const h of hrefs) {
      const url = decodeGoogleHref(h);
      if (!url?.startsWith("http")) continue;
      if (!candidates.includes(url)) candidates.push(url);
    }

    for (const url of candidates) {
      if (!isOfficialCandidate(url, lead.name)) continue;
      out.has_official_web = true;
      out.website_url = url;
      out.domain = extractDomain(url);
      if (!out.email) {
        const fromSite = await fetchEmailFromWebsite(url);
        if (fromSite) out.email = fromSite;
      }
      break;
    }

    return out;
  } catch {
    return out;
  } finally {
    await browser?.close().catch(() => {});
  }
}

/** Solo busca correo (negocio que ya tiene web en Maps). */
export async function fetchEmailFromGoogle(lead, { city = "Lima" } = {}) {
  const v = await verifyWebPresenceOnGoogle(lead, { city });
  return v.email || null;
}
