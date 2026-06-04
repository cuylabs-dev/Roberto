/**
 * Manifest de marca (kit) para factoría L3–L4.
 */
import { config } from "./config.js";
import { inferBrandFromName, normalizeHex, nearestColorEnum, resolveBrandIdentity } from "./brand.js";
import { resolveTemplateFromLead, blocksForTemplate } from "./templatePolicy.js";
import { LlmQuotaError } from "./llm/errors.js";
import { rehostGalleryToBlob } from "./imageRehost.js";
import { publishKit, saveKitLocal } from "./kitStorage.js";
import { ensureLeadImagesOnBlob } from "./blobAssets.js";
import {
  wrapCopyPrompt,
  llmGenerateValidatedJson,
  sectionsCopyIsGeneric,
} from "./copyQuality.js";

const FONT_PAIRS = {
  gimnasios: { heading: "Montserrat", body: "Inter" },
  colegios: { heading: "Playfair Display", body: "Inter" },
  clinicas: { heading: "Poppins", body: "Inter" },
  tiendas: { heading: "Poppins", body: "Roboto" },
  corporativo: { heading: "Inter", body: "Roboto" },
  hoteles: { heading: "Inter", body: "Roboto" },
};

export function slugify(name) {
  const base = (name || "negocio")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${base}-${day}`;
}

function safeParseJson(text) {
  if (!text) return null;
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function defaultSectionsCopy(template, lead) {
  const name = lead.name || "Tu negocio";
  const byTemplate = {
    gimnasios: {
      planes: {
        title: "Membresías",
        subtitle: `Planes flexibles en ${name}`,
        items: ["Pase día S/ 25", "Mensual S/ 149", "Trimestral con evaluación física"],
      },
      testimonios: [
        { quote: `En ${name} los coaches corrigen técnica en cada clase.`, author: "Ana M.", role: "Miembro" },
        { quote: "Ambiente que motiva sin presión.", author: "Luis R.", role: "Plan mensual" },
        { quote: "Horarios que se adaptan a mi trabajo.", author: "Carla V.", role: "6 meses" },
        { quote: "La mejor inversión del año.", author: "Diego F.", role: "Open gym" },
        { quote: "Primera clase gratis me convenció.", author: "Marco T.", role: "Nuevo" },
        { quote: "Comunidad real, no solo máquinas.", author: "Patricia S.", role: "Familiar" },
      ],
      stats: { items: ["+500 activos", "12 coaches", "7 días abierto", "4.9 en Google"] },
    },
    clinicas: {
      servicios: { title: "Especialidades", items: ["Consulta general", "Odontología", "Limpieza", "Urgencias"] },
      testimonios: [
        { quote: "Atención humana desde la primera cita.", author: "María L.", role: "Paciente" },
        { quote: "Instalaciones limpias y modernas.", author: "Jorge P.", role: "Familia" },
      ],
    },
    colegios: {
      niveles: { title: "Niveles", items: ["Inicial", "Primaria", "Secundaria"] },
      testimonios: [
        { quote: "Excelente acompañamiento a las familias.", author: "Mamá de alumno", role: "3ro primaria" },
      ],
    },
    tiendas: {
      destacados: { title: "Destacados", items: ["Novedades", "Ofertas", "Más vendidos"] },
    },
    hoteles: {
      habitaciones: {
        title: "Habitaciones",
        subtitle: `Descanso en ${name}`,
        items: ["Suite ejecutiva", "Doble matrimonial", "Twin estándar", "Family room"],
      },
      amenidades: {
        title: "Amenidades",
        items: ["WiFi alta velocidad", "Desayuno incluido", "Estacionamiento", "Room service"],
      },
      reservas: { title: "Reserva directa", subtitle: "Mejor tarifa sin comisiones" },
      testimonios: [
        { quote: `Muy buena ubicación y atención en ${name}.`, author: "Huésped", role: "Booking" },
      ],
    },
    corporativo: {
      metricas: {
        items: ["+35 proyectos", "8 industrias", "ROI 90 dias", "Equipo senior Lima"],
      },
      servicios: {
        title: "Como te ayudamos",
        subtitle: `Servicios de ${name} pensados para tu etapa actual`,
        items: ["Diagnostico express", "Plan 90 dias", "Implementacion", "Seguimiento mensual"],
      },
      casos: {
        title: "Resultados recientes",
        subtitle: `Clientes que confiaron en ${name}`,
        items: ["Retail: +22% ventas", "Clinica: agenda online", "Gym: +180 leads/mes"],
      },
      metodologia: {
        title: "Metodo",
        subtitle: "Claro, medible y sin humo",
        items: ["Descubrimiento", "Diseno", "Ejecucion", "Mejora continua"],
      },
      equipo: {
        title: "Quien te acompana",
        items: ["Consultor senior", "Especialista sector", "Soporte dedicado"],
      },
      testimonios: [
        { quote: `${name} entendio nuestro negocio desde la primera reunion.`, author: "Director", role: "PYME" },
        { quote: "Dejamos de improvisar; hoy tenemos plan y metricas.", author: "Gerente", role: "Servicios" },
        { quote: "La maqueta web nos ayudo a cerrar dos clientes nuevos.", author: "Fundador", role: "Consultora" },
        { quote: "Equipo cercano, sin plantillas copiadas.", author: "COO", role: "Retail" },
        { quote: "Implementacion rapida y soporte real.", author: "Mariana L.", role: "Clinica" },
        { quote: "Recomendados para B2B en Lima.", author: "Carlos R.", role: "Logistica" },
      ],
    },
  };
  const base = byTemplate[template] || byTemplate.corporativo;
  const seed = (lead.name || "").length % 3;
  if (template === "corporativo" && base.servicios?.items) {
    base.servicios.items = [...base.servicios.items];
    base.servicios.items[0] = `${base.servicios.items[0]} (${seed + 1})`;
  }
  return base;
}

const SECTIONS_PROMPT = (lead, template, sections, base) => {
  const ids = sections.join(", ");
  return wrapCopyPrompt(
    lead,
    `Rubro plantilla: ${template}. Color: #${base.brand_primary}
Gaps: ${(lead.gaps || []).join(", ")}
Genera copy para secciones: ${ids}
Cada item en listas debe ser un servicio/plan REAL del rubro (nunca "Servicio Principal" ni numerados genericos).
SOLO JSON:
{
  "sectionsCopy": {
    "planes": { "title": "", "subtitle": "", "items": ["",""] },
    "testimonios": [{ "quote": "", "author": "", "role": "" }],
    "stats": { "items": ["",""] }
  },
  "fonts": { "heading": "Montserrat", "body": "Inter" },
  "tone": "energico_directo"
}
Incluye solo las secciones listadas. Testimonios: minimo 6 si hay testimonios.`,
  );
};

export async function generateSectionsCopy(lead, template, sections, brandPrimary) {
  const base = { brand_primary: brandPrimary };
  try {
    const { parsed } = await llmGenerateValidatedJson({
      task: "sections",
      buildPrompt: () => SECTIONS_PROMPT(lead, template, sections, base),
      validate: (p) => p?.sectionsCopy && !sectionsCopyIsGeneric(p.sectionsCopy),
    });
    if (parsed?.sectionsCopy) return parsed;
  } catch (err) {
    if (!(err instanceof LlmQuotaError)) {
      console.log(`   Kit secciones: ${String(err.message).split("\n")[0]}`);
    }
  }
  return null;
}

export function buildBrandKit(lead, evalResult, social = {}) {
  const template =
    resolveTemplateFromLead(lead) || evalResult.template || lead.template || "corporativo";
  const identity = resolveBrandIdentity(lead, template);
  const primary =
    normalizeHex(evalResult.brand_primary) ||
    normalizeHex(lead.brand_primary) ||
    normalizeHex(identity.brand_primary) ||
    "2563eb";

  const inferred = inferBrandFromName(lead.name, template);
  const secondary =
    normalizeHex(evalResult.brand_secondary) ||
    normalizeHex(lead.brand_secondary) ||
    (inferred.brandLocked && template === "gimnasios" ? "0f172a" : "ffffff");
  const surface = template === "gimnasios" && primary.startsWith("f97") ? "fff7ed" : "f8fafc";

  const gallery = [];
  if (lead.maps_photo_blob || lead.maps_photo_url) {
    gallery.push(lead.maps_photo_blob || lead.maps_photo_url);
  }
  if (lead.logo_url) gallery.push(lead.logo_url);
  if (social.gallery?.length) gallery.push(...social.gallery);
  else if (social.post_images?.length) gallery.push(...social.post_images);

  const uniqueGallery = [...new Set(gallery.filter((u) => u && u.startsWith("http")))].slice(0, 8);

  const sections = evalResult.sections || [];
  const defaults = defaultSectionsCopy(template, lead);
  let sectionsCopy = defaults;
  let fonts = FONT_PAIRS[template] || FONT_PAIRS.corporativo;
  let tone = "profesional_cercano";

  const slug = slugify(lead.name);

  const kit = {
    slug,
    cliente: lead.name,
    template,
    variant: evalResult.variant || identity.variant,
    color: evalResult.color || nearestColorEnum(primary),
    colorEnum: evalResult.color || nearestColorEnum(primary),
    font: evalResult.font || "inter",
    colors: {
      primary,
      secondary,
      accent: "ffffff",
      surface,
    },
    fonts,
    logo: lead.logo_url || social.avatar_url || null,
    heroImage: lead.maps_photo_blob || lead.hero_image_url || uniqueGallery[0] || null,
    gallery: uniqueGallery,
    instagram: social.instagram_handle || null,
    bio: social.bio || null,
    tone,
    copy: {
      head: evalResult.headline,
      sub: evalResult.subhead,
      eyebrow: evalResult.eyebrow,
    },
    sections,
    sectionsCopy,
    wa_text: evalResult.wa_text,
    gaps: lead.gaps || [],
    pitch_angle: evalResult.pitch_angle || lead.pitch_angle,
    phone_e164: lead.phone_e164,
    maps_category: lead.maps_category || null,
    review_keywords: lead.review_keywords || [],
    nicho: lead.nicho || null,
    email: lead.email || null,
    blocks: evalResult.blocks?.length ? evalResult.blocks : blocksForTemplate(template),
    llm: evalResult.llm_meta || null,
    createdAt: new Date().toISOString(),
  };

  return kit;
}

export async function finalizeBrandKit(kit, lead = null) {
  if (lead) {
    await ensureLeadImagesOnBlob(lead, kit.slug);
    if (!lead.maps_photo_blob && !lead.logo_url?.includes("blob.vercel-storage.com")) {
      console.log(`   ! Sin imagen en Blob para ${kit.cliente} — revisar token o foto Maps`);
    }
    if (lead.logo_url) kit.logo = lead.logo_url;
    if (lead.maps_photo_blob || lead.hero_image_url) {
      kit.heroImage = lead.maps_photo_blob || lead.hero_image_url || kit.heroImage;
    }
    const g = [kit.heroImage, kit.logo, ...(kit.gallery || [])].filter(
      (u) => u?.startsWith("http"),
    );
    kit.gallery = [...new Set(g)].slice(0, 8);
  }

  const llmExtra = await generateSectionsCopy(
    lead || {
      name: kit.cliente,
      gaps: kit.gaps,
      pitch_angle: kit.pitch_angle,
      maps_category: kit.maps_category,
      review_keywords: kit.review_keywords,
      nicho: kit.nicho,
    },
    {
      name: kit.cliente,
      gaps: kit.gaps,
      pitch_angle: kit.pitch_angle,
    },
    kit.template,
    kit.sections,
    kit.colors.primary,
  );

  if (llmExtra?.sectionsCopy) {
    kit.sectionsCopy = { ...kit.sectionsCopy, ...llmExtra.sectionsCopy };
  }
  if (llmExtra?.fonts) kit.fonts = llmExtra.fonts;
  if (llmExtra?.tone) kit.tone = llmExtra.tone;

  if (kit.gallery?.length) {
    kit.gallery = await rehostGalleryToBlob(kit.slug, kit.gallery);
    kit.gallery = kit.gallery.filter((u) => u?.includes("blob.vercel-storage.com"));
    if (kit.heroImage && !kit.heroImage.includes("blob.vercel-storage.com")) {
      const [hero] = await rehostGalleryToBlob(kit.slug, [kit.heroImage]);
      if (hero?.includes("blob.vercel-storage.com")) kit.heroImage = hero;
    }
    if (kit.logo && !kit.logo.includes("blob.vercel-storage.com")) {
      const [logo] = await rehostGalleryToBlob(kit.slug, [kit.logo]);
      if (logo?.includes("blob.vercel-storage.com")) kit.logo = logo;
    }
  }

  saveKitLocal(kit);
  const pub = await publishKit(kit);
  kit.publish = pub;
  return kit;
}
