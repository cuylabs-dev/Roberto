// ============================================================================
// rotacion.js — Reparte LEADS_PER_DAY entre 12 rubros locales (rotacion diaria).
// ============================================================================

import { config } from "./config.js";
import { RUBROS_LOCALES } from "./rubrosCatalog.js";

/** Plan de busqueda: query Maps + nicho Notion + plantilla factoría. */
export const NICHE_QUERIES = RUBROS_LOCALES.map((r) => ({
  query: r.query,
  nicho: r.nicho,
  template: r.template,
  rubroId: r.id,
}));

function distributeBalanced(total, slots) {
  const base = Math.floor(total / slots);
  const rem = total % slots;
  return Array.from({ length: slots }, (_, i) => base + (i < rem ? 1 : 0));
}

function rotateQueries() {
  const offset = new Date().getDate() % NICHE_QUERIES.length;
  return [...NICHE_QUERIES.slice(offset), ...NICHE_QUERIES.slice(0, offset)];
}

function planBalance(total) {
  const rotated = rotateQueries();
  const activeSlots = Math.min(total, rotated.length);
  const counts = distributeBalanced(total, activeSlots);
  return rotated.slice(0, activeSlots).map((n, i) => ({
    query: n.query,
    nicho: n.nicho,
    template: n.template,
    rubroId: n.rubroId,
    limit: counts[i],
  })).filter((p) => p.limit > 0);
}

function planRandom(total) {
  const buckets = NICHE_QUERIES.map((n) => ({ ...n, limit: 0 }));
  for (let i = 0; i < total; i++) {
    const pick = NICHE_QUERIES[Math.floor(Math.random() * NICHE_QUERIES.length)];
    buckets.find((b) => b.query === pick.query).limit++;
  }
  return buckets.filter((p) => p.limit > 0);
}

function planSingle() {
  const q = config.searchQuery || NICHE_QUERIES[0].query;
  const match =
    NICHE_QUERIES.find((n) => n.query.toLowerCase() === q.toLowerCase()) ||
    NICHE_QUERIES[0];
  return [
    {
      query: q,
      nicho: config.nichoNotion || match.nicho,
      template: match.template,
      rubroId: match.rubroId,
      limit: config.leadsPerDay,
    },
  ];
}

export function planBusquedas(totalLeads = config.leadsPerDay) {
  const mode = (config.searchMode || "balance").toLowerCase();
  if (mode === "single") return planSingle();
  if (mode === "random") return planRandom(totalLeads);
  return planBalance(totalLeads);
}

export function describePlan(plan) {
  return plan.map((p) => `${p.nicho}×${p.limit}`).join(" | ");
}
