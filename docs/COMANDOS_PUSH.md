# Comandos Git y pruebas (ejecutar en tu PC)

La universidad puede bloquear GitHub desde el IDE; corre esto **en tu PowerShell** cuando termines cambios.

---

## 1. Plantillas-Web-Maestra (actualiza el sitio vía GitHub → Vercel)

No uses el botón "Deploy" en Vercel. El flujo es **push a `main`**.

```powershell
cd C:\Users\gabit\Documents\Git\CuyLabs\Plantillas-Web-Maestra
git add -A
git status
git commit -m "feat: kit CDN Guantelete y docs"
git push origin main
```

Espera 1–3 min y abre: https://plantillas-web-maestra-final.vercel.app

---

## 2. Variables en Vercel (una vez, proyecto enlazado a GitHub)

En el proyecto Vercel → **Settings → Environment Variables**:

| Variable | Dónde la sacas |
|----------|----------------|
| `BLOB_READ_WRITE_TOKEN` | Vercel → Storage → Blob → token (mismo valor que en `.env` del Investigador) |
| `VITE_KIT_CDN_BASE` | `https://sofcoz0qb7t6uvab.public.blob.vercel-storage.com` (sin barra final) |
| `BLOB_READ_WRITE_TOKEN` | Token que empieza con `vercel_blob_rw_` (no confundir con Gemini `AQ.`) |

Redeploy ocurre solo al siguiente push; no hace falta deploy manual.

---

## 3. Investigador (local; push solo si tienes remoto)

```powershell
cd C:\Users\gabit\Documents\Git\CuyLabs\Investigador_Prospectos
copy .env.example .env
# Editar .env con tus API keys (nunca commit)

npm install
npx playwright install chromium

node scripts/audit-chains.js
node scripts/pilot-brand-kit.js
.\Investigador.bat
```

---

## 4. Retención Blob (TTL 10 días)

Kits/maquetas en Vercel Blob expiran a los **10 días** (`BLOB_TTL_DAYS`). Purga manual o antes de cada corrida:

```powershell
cd C:\Users\gabit\Documents\Git\CuyLabs\Investigador_Prospectos
npm run limpiar-blob
npm run purgar-data   # solo data/ local; Notion/Obsidian manual
```

`Roberto.bat` ejecuta `limpiar_blob.js` antes del pipeline.

---

## 5. Seguridad del token Blob

Si el token se filtró en chat o git: **regenerar** en Vercel Blob y actualizar solo `.env` + env de Vercel. Nunca subir `.env` a GitHub.

---

## 6. Preview local de maquetas (sin esperar Vercel)

```powershell
cd C:\Users\gabit\Documents\Git\CuyLabs\Plantillas-Web-Maestra
npm run dev
```

Abre: `http://127.0.0.1:5173/?kit=NOMBRE-SLUG-DEL-KIT`

El Investigador copia kits a `public/kits/` cuando existe el repo vecino.
