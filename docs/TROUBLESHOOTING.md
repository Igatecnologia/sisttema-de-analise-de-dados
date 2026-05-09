# IGA Gestao — Guia de Troubleshooting

Guia para diagnosticar e resolver problemas de dados incompletos ou ausentes no frontend.

---

## Fluxo de Dados (como funciona)

```
[ERP do cliente]          [Backend IGA]              [Frontend IGA]
  (SGBR BI etc.)            (Express)                  (React)
       |                       |                          |
       |  <-- proxy/data -->   |                          |
       |    (auth + paginacao  |   <-- axios + query -->  |
       |     + cache 5min)     |      (stale 15min)       |
       |                       |                          |
  API externa            :3001 (porta)            :5173 (vite dev)
```

---

## Checklist Rapido

Antes de investigar, verifique estes 5 itens:

- [ ] Backend esta rodando? (`npm run dev` na pasta `back-end-gest-o`)
- [ ] Frontend aponta para o backend certo? (ver `.env.local`)
- [ ] Credenciais do ERP estao corretas? (ver `.env` do backend)
- [ ] A API do ERP esta online? (testar URL no navegador)
- [ ] O navegador mostra erros no Console? (F12 → Console)

---

## Problema 1: Frontend nao mostra dados nenhum

### Causa mais comum: Backend nao esta rodando ou URL errada

**Verificar no frontend:**

1. Abrir o arquivo `front-end-gest-o/.env.local`:
```
VITE_API_BASE_URL=http://localhost:3001
```

2. Se o backend roda em outra porta ou IP, ajustar. Exemplos:
```
# Backend na mesma maquina, porta 3001
VITE_API_BASE_URL=http://localhost:3001

# Backend em outro computador na rede
VITE_API_BASE_URL=http://192.168.1.100:3001

# Producao (mesmo servidor, Express serve tudo)
VITE_API_BASE_URL=
```

3. Reiniciar o frontend apos mudar `.env.local` (`npm run dev`)

**Verificar no backend:**

1. Rodar o backend:
```bash
cd back-end-gest-o
npm run dev
```

2. Deve aparecer: `Server listening on http://localhost:3001`
   - Se a porta 3001 estiver em uso, ele tenta 3002, 3003... ate 3020
   - Verifique qual porta ele escolheu e atualize o `.env.local` do frontend

3. Testar se responde:
```bash
curl http://localhost:3001/api/proxy/health
```
Deve retornar JSON com status do cache e tokens.

---

## Problema 2: Login funciona mas dados nao carregam

### Causa mais comum: Fonte de dados nao configurada ou credenciais erradas

**Passo 1 — Verificar fontes de dados:**

No frontend, ir em **Fontes de Dados** (menu lateral) e verificar:
- Existe pelo menos 1 fonte configurada?
- A URL da API esta correta?
- As credenciais estao preenchidas?
- O tipo de autenticacao esta correto?

**Passo 2 — Testar conexao manualmente:**

```bash
# Testar se a API do ERP responde
curl -v "https://api.sgbrbi.com.br/endpoint" \
  -H "Authorization: Bearer SEU_TOKEN"

# Ou via proxy do IGA
curl "http://localhost:3001/api/proxy/data?dsId=ID_DA_FONTE&endpoint=estoque" \
  -H "Cookie: iga_session=SEU_TOKEN_DE_SESSAO"
```

**Passo 3 — Verificar variavel de ambiente do backend:**

No arquivo `back-end-gest-o/.env`:
```
SGBR_CREDENTIALS=usuario:senha
```
Esta variavel e o fallback quando a fonte de dados nao tem credenciais proprias.

---

## Problema 3: Alguns modulos carregam, outros nao

### Causa mais comum: Endpoint especifico falhando ou campo de paginacao diferente

**Mapeamento de modulos → endpoints:**

| Modulo no frontend | Rota do backend | Endpoint externo |
|---|---|---|
| Dashboard | `/erp/fichas-tecnicas` + varios | estoque + produzido |
| Producao | `/erp/producao-diaria` | produzido (filtrado por data) |
| Estoque | `/finance/estoque-*` | estoque (classificado) |
| Financeiro | `/finance/contas-pagar` | contaspagar |
| Vendas Analitico | `/erp/vendas-sgbr` | vendas |
| Compras | `/erp/compras-materia-prima` | compras |
| Notas Fiscais | `/erp/faturamentos` | vendanfe |
| Copilot | `/api/copilot/chat` | Groq API (nao ERP) |

**Diagnosticar qual endpoint falha:**

1. Abrir o DevTools do navegador (F12)
2. Ir na aba **Network**
3. Navegar para o modulo que nao mostra dados
4. Procurar requests vermelhas (status 4xx/5xx) ou sem resposta
5. Clicar na request → ver a Response

**Erros comuns:**

| Status | Significado | Solucao |
|---|---|---|
| 401 | Token expirou | Fazer logout e login novamente |
| 403 | Sem permissao | Verificar role do usuario (admin/manager/viewer) |
| 404 | Endpoint nao existe | Verificar se a URL da fonte esta correta |
| 408/504 | Timeout | API do ERP esta lenta. Ver secao "API lenta" |
| 429 | Muitas requisicoes | Limite de 60 req/min por IP. Esperar 1 minuto |
| 500 | Erro interno | Ver logs do backend no terminal |

