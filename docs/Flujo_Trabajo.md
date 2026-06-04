# Flujo de Trabajo — Bucle Outbound B2B

## Resumen diario

1. Revisar `.env` (Guantelete + Blob + Notion). Blob: TTL **10 días** (`BLOB_TTL_DAYS`); purga con `npm run limpiar-blob` o al arrancar **`Roberto.bat`** (alias `Investigador.bat`).
2. Cerrar Chrome si usarás FASE 2 (perfil cuy) — **sin cambios** en scraper IG.
3. Ejecutar `Roberto.bat` o `node preparador.js` (máx. **10** leads calificados por corrida).
4. Revisar Notion CRM y abrir maquetas `?kit=`.
5. WhatsApp manual desde Notion.

## Fases (detalle en LOGICA_PASOS.md)

| Fase | Qué hace |
|------|----------|
| 1 | Maps + anti-cadenas |
| 1.5 | Audit HTTP + LLM (Cerebras/Cohere/Cloudflare…) |
| 2 | IG/FB + galería |
| 2b | Logo + color |
| 3 | Brand kit → Blob → URL maqueta |
| 4 | Notion |

## Publicar cambios en plantillas

**Solo** `git push origin main` en Plantillas-Web-Maestra.  
Comandos: [COMANDOS_PUSH.md](COMANDOS_PUSH.md)

## Factoría

`FACTORIA_BASE_URL` = URL producción (Vercel tras push GitHub).  
Preview local: `npm run dev` en Plantillas → `http://127.0.0.1:5173/?kit=slug`

## Pruebas sin corrida completa

```bash
node scripts/audit-chains.js
node scripts/pilot-brand-kit.js
node preparador.js --dry-run
```

## Memoria

`node preparador.js --reset-memoria` tras vaciar Notion para re-scrapear.
