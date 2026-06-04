import { config } from "./config.js";
import { toWaNumber } from "./phone.js";
import { logoForUrl, normalizeHex } from "./brand.js";

// Construye la Maqueta URL segun el Contrato de URL.
// https://<factoria>/?cliente=&template=&color=&font=&blocks=&sec=&head=&sub=&eb=&pri=&logo=
export function buildMaquetaUrl({
  name,
  template,
  color,
  font,
  blocks,
  sections,
  headline,
  subhead,
  eyebrow,
  brand_primary,
  brand_secondary,
  logo_url,
  variant,
  phone_e164,
  wa_link,
  kitSlug,
  fontHeading,
  fontBody,
}) {
  const p = new URLSearchParams();

  if (kitSlug) {
    p.set("kit", kitSlug);
    p.set("cliente", name || "Tu Negocio");
    if (template) p.set("template", template);
    if (color) p.set("color", color);
    const pri = normalizeHex(brand_primary);
    if (pri) p.set("pri", pri);
    const sec = normalizeHex(brand_secondary);
    if (sec) p.set("sec", sec);
    const wa =
      wa_link ||
      (phone_e164 ? buildWaLink(phone_e164, "").replace(/\?text=.*$/, "") : null);
    if (wa) {
      const num = wa.replace(/^https:\/\/wa\.me\//, "").split("?")[0];
      if (num) p.set("wa", num);
    }
    return `${config.factoriaBaseUrl}/?${p.toString()}`;
  }

  p.set("cliente", name || "Tu Negocio");
  p.set("template", template);
  p.set("color", color);
  p.set("font", font);
  if (fontHeading) p.set("fontH", fontHeading.slice(0, 32));
  if (fontBody) p.set("fontB", fontBody.slice(0, 32));
  if (Array.isArray(blocks) && blocks.length > 0) {
    p.set("blocks", blocks.join(","));
  }
  if (Array.isArray(sections) && sections.length > 0) {
    p.set("sec", sections.join(","));
  }
  if (headline) p.set("head", headline);
  if (subhead) p.set("sub", subhead);
  if (eyebrow) p.set("eb", eyebrow);

  const pri = normalizeHex(brand_primary);
  if (pri) p.set("pri", pri);

  if (variant && template === "gimnasios") p.set("v", variant);

  const logo = logoForUrl(logo_url);
  if (logo) p.set("logo", logo);

  const wa =
    wa_link ||
    (phone_e164 ? buildWaLink(phone_e164, "").replace(/\?text=.*$/, "") : null);
  if (wa) {
    const num = wa.replace(/^https:\/\/wa\.me\//, "").split("?")[0];
    if (num) p.set("wa", num);
  }

  const url = `${config.factoriaBaseUrl}/?${p.toString()}`;
  if (url.length > 7500) {
    p.delete("logo");
    return `${config.factoriaBaseUrl}/?${p.toString()}`;
  }
  return url;
}

export function buildWaLink(phoneE164, text) {
  const num = toWaNumber(phoneE164);
  if (!num) return null;
  const t = encodeURIComponent(text || "");
  return `https://wa.me/${num}?text=${t}`;
}
