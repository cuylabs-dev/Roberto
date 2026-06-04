/**
 * Subida obligatoria de imagenes reales a Vercel Blob.
 */
import { config } from "./config.js";

const FETCH_TIMEOUT_MS = 15000;

export async function fetchImageBuffer(url) {
  if (!url?.startsWith("http")) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "image/*",
        Referer: "https://www.google.com/",
      },
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 400 || buf.length > 8_000_000) return null;
    const ct = (res.headers.get("content-type") || "image/jpeg").split(";")[0];
    if (!ct.startsWith("image/")) return null;
    return { buf, contentType: ct };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function uploadBufferToBlob(pathname, buf, contentType) {
  if (!config.blobReadWriteToken) return null;
  const { put } = await import("@vercel/blob");
  const blob = await put(pathname, buf, {
    access: "public",
    contentType,
    token: config.blobReadWriteToken,
    addRandomSuffix: false,
  });
  return blob.url;
}

export async function uploadImageFromUrl(kitSlug, url, slot = "hero") {
  if (!url || url.includes("blob.vercel-storage.com")) return url;
  const img = await fetchImageBuffer(url);
  if (!img) return null;
  const ext = img.contentType.includes("png") ? "png" : "jpg";
  const pathname = `kits/${kitSlug}/${slot}.${ext}`;
  return uploadBufferToBlob(pathname, img.buf, img.contentType);
}

/**
 * Garantiza al menos 1 imagen real en Blob (Maps foto o logo).
 */
export async function ensureLeadImagesOnBlob(lead, kitSlug) {
  if (!config.blobReadWriteToken) return lead;

  const tryOrder = [
    ["maps_photo", lead.maps_photo_url],
    ["logo", lead.logo_url],
    ["ig_1", lead.social?.post_images?.[0]],
    ["hero", lead.maps_photo_url || lead.logo_url],
  ].filter(([, u]) => u?.startsWith("http"));

  let uploadedHero = null;
  let uploadedLogo = null;

  for (const [slot, url] of tryOrder) {
    const blobUrl = await uploadImageFromUrl(kitSlug, url, slot);
    if (!blobUrl) continue;
    if (slot === "logo" && !uploadedLogo) uploadedLogo = blobUrl;
    if (!uploadedHero) uploadedHero = blobUrl;
  }

  if (uploadedLogo) lead.logo_url = uploadedLogo;
  if (uploadedHero) {
    lead.maps_photo_blob = uploadedHero;
    if (!lead.hero_image_url) lead.hero_image_url = uploadedHero;
  }
  return lead;
}
