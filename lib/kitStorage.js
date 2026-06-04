import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

const KITS_DIR = path.resolve("data", "kits");

function ensureKitsDir() {
  if (!fs.existsSync(KITS_DIR)) fs.mkdirSync(KITS_DIR, { recursive: true });
}

export function kitLocalPath(slug) {
  return path.join(KITS_DIR, `${slug}.json`);
}

export function saveKitLocal(kit) {
  ensureKitsDir();
  const file = kitLocalPath(kit.slug);
  fs.writeFileSync(file, JSON.stringify(kit, null, 2), "utf-8");
  return file;
}

export function loadKitLocal(slug) {
  const file = kitLocalPath(slug);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

/** Sube JSON del kit a Vercel Blob (public) o Supabase Storage. */
export async function publishKit(kit) {
  saveKitLocal(kit);
  const json = JSON.stringify(kit);
  const filename = `kits/${kit.slug}.json`;

  if (config.blobReadWriteToken) {
    try {
      const { put } = await import("@vercel/blob");
      const blob = await put(filename, json, {
        access: "public",
        contentType: "application/json",
        token: config.blobReadWriteToken,
        addRandomSuffix: false,
      });
      kit.manifestUrl = blob.url;
      const cdnMatch = blob.url.match(/^(https:\/\/[^/]+)/);
      if (cdnMatch) kit.cdnBase = cdnMatch[1];
      saveKitLocal(kit);
      return { provider: "vercel_blob", url: blob.url, cdnBase: kit.cdnBase || null };
    } catch (err) {
      console.log(`   Kit Blob: ${err.message.split("\n")[0]}`);
    }
  }

  if (config.supabaseUrl && config.supabaseServiceKey) {
    try {
      const bucket = config.supabaseBucket;
      const uploadUrl = `${config.supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/${bucket}/${filename}`;
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.supabaseServiceKey}`,
          "Content-Type": "application/json",
          "x-upsert": "true",
        },
        body: json,
      });
      if (res.ok) {
        const publicUrl = `${config.supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${bucket}/${filename}`;
        kit.manifestUrl = publicUrl;
        saveKitLocal(kit);
        return { provider: "supabase", url: publicUrl };
      }
      console.log(`   Kit Supabase: HTTP ${res.status}`);
    } catch (err) {
      console.log(`   Kit Supabase: ${err.message.split("\n")[0]}`);
    }
  }

  const plantillasPublic = path.resolve(
    "..",
    "Plantillas-Web-Maestra",
    "public",
    "kits",
    `${kit.slug}.json`,
  );
  try {
    const dir = path.dirname(plantillasPublic);
    if (fs.existsSync(path.resolve("..", "Plantillas-Web-Maestra"))) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(plantillasPublic, json, "utf-8");
    }
  } catch {
    /* ignore */
  }

  return { provider: "local", url: null };
}
