export class LlmQuotaError extends Error {
  constructor(message = "Cuota agotada en todos los proveedores LLM") {
    super(message);
    this.name = "LlmQuotaError";
  }
}

export function isQuotaError(err) {
  const m = String(err?.message || err);
  return (
    m.includes("429") ||
    m.includes("quota") ||
    m.includes("RESOURCE_EXHAUSTED") ||
    m.includes("rate_limit") ||
    m.includes("Rate limit")
  );
}

export function isModelGone(err) {
  const m = String(err?.message || err);
  return m.includes("404") || m.includes("not found") || m.includes("is not supported");
}
