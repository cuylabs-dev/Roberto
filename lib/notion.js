import { Client } from "@notionhq/client";
import { config } from "./config.js";

// Distritos conocidos en la columna "Distrito" (multi_select).
const DISTRITOS = [
  "Surco", "Ate", "San Isidro", "San Borja", "La Molina", "San Luis", "Miraflores",
];

let _client = null;
function client() {
  if (!_client) _client = new Client({ auth: config.notionToken });
  return _client;
}

// Trae el schema real de la base de datos.
export async function getSchema() {
  const db = await client().databases.retrieve({ database_id: config.notionDatabaseId });
  const props = {};
  for (const [name, def] of Object.entries(db.properties)) {
    props[name] = def.type;
  }
  return props; // { "Nombre del negocio": "title", "WhatsApp": "phone_number", ... }
}

function findByType(schema, type) {
  return Object.keys(schema).find((name) => schema[name] === type) || null;
}
function has(schema, name) {
  return Object.prototype.hasOwnProperty.call(schema, name);
}

function formatValue(type, value) {
  switch (type) {
    case "title":
      return { title: [{ text: { content: String(value).slice(0, 2000) } }] };
    case "rich_text":
      return { rich_text: [{ text: { content: String(value).slice(0, 2000) } }] };
    case "phone_number":
      return { phone_number: String(value) };
    case "url":
      return { url: String(value) };
    case "email":
      return { email: String(value) };
    case "number":
      return { number: Number(value) };
    case "select":
      return { select: { name: String(value) } };
    case "status":
      return { status: { name: String(value) } };
    case "multi_select":
      return {
        multi_select: (Array.isArray(value) ? value : [value]).map((v) => ({ name: String(v) })),
      };
    default:
      return null;
  }
}

// Asigna un valor a una propiedad SOLO si existe en el schema (y segun su tipo real).
function assign(properties, schema, propName, value) {
  if (value === null || value === undefined || value === "") return false;
  if (!has(schema, propName)) return false;
  const formatted = formatValue(schema[propName], value);
  if (formatted) {
    properties[propName] = formatted;
    return true;
  }
  return false;
}

function detectDistrito(address) {
  if (!address) return null;
  const lower = address.toLowerCase();
  return DISTRITOS.find((d) => lower.includes(d.toLowerCase())) || null;
}

// Construye las propiedades de Notion mapeando el Lead canonico al schema real.
export function buildProperties(lead, schema) {
  const properties = {};

  // Titulo: la propiedad de tipo title, sea cual sea su nombre.
  const titleProp = findByType(schema, "title");
  if (titleProp) assign(properties, schema, titleProp, lead.name);

  // Telefono -> "WhatsApp" (o cualquier phone_number / la columna "Telefono").
  const phoneProp = has(schema, "WhatsApp")
    ? "WhatsApp"
    : has(schema, "Telefono")
      ? "Telefono"
      : findByType(schema, "phone_number");
  if (phoneProp && lead.phone_e164) assign(properties, schema, phoneProp, lead.phone_e164);

  // Maqueta URL -> "Maqueta URL" si existe, si no "Diseño".
  const maquetaProp = has(schema, "Maqueta URL") ? "Maqueta URL" : "Diseño";
  assign(properties, schema, maquetaProp, lead.maqueta_url);

  // Redes sociales -> "Redes".
  assign(properties, schema, "Redes", lead.redes);

  // Correo -> "Correo".
  assign(properties, schema, "Correo", lead.email);

  // WhatsApp Link (si el usuario crea esa columna url).
  assign(properties, schema, "WhatsApp Link", lead.wa_link);

  // Score (si existe la columna number).
  assign(properties, schema, "Score", lead.score);

  // Template asignado (si existe).
  assign(properties, schema, "Template Asignado", lead.template);

  // Nicho.
  if (config.nichoNotion) assign(properties, schema, "Nicho", config.nichoNotion);

  // Distrito (derivado de la direccion).
  const distrito = detectDistrito(lead.address);
  if (distrito) assign(properties, schema, "Distrito", distrito);

  // Estado por defecto: "Prospecto".
  assign(properties, schema, "Estado", "Prospecto");

  // Fuente de contacto (si existe).
  if (lead.source) assign(properties, schema, "Fuente Contacto", lead.source);

  return properties;
}

// Deduplica por telefono o por nombre antes de insertar.
export async function isDuplicate(lead, schema) {
  const filters = [];
  const titleProp = findByType(schema, "title");
  const phoneProp = has(schema, "WhatsApp") ? "WhatsApp" : findByType(schema, "phone_number");

  if (phoneProp && lead.phone_e164) {
    filters.push({ property: phoneProp, phone_number: { equals: lead.phone_e164 } });
  }
  if (titleProp && lead.name) {
    filters.push({ property: titleProp, title: { equals: lead.name } });
  }
  if (filters.length === 0) return false;

  try {
    const res = await client().databases.query({
      database_id: config.notionDatabaseId,
      filter: filters.length === 1 ? filters[0] : { or: filters },
      page_size: 1,
    });
    return res.results.length > 0;
  } catch {
    return false; // Ante duda, no bloquea la insercion.
  }
}

export async function createLead(lead, schema) {
  const properties = buildProperties(lead, schema);
  return client().pages.create({
    parent: { database_id: config.notionDatabaseId },
    properties,
  });
}

// Reporta que columnas recomendadas faltan, para pedirlas "suavemente".
export function missingRecommended(schema) {
  const recommended = {
    Score: "number",
    "WhatsApp Link": "url",
  };
  const missing = [];
  for (const [name] of Object.entries(recommended)) {
    if (!has(schema, name)) missing.push(name);
  }
  return missing;
}
