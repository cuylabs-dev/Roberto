@echo off
title Roberto - Bucle Outbound B2B
cd /d "%~dp0"

if not exist "node_modules" (
  echo Instalando dependencias...
  call npm install
)

if not exist "data" mkdir "data"

REM TTL Blob 10d + pipeline
powershell -NoProfile -ExecutionPolicy Bypass -Command "node scripts/limpiar_blob.js 2>&1; node preparador.js 2>&1 | Tee-Object -FilePath 'data\run.log'"

pause
