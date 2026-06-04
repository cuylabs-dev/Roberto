// ============================================================================
// classify.js — Plantilla + tipografia por nicho (SIN color fijo por rubro).
// El color lo resuelve brand.js por negocio (logo, nombre, Vision, hash).
// ============================================================================

const RULES = [
  {
    template: "gimnasios",
    font: "montserrat",
    kw: [
      "gym", "gimnasio", "crossfit", "cross fit", "fitness", "box", "boxeo",
      "muay", "mma", "thai", "kickbox", "jiu", "jitsu", "karate", "taekwondo",
      "entrenamiento", "training", "pesas", "calistenia", "spinning", "yoga",
      "pilates", "wellness", "fit ", "sparring", "fight",
    ],
  },
  {
    template: "colegios",
    font: "poppins",
    kw: [
      "colegio", "escuela", "school", "instituto", "nido", "kinder", "jardin",
      "preescolar", "inicial", "primaria", "secundaria", "educativ", "educacion",
      "bachillerato", "montessori",
    ],
  },
  {
    template: "clinicas",
    font: "inter",
    kw: [
      "clinica", "medic", "salud", "dental", "odonto", "consultorio", "centro medico",
      "estetic", "dermat", "fisio", "rehabilitacion", "nutricion", "psicolog",
      "veterinari", "oftalmolog", "laboratorio", "spa", "hospital",
    ],
  },
  {
    template: "tiendas",
    font: "poppins",
    kw: [
      "tienda", "store", "boutique", "shop", "market", "minimarket", "bodega",
      "distribuidora", "importacion", "ropa", "moda", "calzado", "zapatos",
      "ecommerce", "venta", "ferreteria", "libreria", "joyeria", "carnes",
      "minimarket", "abarrotes", "comercial",
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
