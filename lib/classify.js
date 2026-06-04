// ============================================================================
// classify.js — Plantilla + tipografia por nicho (SIN color fijo por rubro).
// El color lo resuelve brand.js por negocio (logo, nombre, Vision, hash).
// ============================================================================

import { RUBROS_LOCALES } from "./rubrosCatalog.js";

const RULES = [
  {
    template: "gimnasios",
    font: "montserrat",
    kw: [
      "gym", "gimnasio", "crossfit", "fitness", "yoga", "pilates", "wellness",
      ...RUBROS_LOCALES.filter((r) => r.template === "gimnasios").flatMap((r) => r.kw),
    ],
  },
  {
    template: "colegios",
    font: "poppins",
    kw: [
      "colegio", "escuela", "instituto", "kinder", "academia", "educacion",
      ...RUBROS_LOCALES.filter((r) => r.template === "colegios").flatMap((r) => r.kw),
    ],
  },
  {
    template: "clinicas",
    font: "inter",
    kw: [
      "clinica", "dental", "odonto", "medic", "salud", "spa", "barber", "belleza", "estetica",
      ...RUBROS_LOCALES.filter((r) => r.template === "clinicas").flatMap((r) => r.kw),
    ],
  },
  {
    template: "tiendas",
    font: "poppins",
    kw: [
      "tienda", "boutique", "ferreteria", "autopartes", "restaurante", "cafeteria", "hotel",
      "hostal", "ecommerce", "moda", "repuestos",
      ...RUBROS_LOCALES.filter((r) => r.template === "tiendas").flatMap((r) => r.kw),
    ],
  },
  {
    template: "corporativo",
    font: "inter",
    kw: [
      "abogado", "contador", "consultora", "inmobiliaria", "taller", "mecanico", "asesoria",
      ...RUBROS_LOCALES.filter((r) => r.template === "corporativo").flatMap((r) => r.kw),
    ],
  },
];

const DEFAULT = { template: "corporativo", font: "inter" };

function norm(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function inferFromNiche({ searchQuery, name } = {}) {
  const hay = `${norm(searchQuery)} ${norm(name)}`;
  for (const rule of RULES) {
    if (rule.kw.some((k) => hay.includes(k))) {
      return { template: rule.template, font: rule.font, matched: true };
    }
  }
  return { ...DEFAULT, matched: false };
}
