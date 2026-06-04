// ============================================================================
// memoria.js — Base de datos local del scraper, viviendo DENTRO de Obsidian.
//   Objetivo: NO repetir negocios ya scrapeados. Si ya lo vimos, se busca otro.
//
//   Archivos que mantiene (en OBSIDIAN_DB_DIR):
//     - _registro_prospectos.json   (fuente de verdad para el anti-repeticion)
//     - Base_Datos_Prospectos.md    (tabla legible para ti en Obsidian)
// ============================================================================

import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

const DIR = config.obsidianDbDir;
const JSON_FILE = DIR ? path.join(DIR, "_registro_prospectos.json") : null;
const MD_FILE = DIR ? path.join(DIR, "Base_Datos_Prospectos.md") : null;

export function memoriaDisponible() {
  return Boolean(DIR);
}

// Normaliza un nombre para comparar (sin tildes, minusculas, espacios colapsados).
export function normName(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function distritoDesdeDireccion(address) {
  if (!address) return "";
  // Heuristica simple: toma el segmento antes de "Lima" o el penultimo trozo.
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return "";
  const limaIdx = parts.findIndex((p) => /lima/i.test(p));
  if (limaIdx > 0) return parts[limaIdx - 1];
  return parts.length >= 2 ? parts[parts.length - 2] : "";
}

// Carga el registro: devuelve { entries, seen:Set(normName) }.
export function cargarRegistro() {
  if (!JSON_FILE || !fs.existsSync(JSON_FILE)) {
    return { entries: [], seen: new Set() };
  }
  try {
    const data = JSON.parse(fs.readFileSync(JSON_FILE, "utf-8"));
    const entries = Array.isArray(data.entries) ? data.entries : [];
    return { entries, seen: new Set(entries.map((e) => normName(e.name))) };
  } catch {
    return { entries: [], seen: new Set() };
  }
}

// Agrega leads nuevos al registro (json + markdown). Devuelve cuantos se agregaron.
export function guardarEnRegistro(reg, leads) {
  if (!DIR) return { added: 0 };
  fs.mkdirSync(DIR, { recursive: true });

  let added = 0;
  for (const l of leads) {
    const key = normName(l.name);
    if (!key || reg.seen.has(key)) continue;
    reg.seen.add(key);
    reg.entries.push({
      name: (l.name || "").trim(),
      nicho: l.nicho || config.nichoNotion || "",
      distrito: l.distrito || distritoDesdeDireccion(l.address) || "",
      telefono: l.phone_e164 || "",
      fuente: l.source || "",
      score: l.score ?? "",
      maqueta_url: l.maqueta_url || "",
      fecha: new Date().toISOString().slice(0, 10),
    });
    added++;
  }

  fs.writeFileSync(
    JSON_FILE,
    JSON.stringify({ updated: new Date().toISOString(), entries: reg.entries }, null, 2),
    "utf-8",
  );
  escribirMarkdown(reg.entries);
  return { added };
}

function escribirMarkdown(entries) {
  if (!MD_FILE) return;
  const esc = (s) => String(s ?? "").replace(/\|/g, "\\|");
  const filas = entries
    .slice()
    .reverse() // mas recientes arriba
    .map(
      (e) =>
        `| ${esc(e.fecha)} | ${esc(e.name)} | ${esc(e.nicho)} | ${esc(e.distrito)} | ${esc(
          e.telefono,
        )} | ${esc(e.fuente)} | ${esc(e.score)} |`,
    )
    .join("\n");

  const md = `---
proyecto: Investigador de Prospectos
tipo: memoria-scraper
total: ${entries.length}
actualizado: ${new Date().toISOString().slice(0, 16).replace("T", " ")}
---

# Base de Datos de Prospectos

Registro automatico del scraper. Cada negocio aqui **no se vuelve a scrapear**;
el bot busca siempre negocios nuevos. No edites la tabla a mano (se regenera sola);
si quieres notas, escribelas debajo.

**Total scrapeados:** ${entries.length}

| Fecha | Negocio | Nicho | Distrito | WhatsApp | Fuente | Score |
|-------|---------|-------|----------|----------|--------|-------|
${filas || "| — | — | — | — | — | — | — |"}
`;
  fs.writeFileSync(MD_FILE, md, "utf-8");
}

/** Borra la memoria local para volver a scrapear los mismos negocios. */
export function vaciarRegistro() {
  if (!DIR || !JSON_FILE) return { ok: false, reason: "OBSIDIAN_DB_DIR no configurado" };
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(
    JSON_FILE,
    JSON.stringify({ updated: new Date().toISOString(), entries: [] }, null, 2),
    "utf-8",
  );
  escribirMarkdown([]);
  return { ok: true, path: DIR };
}
