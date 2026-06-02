# Requisitos Técnicos — Investigador de Prospectos (Bucle Outbound B2B)

> Versión robusta. Reconciliada con el Implementation Plan v5 y las decisiones operativas del 02-jun-2026.
> Salida oficial = **Notion**. Envío de WhatsApp = **manual** (tú, 10/día).

---

## 0. Resumen de decisiones operativas
| Tema | Decisión |
|------|----------|
| Envío de WhatsApp | **Manual**, 10/día desde tu número. Sin riesgo de baneo (no es envío masivo automatizado). |
| Horario de ejecución | **05:00 AM** vía Windows Task Scheduler. |
| Si la laptop estaba apagada/dormida | El script no corre; lo lanzas a mano con `Investigador_Prospectos.bat` (Escritorio). |
| Legal / consentimiento | Fuera de alcance en esta etapa. |
| Facebook / Instagram | Scraper usa un **perfil de Chrome persistente** con 2 cuentas burner ya logueadas (FB + IG). |
| Mantenimiento del DOM de Google Maps | Lo mantienes tú. **Auditoría cada 2 semanas O cada 150 negocios scrapeados** (lo que ocurra primero). |
| Normalización de teléfono | Sí, a formato `+51`. Nice-to-have (el envío es manual). |
| Entregable final | Info + Maqueta URL + Contacto, listos en bandeja en Notion. |
| Gemini Pro / Antigravity Pro ($20) | Disponible como "trabajador" para tareas pesadas; **no se implementa salvo que sea necesario**. Gemini Flash gratis cubre el día a día. |

---

## 1. Estado de la Máquina (Ejecución Diaria)
*   La laptop debe estar **ENCENDIDA** (procesador activo, no en suspensión/sleep) a las 05:00 AM.
*   La tapa puede estar cerrada → en Windows: *Configuración de energía → "Al cerrar la tapa: No hacer nada"*.
*   Si a las 05:00 la laptop estaba apagada o dormida, la tarea simplemente **no corre** (no hay "catch-up" automático). Al despertar, doble clic en `Investigador_Prospectos.bat`.

## 2. Cuenta y Estructura de Vercel (La Factoría de Landings)
*   La factoría de plantillas **ya vive en el repo `cuylabs`** (React + Vite + Tailwind). Este proyecto (Investigador) **no** la reprograma; solo **genera URLs** que la apuntan.
*   Cuenta gratuita (Hobby) en Vercel para hospedar la factoría.
*   **Personalización por URL (costo $0):** el navegador del prospecto lee los parámetros y pinta la página. No se programa una web por cliente.

## 3. Credenciales y Estructura de Notion (sistema de registro oficial)
Tu base de datos de Notion debe tener **exactamente** estas propiedades:

| Propiedad | Tipo | Notas |
|-----------|------|-------|
| **Name** | `Title` | Nombre del negocio. |
| **Teléfono** | `Phone` | Normalizado a `+51XXXXXXXXX`. Vacío si no se halló. |
| **Template Asignado** | `Select` | Debe coincidir EXACTO con el enum (ver Implementation Plan §Enums). |
| **Maqueta URL** | `URL` | URL final a la factoría con parámetros inyectados. |
| **WhatsApp Link** | `URL` | `https://wa.me/51XXXXXXXXX?text=<urlencoded>`. |
| **Score** | `Number` | Lead Score 1–10 que asigna Gemini. |
| **Estado** | `Select` | (NUEVO) Valores: `Nuevo`, `Revisar`, `Enviado`. Default `Nuevo`. |
| **Fuente Contacto** | `Select` | (NUEVO) `Maps`, `Facebook`, `Instagram`, `Ninguno`. Para auditar el fallback. |

> ⚠️ **Regla de oro:** si Gemini devuelve un `Template Asignado` que **no** existe como opción `Select`, la API de Notion falla (400). El código debe restringir a Gemini al enum cerrado y, si aun así no coincide, escribir `Estado = Revisar` en lugar de romper.

**Credenciales requeridas:**
*   `NOTION_TOKEN` → el *Internal Integration Secret* de Notion.
*   `NOTION_DATABASE_ID` → ID de la tabla donde inyectamos filas.
*   La integración debe estar **compartida** con la base de datos (Notion → ... → Connections).

## 4. API Key de Gemini
*   `GEMINI_API_KEY` desde https://aistudio.google.com/app/apikey (free tier: ~1,500 req/día → de sobra para 10 leads/día).
*   Modelo por defecto: **Gemini Flash** (gratis). `GEMINI_PRO` opcional para análisis profundos puntuales.

## 5. Perfil de Chrome para Facebook / Instagram
*   Crear 2 cuentas burner (sugerencia de nombre en el Implementation Plan §FB/IG).
*   Loguearlas **una vez** en un perfil de Chrome dedicado.
*   `CHROME_PROFILE_PATH` en `.env` apunta a ese `user-data-dir`. Playwright lo reutiliza (sesión persistente) para que el scraper entre ya autenticado.

## 6. Dependencias (Node.js)
```bash
npm install playwright-extra puppeteer-extra-plugin-stealth @google/generative-ai @notionhq/client dotenv p-limit
npx playwright install chromium
```

## 🔗 Conexiones
[[Flujo_Trabajo]] | [[Implementation_Plan]] | skills/Skill_Preparador_Outbound.md
