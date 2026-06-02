# Investigador de Prospectos (Bucle Outbound B2B)

Sistema de prospección B2B automatizado. Cada madrugada scrapea un nicho, lo analiza con
Gemini Flash, genera una **Maqueta URL** personalizada (apuntando a la factoría de landings en `cuylabs`)
y deja cada lead listo en **Notion** para que tú envíes el WhatsApp a mano.

> **Costo operativo: $0/mes.** Gemini Flash gratis + Vercel Hobby + personalización por URL.

## Estructura
```
Investigador_Prospectos/
├── skills/      # Skills del ecosistema (CEO Sponsor, Orquestador, Scraper, Preparador)
├── docs/        # Requisitos, Flujo de Trabajo, Implementation Plan
├── data/        # (se crea al correr) leads_del_dia.json, run.log, capturas de captcha
├── .env.example # Plantilla de configuracion
└── README.md
```

## Documentos clave
- `docs/Requisitos.md` — credenciales, Notion, energia, perfil Chrome.
- `docs/Flujo_Trabajo.md` — las 4 fases diarias + auditoria de salud.
- `docs/Implementation_Plan.md` — contrato de datos, enums, contrato de URL, Task Scheduler.

## Setup rapido
1. `npm install playwright-extra puppeteer-extra-plugin-stealth @google/generative-ai @notionhq/client dotenv p-limit`
2. `npx playwright install chromium`
3. Copia `.env.example` → `.env` y rellena.
4. Crea las propiedades de Notion (ver Requisitos §3).
5. (Pendiente) construir `preparador.js` — siguiente fase.

## Uso diario
- Automatico: Task Scheduler a las 05:00 AM (ver Implementation Plan §4).
- Manual: doble clic en `Investigador_Prospectos.bat` (Escritorio).

## Estado actual
- [x] Proyecto, skills y documentacion robusta.
- [ ] `preparador.js` (codigo del pipeline) — proxima fase.
- [ ] Reconciliar lector de parametros de URL en la factoria `cuylabs`.