---

## Problema 4: Dados aparecem incompletos (faltam registros)

### Causa mais comum: Paginacao truncada por timeout

O proxy busca dados em paginas. Se a API externa demora, ele pode parar antes de buscar tudo.

**Como funciona a paginacao:**

1. Proxy tenta buscar pagina 1
2. Se tem mais paginas, busca em paralelo (3 por vez) ou sequencial
3. **Deadline total: 110 segundos** — se ultrapassar, retorna o que tem
4. **Maximo de paginas: 200** (sequencial) ou 5000 (com total conhecido)

**Sintomas de truncamento:**
- Dashboard mostra numeros menores que o esperado
- Lista de produtos/vendas esta incompleta
- Dados antigos aparecem, mas recentes nao

**Solucoes:**

1. **Aumentar o timeout** (no `.env` do backend):
```
PROXY_UPSTREAM_TIMEOUT_MS=180000
PROXY_GLOBAL_DEADLINE_MS=170000
```

2. **Aumentar o tamanho da pagina** (menos requests):
```
SGBR_PROXY_DEFAULT_TAMANHO=5000
```

3. **Verificar se a API suporta paginacao:**
```bash
# Testar se pagina 2 retorna dados diferentes
curl "https://api.sgbrbi.com.br/endpoint?pagina=1&tamanho=100"
curl "https://api.sgbrbi.com.br/endpoint?pagina=2&tamanho=100"
```

4. **Habilitar log detalhado** para ver exatamente o que acontece:
```
LOG_PROXY_DATA=1
```
O terminal mostrara JSON com `pages_fetched`, `total_rows`, `truncated`, etc.

---

## Problema 5: Dados estao desatualizados / cache

### O sistema tem 2 camadas de cache:

| Camada | Duracao | Onde |
|---|---|---|
| Cache do proxy (backend) | 5 minutos | Respostas da API externa |
| Cache do React Query (frontend) | 15 minutos | Dados na memoria do navegador |

**Para forcar atualizacao:**

1. **Frontend**: Ctrl+Shift+R (hard reload) OU usar o botao de refresh da pagina
2. **Backend**: Reiniciar o servidor (`Ctrl+C` e `npm run dev` novamente)
3. **Ou desabilitar cache temporariamente** (no `.env` do backend):
```
PROXY_CACHE_TTL_MS=0
```

---

## Problema 6: CORS / Requisicoes bloqueadas

### Sintoma: Console mostra "CORS policy" ou "Network Error"

**Causa**: O `FRONTEND_URL` no backend nao bate com a origem do frontend.

**Verificar no `.env` do backend:**
```
FRONTEND_URL=http://localhost:5173
```

Deve ser **exatamente** a URL que aparece no navegador. Sem barra final.

Exemplos:
```
# Dev local
FRONTEND_URL=http://localhost:5173

# Acesso de outro PC na rede
FRONTEND_URL=http://192.168.1.50:5173

# Producao
FRONTEND_URL=https://app.igagestao.com.br

# Multiplas origens (separar por virgula se o backend suportar)
# Atualmente so aceita 1 origem em producao
```

**Se acessar de outro computador na rede:**
1. No computador que roda o frontend, descobrir o IP: `ipconfig` (Windows)
2. Rodar o vite com host exposto: `npm run dev -- --host`
3. No backend, setar `FRONTEND_URL=http://IP_DO_FRONTEND:5173`
4. No frontend do outro PC, setar `VITE_API_BASE_URL=http://IP_DO_BACKEND:3001`

---

## Problema 7: Token CSRF invalido

### Sintoma: Requests POST/PUT/DELETE falham com 403 "CSRF token mismatch"

O frontend envia `X-XSRF-TOKEN` lido do cookie `XSRF-TOKEN`. Se o cookie nao existe ou expirou:

1. Fazer logout e login novamente (renova o cookie)
2. Verificar se o backend esta setando o cookie:
   - DevTools → Application → Cookies → procurar `XSRF-TOKEN`
3. Se estiver em dominio diferente (backend vs frontend), o cookie pode nao ser enviado
   - Solucao: backend e frontend no mesmo dominio em producao

---

## Problema 8: API do ERP esta lenta (10-30 segundos)

### Sintomas: Telas demoram para carregar, dados parciais, timeouts

**O que ja esta implementado:**
- Cache de 5 minutos (segunda visita e instantanea)
- Warm cache (background job que pre-carrega dados)
- Paginacao paralela (3 paginas por vez)

**O que fazer:**

1. **Verificar warm cache:**
   O job `warmCache` roda automaticamente e pre-carrega endpoints. Verificar se esta rodando nos logs do backend.

2. **Filtrar por data:**
   Passar `dt_de` e `dt_ate` nas requisicoes reduz o volume de dados:
   ```
   /api/proxy/data?dsId=xxx&endpoint=vendas&dt_de=2026-01-01&dt_ate=2026-04-24
   ```

