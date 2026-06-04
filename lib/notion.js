import { Client } from "@notionhq/client";
import { config } from "./config.js";

const DISTRITOS = [
  "Surco", "Ate", "San Isidro", "San Borja", "La Molina", "San Luis", "Miraflores",
];

let _client = null;
function client() {
  if (!_client) _client = new Client({ auth: config.notionToken });
  return _client;
}

export async function getSchema() {
  const db = await client().databases.retrieve({ database_id: config.notionDatabaseId });
  const props = {};
  for (const [name, def] of Object.entries(db.properties)) {
    props[name] = def.type;
  }
  return props;
}

export async function getDatabaseTitle() {
  const db = await client().databases.retrieve({ database_id: config.notionDatabaseId });
  return db.title?.[0]?.plain_text || "CRM Prospeccion";
}

function findByType(schema, type) {
  return Object.keys(schema).find((name) => schema[name] === type) || null;
}
function has(schema, name) {
  return Object.prototype.hasOwnProperty.call(schema, name);
}

/** Busca columna URL de maqueta (nombres distintos en cada CRM). */
export function findMaquetaProp(schema) {
  const exact = [
    "Maqueta URL",
    "Maqueta url",
    "Diseño",
    "Diseno",
    "Landing",
    "URL Maqueta",
    "Web propuesta",
    "Propuesta web",
    "Link maqueta",
  ];
  for (const n of exact) {
    if (has(schema, n) && schema[n] === "url") return n;
  }
  for (const [name, type] of Object.entries(schema)) {
    if (type !== "url") continue;
    if (/maqueta|diseño|diseno|landing|propuesta|mockup/i.test(name)) return name;
  }
  return findByType(schema, "url");
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

export function buildProperties(lead, schema) {
  const properties = {};
  const titleProp = findByType(schema, "title");
  if (titleProp) assign(properties, schema, titleProp, lead.name);

  const phoneProp = has(schema, "WhatsApp")
    ? "WhatsApp"
    : has(schema, "Telefono")
      ? "Telefono"
      : findByType(schema, "phone_number");
  if (phoneProp && lead.phone_e164) assign(properties, schema, phoneProp, lead.phone_e164);

  const maquetaProp = findMaquetaProp(schema);
  const maquetaWritten = maquetaProp
    ? assign(properties, schema, maquetaProp, lead.maqueta_url)
    : false;

  assign(properties, schema, "Redes", lead.redes);
  assign(properties, schema, "Correo", lead.email);
  assign(properties, schema, "WhatsApp Link", lead.wa_link);
  assign(properties, schema, "Score", lead.score);
  assign(properties, schema, "Template Asignado", lead.template);
  const nicho = lead.nicho || config.nichoNotion;
  if (nicho) assign(properties, schema, "Nicho", nicho);

  const distrito = detectDistrito(lead.address);
  if (distrito) assign(properties, schema, "Distrito", distrito);

  assign(properties, schema, "Estado", lead.estado || "Prospecto");
  if (lead.source) assign(properties, schema, "Fuente Contacto", lead.source);
  assign(properties, schema, "Diagnostico", lead.diagnostico);
  assign(properties, schema, "Diagnóstico", lead.diagnostico);
  if (lead.kit_slug) {
    const diag = [lead.diagnostico, `Kit: ${lead.kit_slug}`].filter(Boolean).join(" | ");
    assign(properties, schema, "Diagnostico", diag);
    assign(properties, schema, "Diagnóstico", diag);
  }

  return { properties, maquetaWritten, maquetaProp };
}

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
    return false;
  }
}

export async function createLead(lead, schema) {
  const { properties, maquetaWritten } = buildProperties(lead, schema);
  const children = [];

  if (lead.diagnostico) {
    children.push({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [{ type: "text", text: { content: String(lead.diagnostico).slice(0, 2000) } }],
      },
    });
  }

  if (lead.maqueta_url && !maquetaWritten) {
    children.push({
      object: "block",
      type: "heading_2",
      heading_2: { rich_text: [{ type: "text", text: { content: "Maqueta web" } }] },
    });
    children.push({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [
          {
            type: "text",
            text: { content: lead.maqueta_url, link: { url: lead.maqueta_url } },
          },
        ],
      },
    });
  }

  return client().pages.create({
    parent: { database_id: config.notionDatabaseId },
    properties,
    ...(children.length ? { children } : {}),
  });
}

export function missingRecommended(schema) {
  const missing = [];
  if (!findMaquetaProp(schema)) {
    missing.push('Columna URL "Maqueta URL" o "Diseño"');
  }
  if (!has(schema, "Score")) missing.push("Score");
  if (!has(schema, "WhatsApp Link")) missing.push("WhatsApp Link");
  return missing;
}
