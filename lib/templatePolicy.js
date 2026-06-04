/**
 * Plantilla y bloques por nicho de búsqueda (template_hint manda).
 */
import { BLOCKS, clampEnum } from "./config.js";

/** @type {Record<string, { template: string, blocks?: string[] }>} */
export const NICHE_QUERIES = [
  { query: "gimnasio local Lima", nicho: "Gym", template: "gimnasios" },
  { query: "muay thai boxeo mma gym Lima", nicho: "Gym peleas", template: "gimnasios" },
  { query: "colegio academia Lima", nicho: "Colegio", template: "colegios" },
  { query: "clinica medica Lima", nicho: "Clínica", template: "clinicas" },
  { query: "farmacia independiente Lima", nicho: "Farmacia", template: "clinicas" },
  { query: "spa belleza estetica Lima", nicho: "Spa", template: "clinicas" },
  { query: "boutique ropa independiente Lima", nicho: "Boutique", template: "tiendas" },
  { query: "inmobiliaria bienes raices Lima", nicho: "Inmobiliaria", template: "inmobiliarias" },
  { query: "consultora pequeña empresas Lima", nicho: "Corporativo", template: "corporativo" },
  { query: "hotel hostal boutique Lima", nicho: "Hotel", template: "hoteles" },
];

const BLOCKS_BY_TEMPLATE = {
  gimnasios: ["reservas", "galeria"],
  colegios: ["login", "reservas"],
  clinicas: ["reservas", "galeria"],
  tiendas: ["ecommerce", "galeria"],
  corporativo: ["reservas", "galeria"],
  hoteles: ["reservas", "galeria"],
  inmobiliarias: ["reservas", "galeria"],
};

/** Reglas por texto Maps / nombre (prioridad sobre classify genérico). */
const CATEGORY_RULES = [
  { re: /hotel|hostal|hospedaje|alojamiento/i, template: "hoteles" },
  { re: /inmobiliaria|bienes raices|propiedades|alquiler depto|venta depto/i, template: "inmobiliarias" },
  { re: /farmacia|botica/i, template: "clinicas" },
  { re: /spa|belleza|estetica|barber|peluquer/i, template: "clinicas" },
  { re: /muay|boxeo|mma|kick|jiu|fight/i, template: "gimnasios" },
  { re: /gimnasio|gym|crossfit|fitness/i, template: "gimnasios" },
  { re: /colegio|escuela|academia|kinder/i, template: "colegios" },
  { re: /clinica|consultorio|odontolog|dental|medic|salud/i, template: "clinicas" },
  { re: /boutique|ropa|moda|tienda/i, template: "tiendas" },
];

export function resolveTemplateFromLead(lead) {
  if (lead.template_hint) return lead.template_hint;
  const hay = `${lead.maps_category || ""} ${lead.name || ""} ${lead.nicho || ""}`;
  for (const rule of CATEGORY_RULES) {
    if (rule.re.test(hay)) return rule.template;
  }
  return lead.template || "corporativo";
}

export function blocksForTemplate(template) {
  const list = BLOCKS_BY_TEMPLATE[template] || [];
  return list.map((b) => clampEnum(b, BLOCKS, null)).filter(Boolean);
}
