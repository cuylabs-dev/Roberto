/**
 * Política TTL Vercel Blob: elimina kits/imágenes con antigüedad > N días.
 */
import { list, del } from "@vercel/blob";
import { config } from "./config.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function blobTtlDays() {
  const n = parseInt(process.env.BLOB_TTL_DAYS || "10", 10);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

/** Lista todos los blobs del store (paginado). */
export async function listAllBlobs(token) {
  const all = [];
  let cursor;
  do {
    const page = await list({ token, cursor, limit: 1000 });
    all.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return all;
}

/**
 * @returns {{ deleted: number, kept: number, errors: number, cutoff: Date }}
 */
export async function purgeExpiredBlobs({ dryRun = false } = {}) {
  const token = config.blobReadWriteToken;
  if (!token) {
    throw new Error("Falta BLOB_READ_WRITE_TOKEN en .env");
  }

  const ttlDays = blobTtlDays();
  const cutoff = new Date(Date.now() - ttlDays * MS_PER_DAY);
  const blobs = await listAllBlobs(token);

  const toDelete = blobs.filter((b) => {
    const uploaded = b.uploadedAt instanceof Date ? b.uploadedAt : new Date(b.uploadedAt);
    return uploaded < cutoff;
  });

  let deleted = 0;
  let errors = 0;

  if (!dryRun && toDelete.length) {
    const batch = 100;
    for (let i = 0; i < toDelete.length; i += batch) {
      const chunk = toDelete.slice(i, i + batch).map((b) => b.url);
      try {
        await del(chunk, { token });
        deleted += chunk.length;
      } catch (err) {
        errors += chunk.length;
        console.log(`   Blob del: ${err.message?.split("\n")[0]}`);
      }
    }
  } else if (dryRun) {
    deleted = toDelete.length;
  }

  return {
    deleted: dryRun ? toDelete.length : deleted,
    kept: blobs.length - toDelete.length,
    errors,
    cutoff,
    ttlDays,
    candidates: toDelete.map((b) => ({
      pathname: b.pathname,
      uploadedAt: b.uploadedAt,
    })),
  };
}
