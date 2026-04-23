@echo off
setlocal enableextensions

rem =====================================================================
rem  IGA Gestão — atalho para construir o instalador .exe
rem
rem  Executa, na ordem:
rem    1. build-windows.bat   (se dist-windows nao existir, gera)
rem    2. iscc installer.iss  (compila o instalador)
rem
rem  Pre-requisitos:
rem    - Inno Setup 6 instalado com iscc no PATH
rem    - installer\nssm\nssm.exe presente
rem =====================================================================

set "ROOT=%~dp0"
cd /D "%ROOT%"

echo.
echo === [1/3] Verificando pre-requisitos ===
where iscc >nul 2>&1
if errorlevel 1 (
  echo ERRO: iscc nao encontrado no PATH.
  echo Instale Inno Setup 6: https://jrsoftware.org/isdl.php
  exit /b 1
)
if not exist "%ROOT%installer\nssm\nssm.exe" (
  echo ERRO: installer\nssm\nssm.exe nao encontrado.
  echo Baixe NSSM ^(64-bit^) em https://nssm.cc/download e extraia win64\nssm.exe.
  exit /b 1
)

echo.
echo === [2/3] Gerando build de distribuicao ===
if not exist "%ROOT%dist-windows\back-end-gest-o\dist\server.js" (
  call "%ROOT%build-windows.bat"
  if errorlevel 1 (
    echo ERRO: falha no build-windows.bat.
    exit /b 1
  )
) else (
  echo dist-windows ja existe — reutilizando. Delete a pasta para forcar rebuild.
)

echo.
echo === [3/3] Compilando instalador (Inno Setup) ===
pushd "%ROOT%installer"
iscc installer.iss
if errorlevel 1 (
  echo ERRO: falha na compilacao Inno Setup.
  popd
  exit /b 1
)
popd

echo.
echo ======================================================================
echo  Instalador gerado:
echo    %ROOT%installer\output\IgaGestao-Setup-1.0.0.exe
echo.
echo  Teste em uma maquina limpa com Node.js 20+ instalado.
echo ======================================================================
