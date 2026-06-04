@echo off
chcp 65001 >nul
title Roberto - Bucle Outbound B2B

set "ROOT=C:\Users\gabit\Documents\Git\CuyLabs\Investigador_Prospectos"

if not exist "%ROOT%\package.json" (
  echo ERROR: Proyecto no encontrado en %ROOT%
  echo Edita ROOT en este archivo si cambiaste de carpeta.
  pause
  exit /b 1
)

cd /d "%ROOT%"

echo ROBERTO — %CD%
echo.

if not exist "node_modules\" (
  echo Instalando dependencias...
  call npm install
)

if not exist "data" mkdir "data"

powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-Location -LiteralPath '%ROOT%'; node scripts/limpiar_blob.js 2>&1; node preparador.js 2>&1 | Tee-Object -FilePath 'data\run.log'"

echo.
echo Corrida finalizada. Log: %ROOT%\data\run.log
pause
