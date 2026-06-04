/**
 * Nombres y titulos cortos para hero (evita romper el layout).
 */

const SEDE_SUFFIX =
  /\s*[-–|]\s*(sede\s+.+|la molina|miraflores|surco|san isidro|san borja|lince|los olivos|callao|centro|norte|este|sur)$/i;

/** Quita " - Sede La Molina" y similares del nombre comercial. */
export function shortenBrandName(name, maxLen = 44) {
  if (!name || typeof name !== "string") return "Tu negocio";
  let s = name.trim();
  for (let i = 0; i < 3 && SEDE_SUFFIX.test(s); i++) {
    s = s.replace(SEDE_SUFFIX, "").trim();
  }
  s = s.replace(/\s{2,}/g, " ");
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1).trim()}…`;
}

export function truncateText(text, maxLen) {
  if (!text || typeof text !== "string") return "";
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1).trim()}…`;
}

/** Headline listo para hero: corto y sin sede redundante. */
export function formatHeroHeadline(headline, businessName, maxLen = 52) {
  const short = shortenBrandName(businessName, 40);
  let h = (headline || "").trim();
  if (!h) return `Descubre ${short}`;
  h = h.replace(SEDE_SUFFIX, "").trim();
  if (h.length > maxLen) return truncateText(h, maxLen);
  if (businessName && h.length > maxLen + 15 && h.includes(businessName)) {
    return truncateText(h.replace(businessName, short), maxLen);
  }
  return h;
}

export function formatHeroSubhead(subhead, maxLen = 150) {
  const banned =
    /servicios integrales de salud|plena recuperaci[oó]n|equipo multidisciplinario|vanguardia para lograr/i;
  let s = (subhead || "").trim();
  if (banned.test(s)) return "";
  return truncateText(s, maxLen);
}
