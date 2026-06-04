# Investigador de Prospectos (Bucle Outbound B2B)

Scrapea Maps (20 leads/día, 5 nichos), genera **brand kits** (`?kit=slug`), sube a **Vercel Blob**, y deja prospectos en **Notion**.

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

Investigador.bat
node preparador.js --dry-run
node scripts/audit-chains.js
node scripts/pilot-brand-kit.js
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

Solo en **Plantillas-Web-Maestra**: `git push origin main` → Vercel actualiza desde GitHub.

## Repo hermano

`git@github.com:cuylabs-dev/Plantillas-Web-Maestra.git`
