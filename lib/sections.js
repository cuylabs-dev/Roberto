// Catálogo de secciones modulares (sincronizado con Plantillas-Web-Maestra/src/catalog)

export const SECTION_CATALOG = {
  gimnasios: [
    "hero", "stats", "entrenamiento", "coaches_campeones", "planes", "beneficios", "coaches",
    "eventos", "eventos_peleas", "horarios", "galeria", "testimonios", "faq", "cta", "contacto",
  ],
  clinicas: [
    "hero", "servicios", "equipo", "precios", "reservas", "antes_despues", "seguros",
    "faq", "ubicacion", "cta", "contacto", "confianza",
  ],
  colegios: [
    "hero", "niveles", "metodologia", "admision", "vida_escolar", "instalaciones",
    "docentes", "calendario", "faq", "padres", "cta", "contacto",
  ],
  tiendas: [
    "hero", "prime_banner", "categorias", "filas", "grid_catalogo", "destacados", "ofertas",
    "envios", "reviews", "faq", "cta", "contacto",
  ],
  corporativo: [
    "hero", "stats_holding", "metricas", "quienes_somos", "lineas_negocio", "valores", "prioridades",
    "presencia", "noticias", "marcas", "sostenibilidad", "servicios", "casos", "metodologia", "equipo",
    "industrias", "partners", "faq", "cta", "contacto", "galeria",
  ],
  hoteles: [
    "hero", "habitaciones", "amenidades", "reservas", "ubicacion", "galeria", "testimonios", "faq", "cta", "contacto",
  ],
  inmobiliarias: [
    "hero", "busqueda", "propiedades", "zonas", "servicios", "proceso", "stats", "quienes_somos", "equipo",
    "galeria", "testimonios", "faq", "cta", "contacto",
  ],
};

/** Secciones por defecto si la URL no trae sec= */
export const DEFAULT_SECTIONS = {
  gimnasios: [
    "hero", "stats", "entrenamiento", "coaches_campeones", "planes", "eventos", "beneficios", "faq", "contacto",
  ],
  clinicas: ["hero", "servicios", "equipo", "precios", "reservas", "faq", "cta", "contacto"],
  colegios: ["hero", "niveles", "metodologia", "admision", "instalaciones", "faq", "cta", "contacto"],
  tiendas: ["hero", "prime_banner", "categorias", "filas", "grid_catalogo", "ofertas", "envios", "contacto"],
  corporativo: [
    "hero", "servicios", "casos", "metodologia", "metricas", "equipo", "faq", "cta", "contacto",
  ],
  hoteles: ["hero", "habitaciones", "amenidades", "reservas", "ubicacion", "galeria", "faq", "contacto"],
  inmobiliarias: [
    "hero", "propiedades", "zonas", "servicios", "proceso", "quienes_somos", "testimonios", "faq", "cta", "contacto",
  ],
};

/** Secciones sugeridas por tier web (fallback sin Gemini) */
export const SECTIONS_BY_TIER = {
  no_web: {
    gimnasios: ["hero", "stats", "planes", "beneficios", "testimonios", "faq", "cta", "contacto"],
    clinicas: ["hero", "servicios", "precios", "confianza", "faq", "cta", "contacto"],
    colegios: ["hero", "niveles", "admision", "instalaciones", "faq", "cta", "contacto"],
    tiendas: ["hero", "categorias", "destacados", "tienda_fisica", "faq", "cta", "contacto"],
    corporativo: ["hero", "servicios", "casos", "metricas", "faq", "cta", "contacto"],
    hoteles: ["hero", "habitaciones", "amenidades", "reservas", "faq", "cta", "contacto"],
    inmobiliarias: ["hero", "propiedades", "servicios", "proceso", "testimonios", "faq", "cta", "contacto"],
  },
  social_only: {
    gimnasios: ["hero", "entrenamiento", "planes", "testimonios", "faq", "cta", "contacto"],
    clinicas: ["hero", "servicios", "reservas", "confianza", "faq", "cta", "contacto"],
    colegios: ["hero", "metodologia", "vida_escolar", "padres", "faq", "cta", "contacto"],
    tiendas: ["hero", "destacados", "lookbook", "reviews", "cta", "contacto"],
    corporativo: ["hero", "servicios", "metodologia", "partners", "cta", "contacto"],
    hoteles: ["hero", "habitaciones", "reservas", "ubicacion", "faq", "contacto"],
    inmobiliarias: ["hero", "propiedades", "zonas", "servicios", "cta", "contacto"],
  },
  weak_web: {
    gimnasios: ["hero", "stats", "coaches_campeones", "planes", "eventos", "horarios", "faq", "contacto"],
    clinicas: ["hero", "servicios", "antes_despues", "reservas", "ubicacion", "faq", "contacto"],
    colegios: ["hero", "docentes", "calendario", "admision", "faq", "contacto"],
    tiendas: ["hero", "categorias", "ofertas", "envios", "faq", "contacto"],
    corporativo: ["hero", "casos", "equipo", "industrias", "faq", "contacto"],
    hoteles: ["hero", "amenidades", "habitaciones", "reservas", "galeria", "contacto"],
    inmobiliarias: ["hero", "propiedades", "proceso", "testimonios", "galeria", "contacto"],
  },
};

export function parseSectionIds(csv, template) {
  const allowed = new Set(SECTION_CATALOG[template] || []);
  if (!csv || typeof csv !== "string") return null;
  const ids = csv
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => allowed.has(s));
  return ids.length ? ids : null;
}

export function resolveSections(template, ids, tier) {
  const catalog = SECTION_CATALOG[template];
  if (!catalog) return DEFAULT_SECTIONS.gimnasios;
  let list = ids?.length ? ids : null;
  if (!list && tier && SECTIONS_BY_TIER[tier]?.[template]) {
    list = SECTIONS_BY_TIER[tier][template];
  }
  if (!list) list = DEFAULT_SECTIONS[template] || catalog.slice(0, 8);
  const seen = new Set();
  const out = [];
  for (const id of list) {
    if (catalog.includes(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
    if (out.length >= 12) break;
  }
  if (!out.includes("hero")) out.unshift("hero");
  if (!out.includes("contacto")) out.push("contacto");
  return out.slice(0, 12);
}

export function clampSectionsForGemini(parsed, template) {
  if (!Array.isArray(parsed)) return null;
  const allowed = new Set(SECTION_CATALOG[template] || []);
  return parsed
    .map((s) => String(s).trim().toLowerCase())
    .filter((s) => allowed.has(s))
    .slice(0, 12);
}
