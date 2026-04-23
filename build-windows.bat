@echo off
setlocal enableextensions

rem =====================================================================
rem  IGA Gestão — build de distribuição Windows
rem
rem  Gera a pasta `dist-windows/` com:
rem    - back-end-gest-o/dist/           (TS compilado)
rem    - back-end-gest-o/node_modules/   (deps prod apenas)
rem    - back-end-gest-o/data/           (users.json, datasources.json)
rem    - back-end-gest-o/front-end-dist/ (SPA buildada, mesma origem)
rem    - start.bat                       (launcher)
rem
rem  Pré-requisito: Node.js 20+ instalado na máquina do usuário final.
rem =====================================================================

set "ROOT=%~dp0"
set "OUT=%ROOT%dist-windows"
set "FRONT=%ROOT%front-end-gest-o"
set "BACK=%ROOT%back-end-gest-o"

echo.
echo === [1/5] Limpando pasta de distribuicao ===
if exist "%OUT%" rmdir /S /Q "%OUT%"
mkdir "%OUT%"
mkdir "%OUT%\back-end-gest-o"
mkdir "%OUT%\back-end-gest-o\front-end-dist"
mkdir "%OUT%\back-end-gest-o\data"

echo.
echo === [2/5] Build do frontend (Vite) ===
pushd "%FRONT%"
call npm run build
if errorlevel 1 goto :err
popd

echo.
echo === [3/5] Build do backend (tsc) ===
pushd "%BACK%"
call npm install --silent
call npm run build
if errorlevel 1 goto :err
popd

echo.
echo === [4/5] Copiando artefatos ===
rem  Prune devDependencies ANTES de copiar node_modules — reduz o instalador em ~60%%.
pushd "%BACK%"
call npm prune --omit=dev --silent
popd
xcopy /E /Y /Q "%BACK%\dist"           "%OUT%\back-end-gest-o\dist\"
xcopy /E /Y /Q "%BACK%\node_modules"   "%OUT%\back-end-gest-o\node_modules\"
xcopy /E /Y /Q "%FRONT%\dist"          "%OUT%\back-end-gest-o\front-end-dist\"
copy /Y "%BACK%\package.json"          "%OUT%\back-end-gest-o\"

rem  Dados: sempre entregar base limpa ao cliente — seed cria admin no 1%% boot com senha aleatória.
rem  Nunca copie %BACK%\data\*.json: risco de vazar credenciais de dev em produção.
> "%OUT%\back-end-gest-o\data\users.json"       echo [ ]
> "%OUT%\back-end-gest-o\data\datasources.json" echo [ ]

rem  .env NÃO é copiado — main.mjs (Electron) injeta toda a config de runtime via env de processo.

rem  Restaura devDependencies para não atrapalhar o desenvolvimento local após o build.
pushd "%BACK%"
call npm install --silent
popd

echo.
echo === [5/5] Gerando launcher start.bat ===
> "%OUT%\start.bat" echo @echo off
>> "%OUT%\start.bat" echo setlocal
>> "%OUT%\start.bat" echo set "NODE_ENV=production"
>> "%OUT%\start.bat" echo cd /D "%%~dp0back-end-gest-o"
>> "%OUT%\start.bat" echo echo Iniciando IGA Gestao em http://localhost:3001 ...
>> "%OUT%\start.bat" echo start "" "http://localhost:3001"
>> "%OUT%\start.bat" echo node dist\server.js

echo.
echo ======================================================================
echo  Build concluida. Distribuicao pronta em:
echo    %OUT%
echo.
echo  Para rodar na maquina destino:
echo    1. Copie a pasta dist-windows para onde quiser instalar.
echo    2. Certifique-se de que Node.js 20+ esteja instalado.
echo    3. Execute `start.bat`.
echo ======================================================================
goto :eof

:err
echo.
echo !!! ERRO na build. Verifique as mensagens acima.
exit /b 1