3. **Monitorar tempo por endpoint:**
   Com `LOG_PROXY_DATA=1`, o log mostra `elapsed_ms` por request.

---

## Variaveis de Ambiente — Referencia Rapida

### Backend (`back-end-gest-o/.env`)

```bash
# === OBRIGATORIAS ===
PORT=3001
FRONTEND_URL=http://localhost:5173
SGBR_CREDENTIALS=usuario:senha

# === OPCIONAIS (com defaults) ===
NODE_ENV=development
PROXY_UPSTREAM_TIMEOUT_MS=120000     # Timeout por request (ms)
PROXY_GLOBAL_DEADLINE_MS=110000      # Deadline total do /data (ms)
PROXY_CACHE_TTL_MS=300000            # Cache: 5 min
PROXY_CACHE_MAX_ENTRIES=50           # Max respostas em cache
PROXY_DATA_MAX_AUTO_PAGES=200        # Max paginas sequenciais
SGBR_PROXY_DEFAULT_TAMANHO=500       # Itens por pagina SGBR
LOG_PROXY_DATA=0                     # 1 = log detalhado de cada proxy call
GROQ_API_KEY=                        # Para Copilot IA (opcional)
ADMIN_DEFAULT_EMAIL=admin@iga.com    # Email do admin inicial
ADMIN_DEFAULT_PASSWORD=SenhaForte123 # Senha do admin inicial
```

### Frontend (`front-end-gest-o/.env.local`)

```bash
VITE_API_BASE_URL=http://localhost:3001   # URL do backend
VITE_HTTP_TIMEOUT_MS=180000               # Timeout axios (3 min)
VITE_APP_STAGE=                           # 'dev' ou 'homolog' (badge no header)
VITE_SGBR_BI_PROXY_TARGET=http://127.0.0.1:3007  # Proxy BI (dev only)
```

---

## Diagnostico Passo a Passo (copiar e seguir)

Se nenhuma das secoes acima resolveu, siga este fluxo completo:

```
1. BACKEND RODANDO?
   cd back-end-gest-o && npm run dev
   → Se erro: npm install primeiro
   → Anotar a porta que aparece no terminal

2. BACKEND RESPONDE?
   curl http://localhost:PORTA/api/proxy/health
   → Se nao responde: firewall? porta bloqueada?
   → Se responde: prosseguir

3. FRONTEND CONECTA AO BACKEND?
   → Abrir o frontend no navegador
   → F12 → Console → procurar erros de CORS ou Network
   → Se CORS: ajustar FRONTEND_URL no backend .env
   → Se nao conecta: ajustar VITE_API_BASE_URL no frontend .env.local

4. LOGIN FUNCIONA?
   → Tentar logar
   → Se 401: credenciais erradas ou admin nao foi criado
   → Se funciona: prosseguir

5. DADOS CARREGAM?
   → F12 → Network → navegar pelo sistema
   → Procurar requests com status vermelho
   → Clicar → ver Response body
   → Se 401: token expirou, relogar
   → Se 404: endpoint nao encontrado
   → Se 500: ver logs do backend
   → Se timeout: aumentar PROXY_UPSTREAM_TIMEOUT_MS

6. DADOS INCOMPLETOS?
   → Habilitar LOG_PROXY_DATA=1 no backend
   → Reiniciar backend
   → Repetir a operacao
   → Ver no terminal: pages_fetched, total_rows, truncated
   → Se truncated=true: aumentar deadline ou tamanho de pagina

7. DADOS DESATUALIZADOS?
   → Ctrl+Shift+R no navegador
   → Se persistir: reiniciar backend (limpa cache)
   → Se persistir: PROXY_CACHE_TTL_MS=0 (desabilita cache)
```

---

## Logs Uteis

### Onde ficam os logs

| Log | Onde | Como ativar |
|---|---|---|
| Backend (geral) | Terminal onde roda `npm run dev` | Sempre ativo |
| Proxy detalhado | Terminal do backend | `LOG_PROXY_DATA=1` no .env |
| Frontend (erros) | Console do navegador (F12) | Sempre ativo |
| Requisicoes HTTP | Network tab do navegador (F12) | Sempre ativo |

### Como ler o log do proxy

Com `LOG_PROXY_DATA=1`, cada chamada a `/api/proxy/data` mostra:

```json
{
  "endpoint": "estoque",
  "dsId": "abc123",
  "pages_fetched": 5,
  "total_rows": 2340,
  "truncated": false,
  "elapsed_ms": 8420,
  "cache_hit": false
}
```

- `truncated: true` = nao buscou tudo (timeout ou limite de paginas)
- `cache_hit: true` = dados vieram do cache, nao da API
- `elapsed_ms` alto = API externa esta lenta

---

## Contato para Suporte

Se nada resolver, envie estas informacoes:
1. Screenshot do console do navegador (F12 → Console)
2. Screenshot do terminal do backend
3. Conteudo do `.env` do backend (mascarar senhas)
4. Conteudo do `.env.local` do frontend
5. Qual modulo nao funciona e o que aparece na tela
