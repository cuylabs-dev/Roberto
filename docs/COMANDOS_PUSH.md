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
| `VITE_KIT_CDN_BASE` | Prefijo CDN Blob, ej. `https://xxxx.public.blob.vercel-storage.com` (sin barra final) |

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

## 4. Seguridad del token Blob

Si el token se filtró en chat o git: **regenerar** en Vercel Blob y actualizar solo `.env` + env de Vercel. Nunca subir `.env` a GitHub.

---

## 5. Preview local de maquetas (sin esperar Vercel)

```powershell
cd C:\Users\gabit\Documents\Git\CuyLabs\Plantillas-Web-Maestra
npm run dev
```

Abre: `http://127.0.0.1:5173/?kit=NOMBRE-SLUG-DEL-KIT`

El Investigador copia kits a `public/kits/` cuando existe el repo vecino.
