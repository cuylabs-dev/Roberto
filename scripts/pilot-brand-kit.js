/**
 * Piloto offline: valida checklist Baransu (brand kit + URL corta).
 * Uso: node scripts/pilot-brand-kit.js
 */
import { buildBrandKit, finalizeBrandKit } from "../lib/brandKit.js";
import { buildMaquetaUrl } from "../lib/urls.js";
import { loadKitLocal } from "../lib/kitStorage.js";

const BARANSU_LEAD = {
  name: "Baransu Gym",
  template: "gimnasios",
  gaps: ["sin_sitio_web"],
  logo_url: "https://maps.gstatic.com/mapfiles/place_api/icons/v1/png_71/generic_business-71.png",
  phone_e164: "+51999888777",
};

const EVAL = {
  template: "gimnasios",
  variant: "fit",
  color: "orange",
  font: "montserrat",
  brand_primary: "f97316",
  headline: "Baransu Gym: entrena fuerte en Lima",
  subhead: "Sin web propia, tu marca se pierde en Maps. Te mostramos cómo se vería tu sitio.",
  eyebrow: "Gimnasio · Miraflores",
  sections: ["planes", "testimonios", "stats", "galeria"],
  pitch_angle: "sin_sitio_web",
  wa_text: "Hola, vi la maqueta de Baransu Gym...",
};

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

async function main() {
  console.log("=== Piloto Brand Kit (Baransu) ===\n");

  const social = {
    instagram_handle: "@baransugym",
    bio: "Crossfit y fuerza · Lima",
    gallery: [
      "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800",
      "https://images.unsplash.com/photo-1571907480496-893c7c2a4b4a?w=800",
    ],
  };

  let kit = buildBrandKit(BARANSU_LEAD, EVAL, social);
  kit = await finalizeBrandKit(kit);

  const pri = kit.colors.primary.toLowerCase();
  assert(pri === "f97316" || pri.startsWith("f97"), `color primario naranja, got ${pri}`);
  assert(kit.colors.secondary === "0f172a", "secondary negro para gym locked");
  assert((kit.gallery?.length || 0) >= 2, "galería con fotos");
  const testimonials = kit.sectionsCopy?.testimonios || [];
  assert(testimonials.length >= 6, `mínimo 6 testimonios, got ${testimonials.length}`);
  assert(kit.copy?.head?.includes("Baransu") || kit.copy?.sub?.includes("web"), "copy menciona negocio o gap");

  const url = buildMaquetaUrl({
    name: BARANSU_LEAD.name,
    kitSlug: kit.slug,
    phone_e164: BARANSU_LEAD.phone_e164,
  });
  assert(url.includes("?kit="), "URL corta con kit=");
  assert(!url.includes("pri="), "URL sin pri= legacy");

  const loaded = loadKitLocal(kit.slug);
  assert(loaded?.slug === kit.slug, "kit guardado en data/kits/");

  console.log("OK  Color naranja/negro");
  console.log("OK  Galería", kit.gallery.length, "imgs");
  console.log("OK  Testimonios", testimonials.length);
  console.log("OK  Kit slug:", kit.slug);
  console.log("OK  Maqueta:", url);
  if (kit.publish) console.log("OK  Publish:", kit.publish.provider, kit.publish.url || "(local)");
  else console.log("   Publish: solo local (sin BLOB/SUPABASE token)");
  console.log("\n=== Piloto PASS ===");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
