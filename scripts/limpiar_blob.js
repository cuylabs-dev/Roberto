/**
 * TTL Vercel Blob (default 10 días). Uso:
 *   node scripts/limpiar_blob.js
 *   node scripts/limpiar_blob.js --dry-run
 */
import "dotenv/config";
import { purgeExpiredBlobs } from "../lib/blobCleanup.js";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  console.log(`=== Limpieza Vercel Blob${dryRun ? " (dry-run)" : ""} ===\n`);
  const r = await purgeExpiredBlobs({ dryRun });
  console.log(`TTL: ${r.ttlDays} días | Corte: ${r.cutoff.toISOString().slice(0, 10)}`);
  console.log(`Candidatos: ${r.deleted} | Conservados: ${r.kept} | Errores: ${r.errors}`);
  if (dryRun && r.candidates.length) {
    r.candidates.slice(0, 15).forEach((b) => {
      console.log(`  - ${b.pathname} (${String(b.uploadedAt).slice(0, 10)})`);
    });
    if (r.candidates.length > 15) console.log(`  ... +${r.candidates.length - 15} más`);
  }
  if (!dryRun) console.log("\nBlob purgado según política de retención.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
