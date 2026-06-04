# Guantelete — roles por API (Bucle Outbound)

Orden de uso en producción: **gratis primero**, **SambaNova al final** (~$5 de crédito total, luego muere).

## Matriz de roles

| Proveedor | Rol principal | Fases | Tarea router | Por qué |
|-----------|---------------|-------|--------------|---------|
| **Gemini** (×2 keys) | Visión logo/paleta + copy hero premium | 2b, 3 | `vision`, `copy` | Multimodal + español PE |
| **Cerebras** | Audit veloz (calificar lead) | 1.5 | `audit` | Modelo free: `gpt-oss-120b` |
| **Cohere** | JSON estructurado (audit + secciones) | 1.5, 3 | `audit`, `sections` | Command-R excelente en JSON |
| **Cloudflare Workers AI** | Soldado inmortal (~10k/día) | 1.5, 3 | todas | No cae cuando Groq/Gemini 429 |
| **GitHub Models** | Copy + bloques de sección | 3 | `copy`, `sections` | GPT-4o mini / Llama gratis |
| **AI21 Jamba** | HTML largo del sitio del lead | 1.5 | `longcontext` | Contexto grande (>8 KB) |
| **Groq** | Respaldo rápido (si tienes key) | 1.5, 3 | `audit`, `copy` | Opcional |
| **SambaNova** | **Último recurso** ($5 límite) | 1.5, 3 | al final de cada cadena | Solo si todo lo demás agotó cuota |
| **OpenRouter / Mistral** | Reserva opcional | — | fallback | Si añades keys |
| **Together AI** | — | — | **NO USAR** | Crédito no renovable |

## Cadena `balanced` (resumen)

```
audit:      Cerebras → Cohere → Groq → Cloudflare → GitHub → Gemini → AI21 → SambaNova
copy:       Gemini → GitHub → Cohere → Cloudflare → Groq → Cerebras → SambaNova
sections:   GitHub → Cohere → Cloudflare → Groq → Cerebras → Gemini → SambaNova
longcontext: AI21 → Cloudflare → Gemini → Cohere → SambaNova
vision:     Gemini → OpenRouter (opcional)
```

## Scraping vs LLM

| Fase | ¿LLM? | Motor |
|------|-------|--------|
| FASE 1 Maps | No | Playwright + `chains.json` |
| FASE 1.5 | Sí | Cerebras/Cohere primero |
| FASE 2 IG | No | Chrome perfil `cuy` |
| FASE 2b logo | Sí | Gemini `vision` |
| FASE 3 kit | Sí | Gemini + GitHub + Cohere `sections` |

El scraping **no mejora** con más LLMs; mejora con perfil `cuy` estable y `HEADLESS=true`. Los LLMs mejoran **calificación, copy y kit**.

## Variables `.env`

```env
GEMINI_API_KEY=
GEMINI_API_KEY_2=
COHERE_API_KEY=
CLOUDFLARE_ACCOUNT_ID=    # obligatorio para Cloudflare
CLOUDFLARE_AI_API_TOKEN=
CEREBRAS_API_KEY=
AI21_API_KEY=
GITHUB_TOKEN=
SAMBANOVA_API_KEY=        # reserva
BLOB_READ_WRITE_TOKEN=
```

## Probar

```bash
node scripts/test-guantelete.js
node scripts/pilot-brand-kit.js
```

## Seguridad

Nunca subas `.env` a git. Si una key apareció en chat, rótala en el panel del proveedor.
