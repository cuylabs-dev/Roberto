// ============================================================================
// rotacion.js — Reparte LEADS_PER_DAY entre varios nichos (sin tocar .env cada dia).
// Modos: balance (igual 2-2-2-2-2), random, single (solo SEARCH_QUERY).
// ============================================================================

import { config } from "./config.js";

/** Nichos que rota el bot por defecto (Lima). */
export const NICHE_QUERIES = [
  { query: "gimnasio local Lima", nicho: "Gym", template: "gimnasios" },
  { query: "colegios Lima", nicho: "Colegio", template: "colegios" },
  { query: "clinica dental barrio Lima", nicho: "Clínica", template: "clinicas" },
  { query: "boutique ropa independiente Lima", nicho: "Tienda", template: "tiendas" },
  { query: "consultora pequeña empresas Lima", nicho: "Corporativo", template: "corporativo" },
];

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

/**
 * Devuelve [{ query, nicho, template, limit }] para FASE 1.
 */
export function planBusquedas(totalLeads = config.leadsPerDay) {
  const mode = (config.searchMode || "balance").toLowerCase();
  if (mode === "single") return planSingle();
  if (mode === "random") return planRandom(totalLeads);
  return planBalance(totalLeads);
}

export function describePlan(plan) {
  return plan.map((p) => `${p.nicho}×${p.limit} (${p.query})`).join(" | ");
}
