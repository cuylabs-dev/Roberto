import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { config } from "./config.js";

chromium.use(StealthPlugin());

const DATA_DIR = path.resolve("data");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const humanDelay = () => sleep(rand(800, 2200));

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
export async function scrapeMaps(query, limit) {
  ensureDataDir();
  const leads = [];
  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled", "--start-maximized"],
  });
  const context = await browser.newContext({
    userAgent: UA,
    locale: "es-PE",
    viewport: { width: 1366, height: 900 },
  });
  const page = await context.newPage();

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

    // Scroll del feed hasta juntar suficientes resultados.
    const seenHrefs = new Set();
    let stagnant = 0;
    while (seenHrefs.size < limit * 2 && stagnant < 6) {
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

    const placeUrls = [...seenHrefs].slice(0, limit);
    console.log(`   Encontrados ${seenHrefs.size} lugares, procesando ${placeUrls.length}.`);

    for (const placeUrl of placeUrls) {
      try {
        await page.goto(placeUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
        await sleep(rand(1500, 3000));

        const name = await page.locator("h1").first().textContent().catch(() => null);

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

        if (name) {
          leads.push({
            name: name.trim(),
            phone_raw: phone_raw ? phone_raw.trim() : null,
            address: address ? address.trim() : null,
            has_website,
            source: phone_raw ? "Maps" : null,
            maps_url: placeUrl,
          });
        }
        await humanDelay();
      } catch (err) {
        console.warn(`   ! Error en un lugar: ${err.message}`);
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  return leads;
}

// ---------------------------------------------------------------------------
// FASE 2 — Fallback FB / IG con el perfil "cuy" (best effort, no critico)
// ---------------------------------------------------------------------------
const PHONE_REGEX = /(?:\+?51|051)?[\s-]?9\d{2}[\s-]?\d{3}[\s-]?\d{3}/g;

export async function enrichFromSocial(lead) {
  if (!config.chromeUserDataDir) {
    return { phone_raw: null, source: null, redes: null, note: "Sin CHROME_USER_DATA_DIR" };
  }

  let context;
  try {
    context = await chromium.launchPersistentContext(config.chromeUserDataDir, {
      channel: "chrome",
      headless: false,
      args: [`--profile-directory=${config.chromeProfileDirectory}`],
      viewport: { width: 1366, height: 900 },
    });
    const page = context.pages()[0] || (await context.newPage());

    // Busca en Google el FB/IG del negocio.
    const q = `${lead.name} ${lead.address || ""} facebook OR instagram`;
    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(q)}`, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await sleep(rand(1500, 3000));

    const socialLink = await page
      .locator('a[href*="facebook.com"], a[href*="instagram.com"]')
      .first()
      .getAttribute("href")
      .catch(() => null);

    if (!socialLink) {
      return { phone_raw: null, source: null, redes: null, note: "Sin red social hallada" };
    }

    await page.goto(socialLink, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
    await sleep(rand(2000, 3500));

    const bodyText = await page.locator("body").innerText().catch(() => "");
    const matches = bodyText.match(PHONE_REGEX);
    const phone_raw = matches && matches.length ? matches[0] : null;
    const source = socialLink.includes("instagram") ? "Instagram" : "Facebook";

    return { phone_raw, source: phone_raw ? source : null, redes: socialLink, note: null };
  } catch (err) {
    return { phone_raw: null, source: null, redes: null, note: `FB/IG fallo: ${err.message}` };
  } finally {
    if (context) await context.close().catch(() => {});
  }
}
