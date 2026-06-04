/**
 * Rehost de imágenes IG/galería a Vercel Blob (evita hotlink roto).
 */
import { config } from "./config.js";
import { fetchImageBuffer, uploadBufferToBlob } from "./blobAssets.js";

const MAX_IMAGES = 8;

/**
 * @param {string} kitSlug
 * @param {string[]} urls
 * @returns {Promise<string[]>}
 */
export async function rehostGalleryToBlob(kitSlug, urls) {
  if (!config.blobReadWriteToken || !urls?.length) return urls || [];

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
    if (!img) continue;
    n += 1;
    const ext = img.contentType.includes("png") ? "png" : "jpg";
    const pathname = `kits/${kitSlug}/img-${n}.${ext}`;
    try {
      const blobUrl = await uploadBufferToBlob(pathname, img.buf, img.contentType);
      if (blobUrl) out.push(blobUrl);
    } catch {
      /* omit broken */
    }
  }
  return out;
}
