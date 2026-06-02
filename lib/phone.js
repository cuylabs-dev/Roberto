// Normaliza un telefono peruano a formato E.164 ligero: +51XXXXXXXXX (9 digitos).
// Devuelve { e164, raw, valid }.
export function normalizePhonePE(raw) {
  if (!raw) return { e164: null, raw: raw ?? null, valid: false };

  // Quita todo lo que no sea digito.
  let digits = String(raw).replace(/[^\d]/g, "");

  // Quita prefijo internacional 0051 o 51 si aplica.
  if (digits.startsWith("0051")) digits = digits.slice(4);
  else if (digits.startsWith("51") && digits.length > 9) digits = digits.slice(2);

  // Un celular peruano valido tiene 9 digitos y empieza en 9.
  if (digits.length === 9 && digits.startsWith("9")) {
    return { e164: `+51${digits}`, raw, valid: true };
  }

  // Fijos u otros: si quedaron 9 digitos igual lo aceptamos como best-effort.
  if (digits.length === 9) {
    return { e164: `+51${digits}`, raw, valid: true };
  }

  return { e164: null, raw, valid: false };
}

// Para wa.me se usa el numero sin "+": 51XXXXXXXXX
export function toWaNumber(e164) {
  if (!e164) return null;
  return e164.replace(/^\+/, "");
}
