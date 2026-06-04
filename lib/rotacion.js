// ============================================================================
// rotacion.js — Reparte LEADS_PER_DAY entre los 10 nichos de templatePolicy.js (balance | single).
// ============================================================================

import { config } from "./config.js";
import { NICHE_QUERIES } from "./templatePolicy.js";

function distributeBalanced(total, slots) {
  const base = Math.floor(total / slots);
  const rem = total % slots;
  return Array.from({ length: slots }, (_, i) => base + (i < rem ? 1 : 0));
}

function planBalance(total) {
  const counts = distributeBalanced(total, NICHE_QUERIES.length);
  return NICHE_QUERIES.map((n, i) => ({
    query: n.query,
    nicho: n.nicho,
    template: n.template,
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

export { NICHE_QUERIES };
