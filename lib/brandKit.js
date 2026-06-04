/**
 * Manifest de marca (kit) para factoría L3–L4.
 */
import { config } from "./config.js";
import { inferBrandFromName, normalizeHex, nearestColorEnum, resolveBrandIdentity } from "./brand.js";
import { llmGenerate } from "./llm/router.js";
import { LlmQuotaError } from "./llm/errors.js";
import { rehostGalleryToBlob } from "./imageRehost.js";
import { publishKit, saveKitLocal } from "./kitStorage.js";

const FONT_PAIRS = {
  gimnasios: { heading: "Montserrat", body: "Inter" },
  colegios: { heading: "Playfair Display", body: "Inter" },
  clinicas: { heading: "Poppins", body: "Inter" },
  tiendas: { heading: "Poppins", body: "Roboto" },
  corporativo: { heading: "Inter", body: "Roboto" },
};

function slugify(name) {
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
    corporativo: {
      servicios: { title: "Servicios", items: ["Consultoría", "Implementación", "Soporte"] },
    },
  };
  return byTemplate[template] || byTemplate.corporativo;
}

const SECTIONS_PROMPT = (lead, template, sections, base) => {
  const ids = sections.join(", ");
  return `Copywriter Peru. Negocio: "${lead.name}". Rubro: ${template}.
Gaps: ${(lead.gaps || []).join(", ")}
Color: #${base.brand_primary}
Genera copy para secciones: ${ids}
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
Incluye solo las secciones listadas. Testimonios: minimo 6 si hay testimonios.`;
};

export async function generateSectionsCopy(lead, template, sections, brandPrimary) {
  const base = { brand_primary: brandPrimary };
  try {
    const out = await llmGenerate({
      task: "sections",
      prompt: SECTIONS_PROMPT(lead, template, sections, base),
    });
    const parsed = safeParseJson(out?.text);
    if (parsed?.sectionsCopy) return parsed;
  } catch (err) {
    if (!(err instanceof LlmQuotaError)) {
      console.log(`   Kit secciones: ${String(err.message).split("\n")[0]}`);
    }
  }
  return null;
}

export function buildBrandKit(lead, evalResult, social = {}) {
  const template = evalResult.template || lead.template || "corporativo";
  const identity = resolveBrandIdentity(lead, template);
  const primary =
    normalizeHex(evalResult.brand_primary) ||
    normalizeHex(identity.brand_primary) ||
    "2563eb";

  const inferred = inferBrandFromName(lead.name, template);
  const secondary = inferred.brandLocked && template === "gimnasios" ? "0f172a" : "ffffff";
  const surface = template === "gimnasios" && primary.startsWith("f97") ? "fff7ed" : "f8fafc";

  const gallery = [];
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
    font: evalResult.font || "inter",
    colors: {
      primary,
      secondary,
      accent: "ffffff",
      surface,
    },
    fonts,
    logo: lead.logo_url || social.avatar_url || null,
    heroImage: uniqueGallery[1] || uniqueGallery[0] || null,
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
    llm: evalResult.llm_meta || null,
    createdAt: new Date().toISOString(),
  };

  return kit;
}

export async function finalizeBrandKit(kit) {
  const llmExtra = await generateSectionsCopy(
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
    if (kit.heroImage && !kit.heroImage.includes("blob.vercel-storage.com")) {
      const [hero] = await rehostGalleryToBlob(kit.slug, [kit.heroImage]);
      if (hero) kit.heroImage = hero;
    }
  }

  saveKitLocal(kit);
  const pub = await publishKit(kit);
  kit.publish = pub;
  return kit;
}
