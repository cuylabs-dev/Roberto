/**
 * Prueba rápida de filtro cadenas / webs fuertes.
 * Uso: node scripts/audit-chains.js
 */
import { qualifyFast } from "../lib/qualify.js";

const cases = [
  { name: "H&M Miraflores", has_website: true, website_url: "https://www2.hm.com/" },
  { name: "Adidas Store Lima", has_website: true, website_url: "https://www.adidas.pe/" },
  { name: "Smart Fit - Santa Cruz", has_website: true, website_url: "https://www.smartfit.com.pe/" },
  { name: "Baransu Gym", has_website: false },
  { name: "Bunker Gym Surquillo", has_website: false },
  { name: "Boutique Rosa Local", has_website: false },
];

for (const c of cases) {
  const r = qualifyFast(c);
  console.log(
    r.reject ? "REJECT" : "OK    ",
    c.name.padEnd(28),
    r.reject_reason || r.tier,
  );
}
