// ============================================================================
// classify.js — Plantilla + tipografia por nicho (color en brand.js).
// ============================================================================

const RULES = [
  {
    template: "hoteles",
    font: "inter",
    kw: ["hotel", "hostal", "hospedaje", "alojamiento", "boutique hotel"],
  },
  {
    template: "gimnasios",
    font: "montserrat",
    kw: [
      "gym", "gimnasio", "crossfit", "fitness", "box", "boxeo", "muay", "mma", "thai",
      "kickbox", "jiu", "fight", "entrenamiento", "pilates", "yoga",
    ],
  },
  {
    template: "colegios",
    font: "poppins",
    kw: ["colegio", "escuela", "instituto", "kinder", "academia", "educacion"],
  },
  {
    template: "estetica",
    font: "poppins",
    kw: ["estetica", "belleza", "facial", "corporal", "laser", "botox", "cosmetolog", "depilacion", "barber", "peluquer"],
  },
  {
    template: "spas",
    font: "poppins",
    kw: ["spa", "masaje", "hammam", "relax", "bienestar", "day spa"],
  },
  {
    template: "clinicas",
    font: "inter",
    kw: ["clinica", "consultorio", "medic", "salud", "dental", "odonto", "fisioterap"],
  },
  {
    template: "tiendas",
    font: "poppins",
    kw: ["boutique", "ropa", "moda", "tienda de ropa", "fashion"],
  },
  {
    template: "inmobiliarias",
    font: "inter",
    kw: ["inmobiliaria", "bienes raices", "propiedades", "alquiler", "venta depto", "tasacion", "realtor", "wiestate", "estate", "real estate"],
  },
  {
    template: "corporativo",
    font: "inter",
    kw: ["consultora", "asesoria", "abogado", "contador"],
  },
];

const DEFAULT = { template: "corporativo", font: "inter" };

function norm(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function inferFromNiche({ searchQuery, name, template_hint, maps_category, nicho } = {}) {
  if (template_hint) {
    const rule = RULES.find((r) => r.template === template_hint);
    if (rule) return { template: rule.template, font: rule.font, matched: true };
  }
  const hay = `${norm(searchQuery)} ${norm(name)} ${norm(maps_category)} ${norm(nicho)}`;
  if (/inmobiliaria|bienes raices|real estate|realtor|wiestate|propiedades|corretaj|estate/.test(hay)) {
    return { template: "inmobiliarias", font: "inter", matched: true };
  }
  for (const rule of RULES) {
    if (rule.kw.some((k) => hay.includes(k))) {
      return { template: rule.template, font: rule.font, matched: true };
    }
  }
  return { ...DEFAULT, matched: false };
}
