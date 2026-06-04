# Requisitos Técnicos — Investigador de Prospectos

> Salida: **Notion**. WhatsApp: **manual**. Maquetas: factoría (GitHub → Vercel) + **Brand Kit** en Blob.

---

## 0. Decisiones operativas

| Tema | Decisión |
|------|----------|
| Deploy factoría | **`git push`** a Plantillas; Vercel sincroniza desde GitHub (sin Deploy manual) |
| Nichos | `SEARCH_MODE=balance`, 20 leads → 4×5 rubros |
| LLM | Router Guantelete + Gemini; ver HANDOFF |
| Kits | `BLOB_READ_WRITE_TOKEN` o Supabase o `public/kits/` local |
| Anti-repetición | Obsidian `_registro_prospectos.json` |
| Instagram | Chrome perfil **cuy** (cerrar Chrome antes FASE 2) |

---

## 1. APIs — Guantelete (prioridad)

| Variable | Proveedor | Uso |
|----------|-----------|-----|
| `GEMINI_API_KEY` / `_2` | Google | Vision, copy |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob | Manifest + imágenes |
| `COHERE_API_KEY` | Cohere | Audit JSON, sections |
| `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_AI_API_TOKEN` | Cloudflare Workers AI | Fallback global |
| `CEREBRAS_API_KEY` | Cerebras | Audit rápido |
| `GROQ_API_KEY` | Groq | Respaldo |
| `SAMBANOVA_API_KEY` | SambaNova | Audit profundo |
| `AI21_API_KEY` | AI21 Jamba | HTML largo (longcontext) |
| `GITHUB_TOKEN` | GitHub Models | Copy, sections |
| `OPENROUTER_API_KEY` | OpenRouter | Opcional |
| `MISTRAL_API_KEY` | Mistral | Opcional |
| — | Together AI | **Excluido** |

`LLM_ROUTER_MODE`: `balanced` | `fast` | `quality`

---

## 2. Storage y factoría

| Variable | Uso |
|----------|-----|
| `FACTORIA_BASE_URL` | Base maqueta (default: plantillas-web-maestra-final.vercel.app) |
| `KIT_PUBLIC_BASE_URL` | Prefijo CDN Blob (Investigador, opcional) |
| `VITE_KIT_CDN_BASE` | Mismo prefijo en build Plantillas (Vercel env) |
| `SUPABASE_*` | Alternativa a Blob |

---

## 3. Operación Maps / Notion

| Variable | Uso |
|----------|-----|
| `LEADS_PER_DAY` | 20 |
| `QUALIFY_MIN_SCORE` | 65 |
| `NOTION_TOKEN` / `NOTION_DATABASE_ID` | CRM |
| `OBSIDIAN_DB_DIR` | Memoria scrape |
| `CHROME_USER_DATA_DIR` | Perfil cuy |

Ver `.env.example`.

---

## 4. Notion

Propiedades: Título, WhatsApp, Maqueta URL, Nicho, Score, Redes, Estado. Diagnóstico con `Kit: slug`.

---

## 5. Maqueta URL

**Corta:** `?kit={slug}&wa={numero}`  
**Legacy:** `?cliente=&template=&pri=&head=&sec=...`

---

## 6. Dependencias

```bash
npm install
npx playwright install chromium
```

---

## Enlaces

[[HANDOFF_COLABORADOR]] | [[LOGICA_PASOS]] | [[COMANDOS_PUSH]] | [[Flujo_Trabajo]]
