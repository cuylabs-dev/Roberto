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
    template: "clinicas",
    font: "inter",
    kw: [
      "clinica", "consultorio", "medic", "salud", "dental", "odonto", "farmacia", "botica",
      "spa", "belleza", "estetica", "barber", "peluquer", "fisioterap", "veterinari",
    ],
  },
  {
    template: "tiendas",
    font: "poppins",
    kw: ["boutique", "ropa", "moda", "tienda de ropa", "fashion"],
  },
  {
    template: "corporativo",
    font: "inter",
    kw: ["consultora", "asesoria", "inmobiliaria", "bienes raices", "propiedades", "abogado", "contador"],
  },
];

const DEFAULT = { template: "corporativo", font: "inter" };

function norm(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function inferFromNiche({ searchQuery, name, template_hint } = {}) {
  if (template_hint) {
    const rule = RULES.find((r) => r.template === template_hint);
    if (rule) return { template: rule.template, font: rule.font, matched: true };
  }
  const hay = `${norm(searchQuery)} ${norm(name)}`;
  for (const rule of RULES) {
    if (rule.kw.some((k) => hay.includes(k))) {
      return { template: rule.template, font: rule.font, matched: true };
    }
  }
  return { ...DEFAULT, matched: false };
}
