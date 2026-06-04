# Roberto — Investigador de Prospectos (Bucle Outbound B2B)

> Motor local de prospección (Maps → kit Blob → Notion). Repo backup: [github.com/cuylabs-dev/Roberto](https://github.com/cuylabs-dev/Roberto)

Scrapea Maps (**10 leads/día** máximo, **10 nichos** en rotación), genera **brand kits** (`?kit=slug` + `pri`/`sec`), sube imágenes y copy a **Vercel Blob**, y deja prospectos en **Notion** (incl. correo si se encuentra).

**6 plantillas factoría:** `clinicas`, `corporativo`, `gimnasios`, `colegios`, `tiendas`, **`hoteles`**.

**Producción:** Kits/maquetas en Blob tienen **TTL de 10 días**. Si Maps no muestra web, **Google verifica** (Playwright): si hay web propia del negocio → descarta; si no → candidato.

## Documentación

1. **[docs/HANDOFF_COLABORADOR.md](docs/HANDOFF_COLABORADOR.md)** — guía completa + Guantelete APIs
2. **[docs/LOGICA_PASOS.md](docs/LOGICA_PASOS.md)** — lógica FASE 1 → 4
3. **[docs/COMANDOS_PUSH.md](docs/COMANDOS_PUSH.md)** — `git push` (no deploy manual Vercel)
4. [docs/Flujo_Trabajo.md](docs/Flujo_Trabajo.md) · [docs/Requisitos.md](docs/Requisitos.md)

## Uso

```bash
npm install
npx playwright install chromium
# .env desde .env.example

# Escritorio: Roberto.bat (lanzador) → corre este repo
.\Roberto.bat
# o alias legacy: .\Investigador.bat

node preparador.js --dry-run
node scripts/audit-chains.js
node scripts/pilot-brand-kit.js
npm run limpiar-blob      # TTL 10d en Vercel Blob
npm run purgar-data       # vacía data/ (solo pruebas)
```

## APIs mínimas (`.env`)

| Variable | Para qué |
|----------|----------|
| `GEMINI_API_KEY` | Visión + copy |
| `BLOB_READ_WRITE_TOKEN` | Kits en CDN |
| `COHERE_API_KEY` + `CEREBRAS_API_KEY` + Cloudflare | Audit sin caer a local |
| `GITHUB_TOKEN` | Copy/secciones respaldo |

Ver tabla completa en HANDOFF. **No** Together AI.

## Deploy factoría

Solo en **Plantillas-Web-Maestra**: `git push origin main` → Vercel actualiza desde GitHub (incl. plantilla `hoteles`).

## Repo hermano

`git@github.com:cuylabs-dev/Plantillas-Web-Maestra.git`
