@echo off
chcp 65001 >nul
title Roberto - Bucle Outbound B2B

REM Carpeta donde vive este .bat (NO ejecutar copia en Escritorio)
set "ROOT=%~dp0"
cd /d "%ROOT%"

if not exist "%ROOT%package.json" (
  echo.
  echo ERROR: No encuentro package.json en:
  echo   %ROOT%
  echo.
  echo Abre Roberto.bat desde la carpeta del proyecto:
  echo   C:\Users\gabit\Documents\Git\CuyLabs\Investigador_Prospectos
  echo.
  pause
  exit /b 1
)

echo ============================================================
echo    ROBERTO  -  Investigador de Prospectos
echo ============================================================
echo  Carpeta: %CD%
echo ------------------------------------------------------------
echo.

if not exist "node_modules\" (
  echo Instalando dependencias...
  call npm install
  if errorlevel 1 (
    echo ERROR: npm install fallo.
    pause
    exit /b 1
  )
)

if not exist "data" mkdir "data"

REM PowerShell NO hereda el cd del .bat: hay que Set-Location explicito
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Set-Location -LiteralPath '%ROOT%'; " ^
  "node scripts/limpiar_blob.js 2>&1; " ^
  "node preparador.js 2>&1 | Tee-Object -FilePath 'data\run.log'"

echo.
echo ------------------------------------------------------------
echo  Corrida finalizada.
echo    Notion CRM  ^|  data\leads_del_dia.json  ^|  data\run.log
echo ------------------------------------------------------------
echo.
pause
