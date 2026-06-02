# Implementation Plan — Investigador de Prospectos (v6, robusto)

> Evolución del plan v5. Cierra las 3 brechas críticas que detectó la auditoría de arquitectura:
> **(1) Contrato de Datos único · (2) Enums cerrados · (3) Contrato de URL.**
> Costo operativo objetivo: **$0/mes**. Capacidad: ~10 leads/día.

---

## 0. Cómo es posible $0 y 0 tokens de Cursor al mes
1. **Gemini Flash (gratis):** lee el negocio, elige paleta/fuente/plantilla y redacta el WhatsApp. API gratuita de Google (~1,500 req/día).
2. **Factoría Vercel (gratis):** la web React (repo `cuylabs`) es **dinámica**. Lee los parámetros de la URL y se pinta sola en el navegador del prospecto.
3. **Conclusión:** nadie programa una web por cliente. Solo generamos **URLs inteligentes**.

---

## 1. CONTRATO DE DATOS ÚNICO (fuente de verdad)
Mismos nombres y tipos en todo el pipeline: **Scraper → Gemini → Notion**.

```jsonc
// Objeto "Lead" canónico que viaja por las 4 fases
{
  "name":        "string",          // requerido
  "phone_raw":   "string | null",   // tal como se extrajo
  "phone_e164":  "string | null",   // normalizado +51XXXXXXXXX
  "address":     "string | null",
  "has_website": true,              // boolean
  "source":      "Maps | Facebook | Instagram | Ninguno",
  "template":    "clinicas | corporativo | gimnasios | colegios | tiendas",
  "color":       "blue | green | red | violet | orange | slate",
  "font":        "inter | roboto | poppins | montserrat",
  "blocks":      ["login","reservas","ecommerce","galeria"], // 0+ módulos
  "maqueta_url": "string (URL)",    // construida en Fase 3
  "wa_text":     "string",          // copy de WhatsApp (máx 3 líneas)
  "wa_link":     "string (URL)",    // wa.me/51...?text=...
  "score":       7,                 // 1-10
  "estado":      "Nuevo | Revisar | Enviado"
}
```

### Mapeo Lead → Propiedades de Notion
| Campo Lead | Propiedad Notion | Tipo |
|------------|------------------|------|
| `name` | Name | Title |
| `phone_e164` | Teléfono | Phone |
| `template` | Template Asignado | Select |
| `maqueta_url` | Maqueta URL | URL |
| `wa_link` | WhatsApp Link | URL |
| `score` | Score | Number |
| `estado` | Estado | Select |
| `source` | Fuente Contacto | Select |

---

## 2. ENUMS CERRADOS (para que Gemini no rompa Notion)
Gemini **debe** elegir solo de estas listas. El código valida y, si algo no encaja, castea a default + `estado=Revisar`.

*   **template:** `clinicas` · `corporativo` · `gimnasios` · `colegios` · `tiendas`
*   **color:** `blue` · `green` · `red` · `violet` · `orange` · `slate`
*   **font:** `inter` · `roboto` · `poppins` · `montserrat`
*   **blocks:** `login` · `reservas` · `ecommerce` · `galeria`

> Estos valores DEBEN existir como opciones en el `Select` "Template Asignado" de Notion (solo el template). Color/font/blocks viajan en la URL, no en Notion.

---

## 3. CONTRATO DE URL (Gemini construye ⇄ React lee)
Nombres de parámetros **idénticos** en el generador y en la factoría React. Si uno cambia, ambos cambian.

```
https://<tu-factoria>.vercel.app/?cliente=<URLencoded>&template=<template>&color=<color>&font=<font>&blocks=<csv>
```
Ejemplo:
```
https://factoria.vercel.app/?cliente=Dental%20San%20Jose&template=clinicas&color=blue&font=inter&blocks=login,reservas
```
> ✅ **Pendiente de reconciliar en el repo `cuylabs`:** confirmar que el motor de la factoría lee EXACTAMENTE `cliente`, `template`, `color`, `font`, `blocks`. (El plan v5 ya mencionaba color/font; el flujo original no — aquí queda unificado.)

### WhatsApp Link
```
https://wa.me/51XXXXXXXXX?text=<encodeURIComponent(wa_text)>
```
Normalización de teléfono: quitar espacios/guiones/paréntesis, anteponer `51` si falta, validar 9 dígitos.

