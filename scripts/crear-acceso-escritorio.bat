@echo off
REM Copia el lanzador Roberto.bat al Escritorio (OneDrive o local)
set "SRC=%~dp0..\desktop-launcher\Roberto-Escritorio.bat"
set "ROOT=%~dp0.."

if not exist "%SRC%" set "SRC=%ROOT%\desktop-launcher\Roberto-Escritorio.bat"

for %%D in ("%USERPROFILE%\OneDrive\Desktop" "%USERPROFILE%\Desktop") do (
  if exist %%D (
    copy /Y "%ROOT%\desktop-launcher\Roberto-Escritorio.bat" "%%~fD\Roberto.bat" >nul
    echo Copiado a: %%~fD\Roberto.bat
  )
)
pause
