import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { config } from "./config.js";
import { normName } from "./memoria.js";
import { extractLogoFromPage } from "./brand.js";
import { qualifyFast } from "./qualify.js";
import { extractReviewKeywords } from "./leadContext.js";
import { normalizeWebsiteUrl } from "./urlHosts.js";

chromium.use(StealthPlugin());

const DATA_DIR = path.resolve("data");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const humanDelay = () => sleep(rand(800, 2200));

/** stdout: PowerShell no marca error rojo con Tee-Object 2>&1 */
const logLine = (msg) => console.log(msg);

const CHROMIUM_ARGS = [
  "--disable-blink-features=AutomationControlled",
  "--start-maximized",
  "--disable-dev-shm-usage",
  "--disable-gpu",
];

const PLACE_GOTO_TIMEOUT = 55000;
const PLACE_PAGE_RECYCLE = 10;

function shortErr(err) {
  return String(err?.message || err).split("\n")[0].slice(0, 120);
}

function isSessionDead(err) {
  const m = String(err?.message || err);
  return /crashed|target closed|has been closed|browser has been|disconnected|execution context/i.test(
    m,
  );
}

async function launchMapsSession() {
  const browser = await chromium.launch({
    headless: config.headless,
    args: CHROMIUM_ARGS,
  });
  const context = await browser.newContext({
    userAgent: UA,
    locale: "es-PE",
    viewport: { width: 1366, height: 900 },
  });
  const page = await context.newPage();
  return { browser, context, page };
}

async function closeMapsSession(session) {
  if (!session) return;
  await session.page?.close().catch(() => {});
  await session.context?.close().catch(() => {});
  await session.browser?.close().catch(() => {});
}

async function recycleMapsPage(session) {
  await session.page?.close().catch(() => {});
  session.page = await session.context.newPage();
  return session.page;
}

async function restartMapsSession(session) {
  await closeMapsSession(session);
  await sleep(rand(1500, 2500));
  return launchMapsSession();
}

