# Flujo de Trabajo Diario — Investigador de Prospectos

> Cada fase es **resiliente**: si una falla, registra el error, marca el lead como `Revisar` y continúa. Nunca aborta toda la corrida por un lead malo.

---

## ⏰ 05:00 AM — Disparo automático (Task Scheduler) o manual (.bat)
*   Windows Task Scheduler lanza `node preparador.js`.
*   Si la laptop estaba apagada/dormida → no corre → lo arrancas a mano con `Investigador_Prospectos.bat`.

---

## FASE 1 — Scraper Principal (Google Maps / Playwright)
*   Abre Chromium con `playwright-extra` + `stealth`.
*   Busca el nicho del día (`SEARCH_QUERY`).
*   Extrae por negocio: **Nombre, Dirección, Teléfono, Web (sí/no)**.
*   **Resiliencia:**
    *   Delays aleatorios entre acciones (humano-like).
    *   Si aparece **captcha** → NO lo ignora: detecta, hace screenshot a `data/captcha_*.png`, pausa esa corrida y avisa en el log (`Estado=Revisar`). No finge que pasó.
    *   Si no hay teléfono → pasa al fallback (Fase 2).

## FASE 2 — Scraper "Ninja" de Respaldo (FB / IG)
*   Solo se activa para negocios **sin teléfono** en Maps.
*   Usa el **perfil de Chrome persistente** (cuentas burner ya logueadas).
*   Busca en Google el Facebook/Instagram del local → abre la bio/about → corre **Regex de contacto** para hallar WhatsApp/teléfono oculto.
*   **Resiliencia:**
    *   Si FB/IG pide login extra o bloquea → registra `Fuente Contacto = Ninguno`, `Estado = Revisar` y sigue.
    *   Nunca reintenta más de 1 vez por lead (evita bloqueos en cascada).

## FASE 3 — Cerebro Analítico + Personalizador (Gemini Flash)
*   **Análisis de falencias:** evalúa qué le falta al negocio.
*   **Decisión de plantilla:** elige 1 de las 5 plantillas (enum cerrado, ver Implementation Plan).
*   **Personalización visual:** elige `color` y `font` (enums cerrados).
*   **Construcción de URL:** arma la Maqueta URL con todos los parámetros.
*   **Copywriting WA:** mensaje CORTO y preciso (máx 3 líneas).
*   **Score:** asigna 1–10.
*   **Resiliencia:** si Gemini devuelve un valor fuera del enum → se castea al default y se marca `Estado = Revisar`.

## FASE 4 — Inyección en Notion (append)
*   Hace un `pages.create` por lead apuntando a `NOTION_DATABASE_ID`.
*   **Deduplicación:** antes de insertar, consulta la DB por `Teléfono` o `Name`. Si ya existe → omite (no duplica).
*   Escribe TODAS las propiedades del contrato (ver Requisitos §3).
*   Respaldo local: vuelca también todo a `data/leads_del_dia.json`.
*   **Resiliencia:** error 4xx de Notion en un lead → log + continúa con el siguiente.

---

## 🌅 09:00 AM — Cierre Humano (Tú)
*   Abres Notion, filtras `Estado = Nuevo`.
*   Clic en **WhatsApp Link**, envías el mensaje a mano, marcas `Estado = Enviado`.
*   Revisas los `Estado = Revisar` (captchas, sin contacto, valores raros).

---

## 🔧 Mantenimiento (Auditoría de Salud)
**Disparador:** cada **2 semanas** O al acumular **150 negocios scrapeados** (lo que ocurra primero).
*   Correr `node preparador.js --dry-run` y verificar que Maps aún devuelve datos.
*   Si los selectores del DOM cambiaron (0 leads o campos vacíos), actualizar selectores en el scraper.
*   Revisar tasa de captchas y salud de las cuentas burner FB/IG.
*   Registrar el resultado en el `Historial de Auditorías` del Implementation Plan.

## 🔗 Conexiones
[[Requisitos]] | [[Implementation_Plan]]
