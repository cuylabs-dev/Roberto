/**
 * Rehost de imágenes IG/galería a Vercel Blob (evita hotlink roto).
 */
import { config } from "./config.js";

const MAX_IMAGES = 8;
const FETCH_TIMEOUT_MS = 12000;

async function fetchImageBuffer(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CuyLabs/1.0)" },
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 500 || buf.length > 8_000_000) return null;
    const ct = res.headers.get("content-type") || "image/jpeg";
    return { buf, contentType: ct.split(";")[0] || "image/jpeg" };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * @param {string} kitSlug
 * @param {string[]} urls
 * @returns {Promise<string[]>}
 */
export async function rehostGalleryToBlob(kitSlug, urls) {
  if (!config.blobReadWriteToken || !urls?.length) return urls || [];

  const { put } = await import("@vercel/blob");
  const out = [];
  let n = 0;

  for (const url of urls.slice(0, MAX_IMAGES)) {
    if (!url?.startsWith("http")) {
      out.push(url);
      continue;
    }
    if (url.includes("blob.vercel-storage.com")) {
      out.push(url);
      continue;
    }
    const img = await fetchImageBuffer(url);
    if (!img) {
      out.push(url);
      continue;
    }
    n += 1;
    const ext = img.contentType.includes("png") ? "png" : "jpg";
    const pathname = `kits/${kitSlug}/img-${n}.${ext}`;
    try {
      const blob = await put(pathname, img.buf, {
        access: "public",
        contentType: img.contentType,
        token: config.blobReadWriteToken,
        addRandomSuffix: false,
      });
      out.push(blob.url);
    } catch {
      out.push(url);
    }
  }
  return out;
}