async function gotoPlacePage(page, placeUrl) {
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await page.goto(placeUrl, {
        waitUntil: attempt === 0 ? "domcontentloaded" : "commit",
        timeout: PLACE_GOTO_TIMEOUT,
      });
      return true;
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || err);
      if (isSessionDead(err)) throw err;
      if (attempt === 0 && (msg.includes("Timeout") || msg.includes("timeout"))) {
        logLine(`   ! Lento en Maps, reintento...`);
        await sleep(rand(2000, 3500));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function looksLikeCaptcha(page) {
  const url = page.url();
  if (url.includes("/sorry/") || url.includes("consent.google")) return true;
  const hit = await page
    .locator('iframe[src*="recaptcha"], form#captcha-form, div.g-recaptcha')
    .count()
    .catch(() => 0);
  return hit > 0;
}

// ---------------------------------------------------------------------------
// FASE 1 — Google Maps
// ---------------------------------------------------------------------------
export async function scrapeMaps(query, limit, seenNames = new Set(), skippedOut = []) {
  ensureDataDir();
  const leads = [];
  const skippedSeen = [];
  const poolMultiplier = Math.max(config.qualifyOversample, 4);
  const poolTarget = limit * poolMultiplier;
  let session = await launchMapsSession();
  let page = session.page;
  let placesVisited = 0;

  try {
    const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await humanDelay();

    // Acepta consentimiento si aparece (best effort).
    const consent = page.locator('button:has-text("Aceptar todo"), button:has-text("Accept all")');
    if (await consent.count().catch(() => 0)) {
      await consent.first().click().catch(() => {});
      await humanDelay();
    }

    if (await looksLikeCaptcha(page)) {
      const shot = path.join(DATA_DIR, `captcha_${Date.now()}.png`);
      await page.screenshot({ path: shot }).catch(() => {});
      throw new Error(`CAPTCHA detectado en Google Maps. Screenshot: ${shot}`);
    }

    const feed = page.locator('div[role="feed"]');
    await feed.waitFor({ timeout: 20000 }).catch(() => {});

    // Scroll del feed hasta juntar bastantes candidatos (mas que el limite,
    // porque vamos a descartar los que ya scrapeamos antes).
    const seenHrefs = new Set();
    let stagnant = 0;
    while (seenHrefs.size < poolTarget * 3 && stagnant < 12) {
      const hrefs = await page
        .locator('div[role="feed"] a[href*="/maps/place/"]')
        .evaluateAll((els) => els.map((e) => e.href));
      const before = seenHrefs.size;
      hrefs.forEach((h) => seenHrefs.add(h));
      if (seenHrefs.size === before) stagnant++;
      else stagnant = 0;
      await feed.evaluate((el) => el.scrollBy(0, el.scrollHeight)).catch(() => {});
      await sleep(rand(1200, 2400));
    }

    const placeUrls = [...seenHrefs];
    console.log(
      `   Encontrados ${placeUrls.length} candidatos. Meta ${limit} calificados (pool x${poolMultiplier})...`,
    );

    const seenThisRun = new Set();
    for (const placeUrl of placeUrls) {
      if (leads.length >= limit) break;

      if (placesVisited > 0 && placesVisited % PLACE_PAGE_RECYCLE === 0) {
        page = await recycleMapsPage(session);
      }
      placesVisited++;

      const processPlace = async () => {
        await gotoPlacePage(page, placeUrl);
        await sleep(rand(1500, 3000));

        const name = await page.locator("h1").first().textContent().catch(() => null);

        const key = normName(name);
        if (key && (seenNames.has(key) || seenThisRun.has(key))) {
          if (seenNames.has(key)) skippedSeen.push(name.trim());
          return;
        }
        if (key) seenThisRun.add(key);

        const phoneBtn = page.locator('button[data-item-id^="phone:tel:"]').first();
        let phone_raw = null;
        if (await phoneBtn.count().catch(() => 0)) {
          phone_raw =
            (await phoneBtn.getAttribute("data-item-id").catch(() => null))?.replace(
              "phone:tel:",
              "",
            ) || (await phoneBtn.getAttribute("aria-label").catch(() => null));
        }

        const addressBtn = page.locator('button[data-item-id="address"]').first();
        const address = (await addressBtn.getAttribute("aria-label").catch(() => null))?.replace(
          /^Direccion:\s*/i,
          "",
        ) || null;

        const websiteLink = page.locator('a[data-item-id="authority"]').first();
        const has_website = (await websiteLink.count().catch(() => 0)) > 0;
        const websiteRaw =
          has_website ? (await websiteLink.getAttribute("href").catch(() => null)) : null;
        const website_url = normalizeWebsiteUrl(websiteRaw);
        const has_website_final = Boolean(website_url);

        let email = null;
        const emailBtn = page
          .locator('button[data-item-id^="email"], a[data-item-id^="email"]')
          .first();
        if (await emailBtn.count().catch(() => 0)) {
          const rawId = await emailBtn.getAttribute("data-item-id").catch(() => null);
          const fromId = rawId?.replace(/^email:/i, "").trim();
          const aria =
            (await emailBtn.getAttribute("aria-label").catch(() => null))?.replace(
              /^Correo:\s*/i,
              "",
            ) || null;
          const candidate = fromId || aria;
          if (candidate?.includes("@")) email = candidate.trim();
        }

        let logo_url = null;
        let maps_photo_url = null;
        const mapsImg = page
          .locator('button[jsaction*="photo"] img, div[role="main"] img[src*="googleusercontent"]')
          .first();
        if (await mapsImg.count().catch(() => 0)) {
          logo_url = (await mapsImg.getAttribute("src").catch(() => null)) || null;
          maps_photo_url = logo_url;
        }

        const photoBtn = page
          .locator('button[aria-label*="Foto"], button[aria-label*="Photo"], button[jsaction*="photo"]')
          .first();
        if (await photoBtn.count().catch(() => 0)) {
          await photoBtn.click({ timeout: 8000 }).catch(() => {});
          await sleep(rand(800, 1400));
          const bigImg = page.locator('img[src*="googleusercontent"]').first();
          if (await bigImg.count().catch(() => 0)) {
            const src = await bigImg.getAttribute("src").catch(() => null);
            if (src?.startsWith("http")) {
              maps_photo_url = src.trim();
              if (!logo_url) logo_url = maps_photo_url;
            }
          }
        }

        let maps_category = null;
        const catBtn = page.locator('button[jsaction*="category"]').first();
        if (await catBtn.count().catch(() => 0)) {
          maps_category =
            (await catBtn.getAttribute("aria-label").catch(() => null))?.replace(/^Categor[ií]a:\s*/i, "") ||
            (await catBtn.textContent().catch(() => null));
        }

        const review_snippets = await page
          .locator('[data-review-id] span, div[class*="review"] span, button[aria-label*="reseña"] + div span')
          .allTextContents()
          .catch(() => []);
        const review_keywords = extractReviewKeywords(
          review_snippets.filter((t) => t && t.length > 12).slice(0, 12),
        );

        if (!name) return;

        const candidate = {
          name: name.trim(),
          phone_raw: phone_raw ? phone_raw.trim() : null,
          address: address ? address.trim() : null,
          has_website: has_website_final,
          website_url: website_url || null,
          logo_url: logo_url && logo_url.startsWith("http") ? logo_url.trim() : null,
          maps_photo_url:
            maps_photo_url && maps_photo_url.startsWith("http") ? maps_photo_url.trim() : null,
          maps_category: maps_category ? maps_category.trim() : null,
          review_snippets: review_snippets.filter((t) => t?.trim()).slice(0, 6),
          review_keywords,
          email,
          source: phone_raw ? "Maps" : null,
          maps_url: placeUrl,
        };
        const fast = qualifyFast(candidate);
        if (fast.reject) {
          skippedOut.push({
            name: candidate.name,
            reject_reason: fast.reject_reason,
            query,
            phase: "fast",
          });
          console.log(`   x ${candidate.name} (${fast.reject_reason})`);
          return;
        }
        leads.push(candidate);
        await humanDelay();
      };

      let ok = false;
      for (let attempt = 0; attempt < 2 && !ok; attempt++) {
        try {
          await processPlace();
          ok = true;
        } catch (err) {
          if (attempt === 0 && isSessionDead(err)) {
            logLine(`   ! Navegador inestable, reiniciando sesion Maps...`);
            session = await restartMapsSession(session);
            page = session.page;
            placesVisited = 0;
            continue;
          }
          logLine(`   ! Error en un lugar: ${shortErr(err)}`);
        }
      }
    }

    if (skippedSeen.length) {
      console.log(`   (${skippedSeen.length} negocios ya estaban en la memoria, se omitieron)`);
    }
    if (leads.length < limit) {
      console.log(`   Pool agotado: ${leads.length}/${limit} tras filtro rapido.`);
    }
    console.log(`   Recolectados ${leads.length} candidatos (pre-auditoria).`);
  } finally {
    await closeMapsSession(session);
  }

  return leads;
}

// ---------------------------------------------------------------------------
// FASE 2 — Fallback FB / IG con el perfil "cuy" (best effort, no critico)
// ---------------------------------------------------------------------------
const PHONE_REGEX = /(?:\+?51|051)?[\s-]?9\d{2}[\s-]?\d{3}[\s-]?\d{3}/g;

async function scrapeInstagramProfile(page, profileUrl) {
  const out = {
    instagram_handle: null,
    bio: null,
    avatar_url: null,
    post_images: [],
  };
  await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
  await sleep(rand(2500, 4000));

  const handleM = profileUrl.match(/instagram\.com\/([^/?#]+)/i);
  if (handleM) out.instagram_handle = `@${handleM[1]}`;

  const bio = await page
    .locator('header section span, div.-vDIg span, [data-testid="user-bio"]')
    .first()
    .textContent()
    .catch(() => null);
  if (bio) out.bio = bio.trim().slice(0, 500);

  const avatar = await page
    .locator('header img[alt*="profile"], img[alt*="foto del perfil"], header img')
    .first()
    .getAttribute("src")
    .catch(() => null);
  if (avatar?.startsWith("http")) out.avatar_url = avatar;

  const imgs = await page
    .locator('article img[src*="cdninstagram"], main img[src*="cdninstagram"], img[src*="fbcdn"]')
    .evaluateAll((els) =>
      els
        .map((e) => e.getAttribute("src"))
        .filter((s) => s && s.startsWith("http") && !s.includes("150x150")),
    )
    .catch(() => []);

  const seen = new Set();
  for (const src of imgs) {
    if (!src || seen.has(src)) continue;
    seen.add(src);
    out.post_images.push(src);
    if (out.post_images.length >= 8) break;
  }

  return out;
}

export async function enrichFromSocial(lead) {
  if (!config.chromeUserDataDir) {
    return {
      phone_raw: null,
      source: null,
      redes: null,
      logo_url: null,
      note: "Sin CHROME_USER_DATA_DIR",
      post_images: [],
    };
  }

  let context;
  try {
    context = await chromium.launchPersistentContext(config.chromeUserDataDir, {
      channel: "chrome",
      headless: config.headless,
      args: [`--profile-directory=${config.chromeProfileDirectory}`],
      viewport: { width: 1366, height: 900 },
    });
    const page = context.pages()[0] || (await context.newPage());

    const q = `${lead.name} ${lead.address || ""} instagram`;
    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(q)}`, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await sleep(rand(1500, 3000));

    let socialLink = await page
      .locator('a[href*="instagram.com/"]')
      .first()
      .getAttribute("href")
      .catch(() => null);

    if (!socialLink) {
      socialLink = await page
        .locator('a[href*="facebook.com"]')
        .first()
        .getAttribute("href")
        .catch(() => null);
    }

    if (!socialLink) {
      return {
        phone_raw: null,
        source: null,
        redes: null,
        logo_url: null,
        note: "Sin red social hallada",
        post_images: [],
      };
    }

    let igData = { post_images: [], avatar_url: null, bio: null, instagram_handle: null };
    if (socialLink.includes("instagram.com")) {
      igData = await scrapeInstagramProfile(page, socialLink);
    } else {
      await page.goto(socialLink, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
      await sleep(rand(2000, 3500));
    }

    const logo_url = igData.avatar_url || (await extractLogoFromPage(page));
    const bodyText = await page.locator("body").innerText().catch(() => "");
    const matches = bodyText.match(PHONE_REGEX);
    const phone_raw = matches && matches.length ? matches[0] : null;
    const source = socialLink.includes("instagram") ? "Instagram" : "Facebook";

    return {
      phone_raw,
      source: phone_raw ? source : null,
      redes: socialLink,
      logo_url,
      note: igData.post_images.length ? `IG: ${igData.post_images.length} fotos` : null,
      bio: igData.bio,
      instagram_handle: igData.instagram_handle,
      post_images: igData.post_images,
      gallery: igData.post_images,
      avatar_url: igData.avatar_url,
    };
  } catch (err) {
    return {
      phone_raw: null,
      source: null,
      redes: null,
      logo_url: null,
      note: `FB/IG fallo: ${err.message}`,
      post_images: [],
    };
  } finally {
    if (context) await context.close().catch(() => {});
  }
}

/** FASE 2c — Instagram profundo para galería (siempre que haya perfil cuy). */
export async function enrichInstagramGallery(lead) {
  if (lead._social_enriched) return lead;
  const social = await enrichFromSocial(lead);
  lead._social_enriched = true;
  if (social.logo_url && !lead.logo_url) lead.logo_url = social.logo_url;
  if (social.redes) lead.redes = social.redes;
  if (social.phone_raw && !lead.phone_raw) {
    lead.phone_raw = social.phone_raw;
    lead.source = social.source;
  }
  lead.social = social;
  if (social.note) logLine(`   ${social.note}`);
  return lead;
}

// ---------------------------------------------------------------------------
// FASE 2b — Logo desde web (Chromium normal; no requiere cerrar Chrome)
// ---------------------------------------------------------------------------
async function enrichLogoFromWebsites(leads) {
  const pending = leads.filter((l) => !l.logo_url && l.website_url);
  if (!pending.length) return;

  const browser = await chromium.launch({
    headless: config.headless,
    args: CHROMIUM_ARGS,
  });
  try {
    const page = await browser.newPage({ userAgent: UA });
    for (const lead of pending) {
      await page.goto(lead.website_url, { waitUntil: "domcontentloaded", timeout: 35000 }).catch(() => {});
      await sleep(rand(1200, 2200));
      const logo = await extractLogoFromPage(page);
      if (logo) lead.logo_url = logo;
      if (!lead.email) {
        const html = await page.content().catch(() => "");
        const mailto = html.match(/mailto:([a-zA-Z0-9._%+-]+@[^\s"'<>]+)/i);
        if (mailto) lead.email = mailto[1].toLowerCase();
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }
}

/** Perfil cuy: solo si Chrome esta cerrado (FB/IG extra). */
async function enrichLogoFromCuyProfile(leads) {
  if (!config.chromeUserDataDir) return;
  const pending = leads.filter((l) => !l.logo_url);
  if (!pending.length) return;

  let context;
  try {
    context = await chromium.launchPersistentContext(config.chromeUserDataDir, {
      channel: "chrome",
      headless: config.headless,
      args: [`--profile-directory=${config.chromeProfileDirectory}`],
      viewport: { width: 1366, height: 900 },
    });
    const page = context.pages()[0] || (await context.newPage());
    for (const lead of pending) {
      const targets = [lead.redes].filter(Boolean);
      if (!targets.length) continue;
      for (const url of targets) {
        if (lead.logo_url) break;
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 40000 }).catch(() => {});
        await sleep(rand(1500, 2800));
        const logo = await extractLogoFromPage(page);
        if (logo) lead.logo_url = logo;
      }
    }
  } finally {
    if (context) await context.close().catch(() => {});
  }
}

export async function enrichBrandAssets(leads) {
  try {
    await enrichLogoFromWebsites(leads);
  } catch (err) {
    logLine(`   Logo web: ${shortErr(err)}`);
  }

  try {
    await enrichLogoFromCuyProfile(leads);
  } catch (err) {
    logLine(
      `   Logo perfil cuy: omitido (cierra Chrome si quieres redes). ${shortErr(err)}`,
    );
  }

  return leads;
}
