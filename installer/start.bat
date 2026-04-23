@echo off
setlocal
set "NODE_ENV=production"
set "APP_DIR=%~dp0back-end-gest-o"
set "BUNDLED_NODE=%~dp0runtime\node\node.exe"

cd /D "%APP_DIR%"
echo Iniciando IGA Gestao em http://localhost:3001 ...
start "" "http://localhost:3001"

if exist "%BUNDLED_NODE%" (
  "%BUNDLED_NODE%" dist\server.js
) else (
  node dist\server.js
)
