/**
 * Purga data/ local (pruebas). No toca Notion ni Obsidian.
 * Uso: node scripts/purgar_data_local.js
 */
import fs from "node:fs";
import path from "node:path";

const DATA = path.resolve("data");
const PLANTILLAS_KITS = path.resolve("..", "Plantillas-Web-Maestra", "public", "kits");

function rmIfExists(p) {
  if (!fs.existsSync(p)) return false;
  fs.rmSync(p, { recursive: true, force: true });
  return true;
}

function emptyDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    return;
  }
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    fs.rmSync(full, { recursive: true, force: true });
  }
}

function purgeDataDir() {
  fs.mkdirSync(DATA, { recursive: true });
  let n = 0;
  for (const name of fs.readdirSync(DATA)) {
    const full = path.join(DATA, name);
    fs.rmSync(full, { recursive: true, force: true });
    n += 1;
  }
  fs.writeFileSync(path.join(DATA, ".gitkeep"), "", "utf-8");
  return n;
}

console.log("=== Purga data local ===\n");
const removed = purgeDataDir();
console.log(`data/: ${removed} entradas eliminadas`);

if (fs.existsSync(PLANTILLAS_KITS)) {
  let k = 0;
  for (const f of fs.readdirSync(PLANTILLAS_KITS)) {
    if (f.endsWith(".json")) {
      fs.unlinkSync(path.join(PLANTILLAS_KITS, f));
      k += 1;
    }
  }
  console.log(`Plantillas public/kits/: ${k} JSON eliminados`);
}

console.log("\nListo. Notion y Obsidian: limpiar manualmente si aplica.");
