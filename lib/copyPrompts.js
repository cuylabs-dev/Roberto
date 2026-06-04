/**
 * Prompts por plantilla para sectionsCopy (Guantelete task: sections).
 */
import { wrapCopyPrompt } from "./copyQuality.js";

const SCHEMA_BY_TEMPLATE = {
  inmobiliarias: `
Incluye SOLO las secciones pedidas. Ejemplo de claves:
{
  "sectionsCopy": {
    "hero": { "eyebrow": "", "tagline": "" },
    "propiedades": {
      "title": "",
      "subtitle": "",
      "items": [
        { "titulo": "Depto 3 dorm Miraflores", "detalle": "85 m² · vista mar · desde S/ 520,000", "zona": "Miraflores" }
      ]
    },
    "zonas": { "title": "", "items": ["Miraflores: deptos y oficinas", "San Isidro: corporativo"] },
    "servicios": { "title": "", "items": ["Venta de inmuebles", "Alquiler residencial", "Tasación certificada"] },
    "proceso": { "title": "", "items": ["Asesoría inicial", "Visitas coordinadas", "Negociación y cierre"] },
    "stats": { "items": ["+120 propiedades activas", "12 años en Lima", "Asesores certificados SUNARP"] },
    "quienes_somos": { "title": "", "subtitle": "", "body": "2-3 frases SOLO sobre esta inmobiliaria" },
    "testimonios": [{ "quote": "", "author": "", "role": "Comprador en Surco" }]
  },
  "fonts": { "heading": "Playfair Display", "body": "Inter" },
  "tone": "premium_cercano"
}`,
  corporativo: `
Enfocado en CONSULTORA B2B (NO holding multinacional). Prohibido: años de trayectoria regional, LATAM, colaboradores, portafolio genérico, transformación digital vacía.
{
  "sectionsCopy": {
    "servicios": { "title": "", "subtitle": "", "items": ["",""] },
    "casos": { "title": "", "items": ["",""] },
    "metodologia": { "title": "", "items": ["",""] },
    "metricas": { "items": ["",""] },
    "testimonios": [{ "quote": "", "author": "", "role": "" }]
  },
  "fonts": { "heading": "Inter", "body": "Roboto" },
  "tone": "profesional_b2b"
}`,
  hoteles: `
{
  "sectionsCopy": {
    "habitaciones": { "title": "", "items": ["",""] },
    "amenidades": { "title": "", "items": ["",""] },
    "testimonios": [{ "quote": "", "author": "", "role": "" }]
  }
}`,
};

export function buildSectionsPrompt(lead, template, sections, brandPrimary) {
  const ids = sections.join(", ");
  const schema = SCHEMA_BY_TEMPLATE[template] || `
{
  "sectionsCopy": { "planes": { "title": "", "items": [""] }, "testimonios": [{ "quote": "", "author": "", "role": "" }] },
  "fonts": { "heading": "Inter", "body": "Inter" }
}`;

  const extraRules =
    template === "inmobiliarias"
      ? `- INMOBILIARIA en Lima/Peru: propiedades con tipo (depto/casa/oficina), distrito real (Miraflores, Surco, San Isidro, La Molina, etc.) y rango de precio o m² plausible.
- Menciona el nombre "${lead.name}" en quienes_somos y hero.tagline.
- stats: cifras creíbles para una inmobiliaria LOCAL (no +500 colaboradores ni 5 países).
- testimonios: citan compra/alquiler/tasación con distrito.`
      : template === "corporativo"
        ? `- Es una empresa pequeña/mediana en Lima, NO un holding global.
- servicios/casos deben reflejar maps_category y reseñas.`
        : `- Cada item debe ser específico del rubro y del negocio.`;

  return wrapCopyPrompt(
    lead,
    `Plantilla: ${template}. Color marca: #${brandPrimary}
Gaps comerciales: ${(lead.gaps || []).join(", ") || "ninguno"}
Pitch: ${lead.pitch_angle || "—"}
Bio redes: ${lead.social?.bio || lead.bio || "—"}
Genera copy para secciones: ${ids}
${extraRules}
${schema}
Testimonios: mínimo 4 si la sección está en la lista. SOLO JSON válido.`,
  );
}
