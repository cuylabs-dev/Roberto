@echo off
chcp 65001 >nul
title Investigador de Prospectos - Bucle Outbound B2B
cd /d "C:\Users\gabit\Documents\Git\CuyLabs\Investigador_Prospectos"

echo ============================================================
echo    INVESTIGADOR DE PROSPECTOS  -  Bucle Outbound B2B
echo ============================================================
echo  - Corre en segundo plano (no abre navegador, es headless).
echo  - El avance se muestra AQUI en vivo (FASE 1 a 4).
echo  - Cierra Google Chrome (perfil "cuy") antes de continuar.
echo ------------------------------------------------------------
echo.

if not exist "data" mkdir "data"

REM TTL Blob 10 dias (produccion) + pipeline
powershell -NoProfile -ExecutionPolicy Bypass -Command "node scripts/limpiar_blob.js 2>&1; node preparador.js 2>&1 | Tee-Object -FilePath 'data\run.log'"

echo.
echo ------------------------------------------------------------
echo  Corrida finalizada. Donde quedo la info:
echo    1) Obsidian : Bucle_Outbound\Base_Datos_Prospectos.md  (memoria)
echo    2) Notion   : tu CRM "4. CRM Prospeccion"
echo    3) Respaldo : data\leads_del_dia.json   ^|  Log: data\run.log
echo ------------------------------------------------------------
echo.
pause
