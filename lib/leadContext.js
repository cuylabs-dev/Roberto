/**
 * Contexto factual del lead para prompts (Maps, reseñas, rubro).
 */
const STOP = new Set(
  "de la el en y a los las un una para con que del al es muy mas bien buen buena excelente recomiendo lugar atencion servicio".split(
    " ",
  ),
);

export function extractReviewKeywords(reviewSnippets = [], max = 8) {
  const freq = new Map();
  for (const raw of reviewSnippets) {
    const words = String(raw || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOP.has(w));
    for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([w]) => w);
}

export function buildLeadContextBlock(lead) {
  const cat = lead.maps_category || lead.category || "—";
  const rubro = lead.nicho || lead.search_query || "—";
  const kw = (lead.review_keywords || []).slice(0, 8).join(", ") || "—";
  const reviews = (lead.review_snippets || []).slice(0, 2).join(" | ") || "—";
  return [
    `Negocio: "${lead.name}"`,
    `Categoria Google Maps: ${cat}`,
    `Rubro busqueda: ${rubro}`,
    `Palabras clave reseñas (obligatorio usar): ${kw}`,
    `Fragmentos reseñas: ${reviews}`,
    `Direccion: ${lead.address || "Lima, Peru"}`,
    lead.email ? `Correo: ${lead.email}` : "",
    lead.template_hint ? `Plantilla: ${lead.template_hint}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export const COPY_STRICT_RULES = `REGLAS ESTRICTAS:
- PROHIBIDO inventar servicios genericos: "Servicio Principal", "Servicio 1/2/3", "Producto 1", "Item 1", placeholder, lorem ipsum, "Tu negocio", "Nombre del negocio".
- Cada servicio/plan/item DEBE ser especifico del rubro y coherente con la categoria Maps y las palabras clave de reseñas.
- Ejemplo clinica dental: "Blanqueamiento Laser", "Ortodoncia Invisible" — NO "Consulta general" suelto si hay datos de especialidad en reseñas.
- Copy en espanol Peru, tono comercial real.`;
