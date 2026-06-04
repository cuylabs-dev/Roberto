/**
 * 12 rubros locales → plantilla factoría + infraestructura web objetivo (para copy/bloques).
 */
export const RUBROS_LOCALES = [
  {
    id: "clinica_dental",
    query: "clinica dental barrio Lima",
    nicho: "Clínica dental",
    template: "clinicas",
    webPlatform: "Portal de pacientes",
    critical: "Agenda de citas en tiempo real, login paciente, recetas y resultados",
    blocks: ["reservas", "login"],
    kw: ["dental", "odonto", "clinica", "medico", "consultorio"],
  },
  {
    id: "gimnasio_yoga",
    query: "gimnasio yoga pilates Lima",
    nicho: "Gym / Yoga",
    template: "gimnasios",
    webPlatform: "Plataforma de membresías",
    critical: "Pagos recurrentes, login socios, reserva de clases",
    blocks: ["reservas", "login"],
    kw: ["gimnasio", "gym", "yoga", "pilates", "crossfit", "fitness"],
  },
  {
    id: "ferreteria",
    query: "ferreteria materiales construccion Lima",
    nicho: "Ferretería",
    template: "tiendas",
    webPlatform: "E-commerce B2B/B2C + cotizador",
    critical: "Catalogo categorizado, cotizacion por volumen, carrito, WhatsApp tecnico",
    blocks: ["ecommerce"],
    kw: ["ferreteria", "materiales", "construccion", "maestro de obra"],
  },
  {
    id: "boutique",
    query: "boutique ropa independiente Lima",
    nicho: "Boutique",
    template: "tiendas",
    webPlatform: "E-commerce moda",
    critical: "Carrito, pasarela, guia de tallas, login seguimiento de pedido",
    blocks: ["ecommerce", "login"],
    kw: ["boutique", "ropa", "moda", "tienda"],
  },
  {
    id: "autopartes",
    query: "autopartes repuestos vehiculos Lima",
    nicho: "Autopartes",
    template: "tiendas",
    webPlatform: "E-commerce buscador avanzado",
    critical: "Busqueda por marca modelo año, stock, compra online",
    blocks: ["ecommerce"],
    kw: ["autopartes", "repuestos", "llantas", "taller"],
  },
  {
    id: "colegio",
    query: "colegio academia Lima",
    nicho: "Colegio",
    template: "colegios",
    webPlatform: "Portal educativo / intranet",
    critical: "Admisiones, login padres y alumnos, notas y pensiones",
    blocks: ["login", "reservas"],
    kw: ["colegio", "escuela", "academia", "instituto", "kinder"],
  },
  {
    id: "legal_contable",
    query: "estudio abogados contadores Lima",
    nicho: "Legal / Contable",
    template: "corporativo",
    webPlatform: "Portal de clientes",
    critical: "Agenda consultorias, login documentos confidenciales",
    blocks: ["login", "reservas"],
    kw: ["abogado", "contador", "estudio juridico", "asesoria legal"],
  },
  {
    id: "restaurante",
    query: "restaurante cafeteria especialidad Lima",
    nicho: "Restaurante",
    template: "tiendas",
    webPlatform: "Web transaccional / reservas",
    critical: "Menu digital, pedidos delivery/pickup, reserva de mesas",
    blocks: ["reservas", "ecommerce"],
    kw: ["restaurante", "cafeteria", "cafe", "comida", "delivery"],
  },
  {
    id: "hotel",
    query: "hotel hostal boutique Lima",
    nicho: "Hotel",
    template: "tiendas",
    webPlatform: "Motor de reservas directo",
    critical: "Disponibilidad tiempo real, selector habitaciones, pago adelantos",
    blocks: ["reservas", "login"],
    kw: ["hotel", "hostal", "hospedaje", "alojamiento"],
  },
  {
    id: "belleza",
    query: "salon belleza spa barberia Lima",
    nicho: "Belleza",
    template: "clinicas",
    webPlatform: "Catalogo servicios + reservas",
    critical: "Galeria trabajos, elegir profesional, bloquear hora con pago reserva",
    blocks: ["reservas", "galeria"],
    kw: ["salon", "belleza", "spa", "barber", "peluqueria", "estetica"],
  },
  {
    id: "taller",
    query: "taller mecanico autos Lima",
    nicho: "Taller",
    template: "corporativo",
    webPlatform: "Servicios + tracking reparacion",
    critical: "Presupuestos online, estado reparacion por placa, fotos avance",
    blocks: ["reservas"],
    kw: ["taller", "mecanico", "automotriz", "lubricentro"],
  },
  {
    id: "inmobiliaria",
    query: "inmobiliaria bienes raices Lima",
    nicho: "Inmobiliaria",
    template: "corporativo",
    webPlatform: "Directorio propiedades",
    critical: "Filtros precio m2 ubicacion, CRM por agente, formularios contacto",
    blocks: ["login"],
    kw: ["inmobiliaria", "bienes raices", "propiedades", "alquiler"],
  },
];

export function rubroForPlanEntry(planEntry) {
  return (
    RUBROS_LOCALES.find((r) => r.query === planEntry.query) ||
    RUBROS_LOCALES.find((r) => r.nicho === planEntry.nicho) ||
    null
  );
}

export function inferRubroSpec(lead) {
  const hay = `${lead.maps_category || ""} ${lead.nicho || ""} ${lead.search_query || ""} ${lead.name || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  for (const r of RUBROS_LOCALES) {
    if (r.kw.some((k) => hay.includes(k))) return r;
  }
  return RUBROS_LOCALES.find((r) => r.template === (lead.template_hint || lead.template)) || RUBROS_LOCALES[0];
}

export function rubroPromptBlock(lead) {
  const r = inferRubroSpec(lead);
  return [
    `Rubro objetivo: ${r.nicho}`,
    `Plataforma web ideal: ${r.webPlatform}`,
    `Funcion critica: ${r.critical}`,
    `Bloques factoria sugeridos: ${r.blocks.join(", ")}`,
  ].join("\n");
}
