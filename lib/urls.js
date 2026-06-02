import { config } from "./config.js";
import { toWaNumber } from "./phone.js";

// Construye la Maqueta URL segun el Contrato de URL.
// https://<factoria>/?cliente=&template=&color=&font=&blocks=
export function buildMaquetaUrl({ name, template, color, font, blocks }) {
  const p = new URLSearchParams();
  p.set("cliente", name || "Tu Negocio");
  p.set("template", template);
  p.set("color", color);
  p.set("font", font);
  if (Array.isArray(blocks) && blocks.length > 0) {
    p.set("blocks", blocks.join(","));
  }
  return `${config.factoriaBaseUrl}/?${p.toString()}`;
}

// https://wa.me/51XXXXXXXXX?text=<urlencoded>
export function buildWaLink(phoneE164, text) {
  const num = toWaNumber(phoneE164);
  if (!num) return null;
  const t = encodeURIComponent(text || "");
  return `https://wa.me/${num}?text=${t}`;
}