---

## FASE 0 — La Factoría Modular (ya existe en `cuylabs`)
*   5 plantillas base: Clínicas, Corporativo, Gimnasios, Colegios, Tiendas.
*   Módulos dinámicos: Login, Reservas, E-commerce, Galería.
*   Motor que lee parámetros de URL e inyecta textos / cambia colores Tailwind / tipografías.
*   **Acción:** verificar/ajustar el lector de parámetros para que cumpla el Contrato de URL (§3).

## FASE 1 — Preparación del Entorno
1. `npm install playwright-extra puppeteer-extra-plugin-stealth @google/generative-ai @notionhq/client dotenv p-limit`
2. `npx playwright install chromium`
3. Crear `.env` a partir de `.env.example` (Gemini, Notion, perfil Chrome, nicho).
4. Crear la propiedad `Estado` y `Fuente Contacto` (Select) en la DB de Notion, y las opciones de `Template Asignado`.

## FASE 2 — Scraper Resiliente
1. Busca en Google Maps con stealth + delays aleatorios.
2. Fallback FB/IG con perfil persistente (cuentas burner) si falta teléfono.
3. Detecta captchas (screenshot + `Revisar`), nunca los "ignora a ciegas".
4. Ignora negocios sin ningún dato de contacto (los marca `Revisar`).

## FASE 3 — Cerebro Analítico y Personalizador (Gemini)
1. Analiza falencias del negocio.
2. Asigna `template` (enum).
3. Asigna `color` + `font` (enums) y `blocks`.
4. Redacta `wa_text` (máx 3 líneas).
5. Construye `maqueta_url` y `wa_link` según los contratos.
6. Asigna `score` 1–10.

## FASE 4 — Inyección en Notion
1. Deduplica por `phone_e164` / `name` antes de insertar.
2. `pages.create` con TODAS las propiedades del contrato.
3. Respaldo local en `data/leads_del_dia.json`.
4. Errores por lead no abortan la corrida.

---

## 4. Programación a las 05:00 AM (Windows Task Scheduler)
Ejecutar **una vez** en PowerShell (como admin), tras construir `preparador.js`:
```powershell
schtasks /Create /SC DAILY /ST 05:00 /TN "InvestigadorProspectos" ^
  /TR "cmd /c cd /d C:\Users\gabit\Documents\Git\CuyLabs\Investigador_Prospectos && node preparador.js >> data\run.log 2>&1"
```
*   No hay catch-up: si no corrió, usar el `.bat` del Escritorio.
*   Energía: tapa cerrada = "No hacer nada"; laptop encendida.

## 5. Cuentas burner FB / IG
*   Sugerencia de identidad neutra y creíble: **`Sofia Prospect`** (correo tipo `sofia.prospect.lima@gmail.com`).
*   Crear FB e IG con esa identidad, loguear una vez en el perfil de Chrome dedicado, apuntar `CHROME_PROFILE_PATH` ahí.
*   Mantenerlas "tibias": iniciar sesión cada cierto tiempo para que no se marquen como inactivas.

## 6. Gemini Pro / Antigravity Pro ($20) como "trabajador"
*   Disponible para tareas pesadas puntuales (análisis profundo, generación de copys en lote).
*   **No se cablea por defecto:** el día a día corre con Gemini Flash gratis. Se invoca solo si una tarea lo justifica.

---

## 7. Historial de Auditorías de Salud
> Registrar cada 2 semanas o cada 150 negocios.

| Fecha | Negocios acumulados | Maps OK | Captcha % | FB/IG OK | Acción tomada |
|-------|---------------------|---------|-----------|----------|---------------|
| (pendiente) | | | | | |

## 8. Riesgos vivos (vigilar)
*   🟠 Fragilidad de selectores Google Maps → auditoría periódica.
*   🟠 FB/IG sigue siendo el vector más frágil → fallback "best effort", no crítico.
*   🟢 Baneo WhatsApp → **mitigado** (envío manual 10/día).
*   🟢 Costo → **$0** (Flash gratis + Vercel Hobby + URLs dinámicas).

## 🔗 Conexiones
[[Requisitos]] | [[Flujo_Trabajo]] | skills/Skill_Orquestador_Leads.md | skills/Skill_Agente_Scraper.md
