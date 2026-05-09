#!/usr/bin/env bash
# Test script — valida que a API SGBR/BI Tiete Espumas responde com as credenciais
# documentadas e que cada um dos 6 endpoints de dados retorna JSON parseável.
#
# Uso:
#   bash scripts/test-sgbr-tiete.sh
#
# Pré-requisitos: bash, curl, openssl, jq (jq é opcional — só pra pretty-print)
#
# Não comita no repo: usa as credenciais inline declaradas no plano de Beta
# (login=iga / senha=123456). Em produção, essas viram tenant config.

set -euo pipefail

BASE_URL="${SGBR_API_URL:-http://108.181.223.103:3007}"
LOGIN="${SGBR_LOGIN:-iga}"
PASSWORD="${SGBR_PASSWORD:-123456}"

# SGBR BI exige senha em SHA-256 hex.
PASSWORD_SHA256=$(printf '%s' "$PASSWORD" | openssl dgst -sha256 | awk '{print $NF}')

echo "🔐 Login em $BASE_URL/sgbrbi/usuario/login"
LOGIN_RESPONSE=$(curl -fsS \
  -H 'Content-Type: application/json' \
  -d "{\"login\":\"$LOGIN\",\"senha\":\"$PASSWORD_SHA256\"}" \
  "$BASE_URL/sgbrbi/usuario/login" || echo "ERROR")

if [[ "$LOGIN_RESPONSE" == "ERROR" ]]; then
  echo "❌ Falha no login. Verifique conectividade e credenciais."
  exit 1
fi

echo "✅ Login retornou:"
if command -v jq > /dev/null 2>&1; then
  echo "$LOGIN_RESPONSE" | jq '. | { token: (.token // .access_token // null), keys: keys }'
else
  echo "$LOGIN_RESPONSE" | head -c 400
  echo
fi

# Tenta extrair o token de campos comuns
TOKEN=$(printf '%s' "$LOGIN_RESPONSE" | grep -oE '"(token|access_token|jwt)":\s*"[^"]+"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')

if [[ -z "${TOKEN:-}" ]]; then
  echo "⚠️  Não consegui extrair token automaticamente. Mostra o JSON inteiro acima e ajusta o campo no datasource."
  echo "Este script vai tentar usar a string toda como token (provavelmente vai falhar nos GETs)."
  TOKEN="$LOGIN_RESPONSE"
fi

# Lista de endpoints a validar
declare -a ENDPOINTS=(
  "/sgbrbi/vendas/analitico"
  "/sgbrbi/vendanfe/analitico?dt_de=2026.02.01&dt_ate=2026.02.28"
  "/sgbrbi/contas/pagas"
  "/sgbrbi/produzido"
  "/sgbrbi/estoque"
  "/sgbrbi/compras"
)

echo ""
echo "📡 Testando ${#ENDPOINTS[@]} endpoints..."
for EP in "${ENDPOINTS[@]}"; do
  URL="$BASE_URL$EP"
  STATUS=$(curl -s -o /tmp/sgbr-response.json -w '%{http_code}' \
    -H "Authorization: Bearer $TOKEN" \
    --max-time 60 \
    "$URL" || echo "000")
  SIZE=$(wc -c < /tmp/sgbr-response.json 2>/dev/null || echo 0)
  ROWS="?"
  if command -v jq > /dev/null 2>&1; then
    ROWS=$(jq 'if type == "array" then length elif .data and (.data | type == "array") then (.data | length) else "n/a" end' /tmp/sgbr-response.json 2>/dev/null || echo "n/a")
  fi
  if [[ "$STATUS" == "200" ]]; then
    echo "  ✅ $STATUS  $EP  ($SIZE bytes, ~$ROWS linhas)"
  else
    echo "  ❌ $STATUS  $EP"
    head -c 300 /tmp/sgbr-response.json 2>/dev/null
    echo
  fi
done

echo ""
echo "Pronto. Se tudo retornou 200, o IGA Gestão consegue conectar sem alterar código."
echo "Em produção, basta setar no Render Dashboard:"
echo "    SGBR_API_URL=$BASE_URL"
echo "    SGBR_CREDENTIALS=$LOGIN:$PASSWORD"
echo "  (o sistema cria os 6 datasources automaticamente no primeiro boot)"
