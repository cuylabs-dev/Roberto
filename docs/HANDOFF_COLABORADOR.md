# Guía de entrega — Bucle Outbound B2B



Documento para quien refine **plantillas** o mantenga el **Investigador** (Node). Léelo completo antes de tocar código.



---



## 1. Qué es el sistema (30 segundos)



| Repo | Qué hace | Cómo se publica |

|------|----------|-----------------|

| **Roberto** (`Investigador_Prospectos/`) | Scrape Maps, brand kit, maquetas, Notion | Local (`Roberto.bat`) · backup [cuylabs-dev/Roberto](https://github.com/cuylabs-dev/Roberto) |

| **Plantillas-Web-Maestra** | 7 landings React (`?kit=` o URL legacy) | **`git push origin main`** → GitHub → Vercel auto |



**No hay deploy manual en Vercel.** No uses el botón Deploy del dashboard. Solo push a GitHub.



El outbound arma un **link**; el prospecto abre la maqueta personalizada.



**Lógica por fase:** [LOGICA_PASOS.md](LOGICA_PASOS.md)  

**Comandos git:** [COMANDOS_PUSH.md](COMANDOS_PUSH.md)



---



## 2. Flujo diario (Investigador)



```

Roberto.bat

    → FASE 1   Maps + filtro cadenas

    → FASE 1.5 Auditoría web (HTTP + LLM Guantelete)

    → FASE 2   Instagram/FB (Chrome "cuy")

    → FASE 2b  Logo + color marca

    → FASE 3   Brand kit + Blob + Maqueta ?kit=

    → FASE 4   Notion CRM

```



```bash

node preparador.js

node preparador.js --dry-run

node preparador.js --reset-memoria

node scripts/audit-chains.js

node scripts/pilot-brand-kit.js
node scripts/test-guantelete.js

```



---



## 3. Nichos y plantillas (`SEARCH_MODE=balance`, **10 leads/día** máximo)



Fuente de verdad: [`lib/templatePolicy.js`](../lib/templatePolicy.js) (`NICHE_QUERIES`). Cupos: [`lib/rotacion.js`](../lib/rotacion.js). Clasificación por nombre/categoría Maps: [`lib/classify.js`](../lib/classify.js).



| Nicho | Query Maps (ej.) | Plantilla |

|-------|------------------|------------|

| Gym | gimnasio local Lima | `gimnasios` |

| Gym peleas | muay thai boxeo mma gym Lima | `gimnasios` |

| Colegio | colegio academia Lima | `colegios` |

| Clínica (cualquier especialidad) | clinica medica Lima | `clinicas` |

| Spa | spa masajes bienestar Lima | **`spas`** |

| Estética | centro estetica facial corporal Lima | **`estetica`** |

| *(excluido)* | farmacias / veterinarias / pharma | no entran al pipeline |

| Boutique | boutique ropa independiente Lima | `tiendas` (+ ecommerce) |

| Inmobiliaria | inmobiliaria bienes raices Lima | **`inmobiliarias`** |

| Corporativo | consultora pequeña empresas Lima | `corporativo` |

| Hotel / hostal | hotel hostal boutique Lima | **`hoteles`** |



`LEADS_PER_DAY=10` (tope duro en `preparador.js`). `QUALIFY_MIN_SCORE=65`. Cadenas: `data/chains.json`.



**Google Search (FASE 1.5):** solo Playwright headless en [`lib/googleWebDiscovery.js`](../lib/googleWebDiscovery.js) — verifica web/correo cuando Maps no muestra sitio. No usamos paquetes `google-sr` / `googlethis` (ver LOGICA_PASOS).



---



## 4. Contrato URL



### Modo nuevo (recomendado)



```

https://plantillas-web-maestra-final.vercel.app/?kit=baransu-gym-20260603&wa=51999888777

```



Manifest en Blob / `public/kits/` / API `/api/kit/:slug`.



### Modo legacy (compatibilidad)



```

?cliente=...&template=gimnasios&pri=f97316&v=fit&head=...&sub=...&sec=...

```



**Investigador:** `lib/urls.js`  

**Plantillas:** `src/lib/params.ts` + `src/lib/kit.ts`



---



## 5. Guantelete APIs ($0) — qué keys pedir



| Prioridad | `.env` | Rol |

|-----------|--------|-----|

| Obligatorio | `GEMINI_API_KEY` (+ `_2`) | Visión, copy hero |

| Obligatorio | `BLOB_READ_WRITE_TOKEN` | Kits JSON + fotos IG en CDN |

| Alta | `COHERE_API_KEY` | Audit JSON, secciones |

| Alta | `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_AI_API_TOKEN` | Fallback inmortal (~10k/día) |

| Alta | `CEREBRAS_API_KEY` | Audit rápido |

| Alta | `GROQ_API_KEY` | Respaldo audit/copy |

| Reserva | `SAMBANOVA_API_KEY` | **Último** en cadena (~$5 total, no gastar en rutina) |

| Media | `AI21_API_KEY` | HTML largo (tarea `longcontext`) |

| Media | `GITHUB_TOKEN` | GitHub Models — copy + sections |

| Opcional | `OPENROUTER_API_KEY`, `MISTRAL_API_KEY` | Reserva |

| **No usar** | Together AI | Crédito no renovable |



Router: [`lib/llm/router.js`](../lib/llm/router.js) — modos `balanced` | `fast` | `quality`.



Roles completos: [GUANTELETE_ROLES.md](GUANTELETE_ROLES.md). Prueba: `node scripts/test-guantelete.js`.

Con tus keys actuales: **audit=Cerebras/Cohere**, **copy/sections=GitHub** si Gemini 429.



---



## 6. Vercel Blob (storage, no deploy)



- Token en `.env` del **Investigador** (sube kits y rehost imágenes).

- Mismo token en **Vercel → Environment Variables** del proyecto GitHub-linked.

- Opcional: `KIT_PUBLIC_BASE_URL` o `VITE_KIT_CDN_BASE` en Plantillas (prefijo CDN).

- Alternativa: Supabase bucket `brand-kits`.

- **TTL 10 días (producción):** Los kits/maquetas y assets (JSON, logos, imágenes rehost) en Vercel Blob tienen **vida útil estricta de 10 días** para no saturar la cuota del plan Hobby. Si el prospecto no responde en ese plazo, la demo expira y el blob se borra. Purga automática al inicio de cada corrida (`preparador.js`) y vía `Roberto.bat` / `npm run limpiar-blob`. Variables: `BLOB_TTL_DAYS=10`, `BLOB_CLEANUP_ON_RUN=true` (poner `false` para desactivar solo en la corrida).



Sin Blob: copia local a `Plantillas-Web-Maestra/public/kits/` para `npm run dev`.



---



## 7. Plantillas-Web-Maestra



**Repo:** `git@github.com:cuylabs-dev/Plantillas-Web-Maestra.git`  

**Producción:** https://plantillas-web-maestra-final.vercel.app (tras `git push`)



```

src/lib/kit.ts          # fetch kit (CDN → static → API)

src/context/BrandKitContext.tsx

src/components/BrandGallery.tsx

api/kit/[slug].js       # lee Blob con token en Vercel env

```



### Publicar cambios



```bash

npm run build

git push origin main

```



Ver [COMANDOS_PUSH.md](COMANDOS_PUSH.md).



---



## 8. Notion



Columnas: Título, WhatsApp, **Maqueta URL**, Nicho, Score, Redes, Estado.  

Diagnóstico incluye `Kit: {slug}` si hay brand kit.



---



## 9. Variables `.env` (resumen)



Ver `.env.example`. Críticas: `FACTORIA_BASE_URL`, `BLOB_READ_WRITE_TOKEN`, Guantelete keys, `OBSIDIAN_DB_DIR`, Chrome `cuy` para IG.



---



## 10. Archivos sensibles al contrato



| Archivo | Motivo |

|---------|--------|

| `lib/urls.js` + `src/lib/params.ts` + `src/lib/kit.ts` | URL y kit |

| `lib/llm/router.js` | Cadena de proveedores |

| `lib/templatePolicy.js` | Nichos → plantilla + bloques |

| `lib/rotacion.js` | Reparte `LEADS_PER_DAY` entre nichos |

| `lib/googleWebDiscovery.js` | Verificación web Google (sin sitio en Maps) |



---



## 11. Checklist plantillas



- [ ] `npm run build` OK

- [ ] Probar `?kit=slug` y URL legacy con `pri`

- [ ] `git push origin main` (no Deploy manual)

- [ ] Si cambias params URL → actualizar Investigador



---



## 12. Más docs



- [PLAN_COPY_APIS.md](PLAN_COPY_APIS.md) — qué API hace qué + plan copy personalizado
- [LOGICA_PASOS.md](LOGICA_PASOS.md)

- [Requisitos.md](Requisitos.md)

- [Flujo_Trabajo.md](Flujo_Trabajo.md)

- [Implementation_Plan.md](Implementation_Plan.md)



*Última actualización: junio 2026 — 10 nichos, 6 plantillas (`hoteles`), 10 leads/día, FASE 2 IG sin cambios (perfil cuy), Google verify vía Playwright.*

