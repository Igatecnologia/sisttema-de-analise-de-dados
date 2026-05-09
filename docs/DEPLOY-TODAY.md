# Deploy Beta Fechada — Runbook (1 dia)

Passo-a-passo para subir o IGA Gestão em produção gratuita (Render + Vercel + Supabase + Upstash) e convidar os primeiros 5-10 tenants piloto.

**Tempo total estimado**: 1-2h se as contas free já existirem; 3-4h se for criar tudo do zero.

**Custo recorrente**: R$ 0/mês (todas as plataformas em tier free).

---

## ✅ Pré-requisitos

- [ ] Repositório no GitHub: `Maykesantos98/gest-o-Analisededados` ✅ (já existe)
- [ ] Conta GitHub com permissão de admin no repo
- [ ] Email para criar contas free
- [ ] OpenSSL instalado (Windows: Git Bash já tem)

---

## 1. Criar contas free (15-30 min)

| Serviço | URL | O que pegar | Custo |
|---------|-----|-------------|-------|
| **Supabase** | https://supabase.com | DATABASE_URL (Postgres com pooler) | Free 500MB |
| **Upstash** | https://upstash.com | REDIS_URL (rediss://) | Free 10k req/dia |
| **Render** | https://render.com | Conecte ao GitHub | Free (dorme após 15min) |
| **Vercel** | https://vercel.com | Conecte ao GitHub | Free (não dorme) |
| **Resend** | https://resend.com | RESEND_API_KEY | Free 100 emails/dia |
| **Stripe** | https://stripe.com | Test keys (sk_test_..., whsec_test_...) | Free em test mode |
| **Cloudflare Turnstile** | https://www.cloudflare.com/products/turnstile/ | TURNSTILE_SECRET | Free ilimitado |
| **Sentry** (opcional) | https://sentry.io | SENTRY_DSN | Free 5k errors/mês |

### Configuração específica do Supabase

Após criar projeto, vá em **Settings → Database → Connection String → Connection pooling** e copie a **Transaction mode** URL (porta `6543`).
Formato: `postgresql://postgres.<ref>:<senha>@aws-0-<region>.pooler.supabase.com:6543/postgres`

> ⚠️ NÃO use a "Direct connection" (porta 5432) em produção Render free — esgota o pool de conexões rapidamente.

---

## 2. Gerar segredos locais (2 min)

No terminal (Git Bash no Windows):

```bash
# JWT de sessão (32+ chars, recomendado 96 hex chars):
openssl rand -hex 48

# Chave de criptografia AES-256-GCM (32 bytes):
openssl rand -hex 32

# Senha admin inicial (14+ chars, sugestão):
openssl rand -base64 24
```

Anote esses 3 valores em local seguro (1Password, KeePass, gerenciador de senhas). **Não commitar**.

---

## 3. Deploy backend no Render (10-15 min)

### 3.1 Criar Web Service

1. Render Dashboard → **New → Blueprint**
2. Conecte ao repositório `gest-o-Analisededados`
3. Render detecta `render.yaml` automaticamente — clique **Apply**
4. Nome do serviço: `iga-gestao-api` (ou outro)

### 3.2 Setar Environment Variables

No painel do serviço criado → **Environment**, cole:

```bash
# === Storage ===
DATABASE_URL=postgresql://postgres.xxx:senha@aws-0-region.pooler.supabase.com:6543/postgres
REDIS_URL=rediss://default:senha@xxx.upstash.io:6379

# === Secrets gerados no Passo 2 ===
IGA_SESSION_JWT_SECRET=<saída do openssl rand -hex 48>
IGA_SECRETS_KEY=<saída do openssl rand -hex 32>

# === Auth ===
ADMIN_DEFAULT_EMAIL=admin@suaempresa.com
ADMIN_DEFAULT_PASSWORD=<senha forte 14+ chars>
SUPER_ADMIN_EMAILS=admin@suaempresa.com

# === Stripe (test mode para Beta) ===
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_PRO=price_xxx
STRIPE_PRICE_ENTERPRISE=price_xxx
BILLING_SUCCESS_URL=https://<vercel-url>.vercel.app/billing/sucesso
BILLING_CANCEL_URL=https://<vercel-url>.vercel.app/billing/cancelado
BILLING_PORTAL_RETURN_URL=https://<vercel-url>.vercel.app/billing

# === Frontend / CORS ===
FRONTEND_URL=https://<vercel-url>.vercel.app

# === Email ===
RESEND_API_KEY=re_xxx
PUBLIC_BASE_URL=https://<vercel-url>.vercel.app

# === Anti-bot ===
TURNSTILE_SECRET=xxx

# === Observabilidade (opcional) ===
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

> **Importante**: o backend agora valida essas variáveis no boot (`envValidation.ts`).
> Se faltar IGA_SESSION_JWT_SECRET, IGA_SECRETS_KEY, FRONTEND_URL, DATABASE_URL,
> STRIPE_SECRET_KEY ou STRIPE_WEBHOOK_SECRET em produção, o processo aborta com
> mensagem clara de qual variável está faltando.

### 3.3 Aguardar build

Build leva ~2-3 min. Acompanhe em **Logs** no Render. Se aparecer:

```
[IGA Backend] http://localhost:10000
```

backend está vivo. Se aparecer `[IGA Backend] Configuração de produção incompleta`, falta alguma env var listada na mensagem.

### 3.4 Configurar webhook Stripe

Após backend no ar (URL do tipo `https://iga-gestao-api.onrender.com`):

1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**
2. Endpoint URL: `https://iga-gestao-api.onrender.com/api/v1/billing/stripe/webhook`
3. Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
4. Copie o **Signing secret** (whsec_...) e cole no Render env var `STRIPE_WEBHOOK_SECRET` → redeploy

---

## 4. Deploy frontend no Vercel (5-10 min)

### 4.1 Importar projeto

1. Vercel Dashboard → **Add New → Project**
2. Importe `gest-o-Analisededados`
3. **Root Directory**: `front-end-gest-o`
4. **Framework Preset**: Vite
5. **Build Command**: `npm run build` (default)
6. **Output Directory**: `dist` (default)

### 4.2 Setar Environment Variables (Vercel)

```bash
VITE_API_BASE_URL=https://iga-gestao-api.onrender.com
VITE_TURNSTILE_SITE_KEY=<público — pode commitar, mas Vercel é mais limpo>
VITE_SENTRY_DSN=<opcional, mesmo do backend>
```

Clique **Deploy**. Build leva ~2 min.

### 4.3 Pegar URL final

Após deploy, Vercel dá URL tipo `https://iga-gestao-xxx.vercel.app`.

**Volte ao Render** e atualize:
- `FRONTEND_URL` → URL Vercel
- `PUBLIC_BASE_URL` → URL Vercel
- `BILLING_SUCCESS_URL`, `BILLING_CANCEL_URL`, `BILLING_PORTAL_RETURN_URL` → URLs Vercel

Render redeploy automático.

---

## 5. Smoke test pós-deploy (10 min)

Visite a URL Vercel e verifique:

- [ ] Landing/Login carrega sem erros no console do navegador
- [ ] `https://<backend>.onrender.com/health/ready` responde 200 com `{ status: 'ok', services: { ... } }`
- [ ] `https://<backend>.onrender.com/api/v1/segments` retorna os 4 segmentos
- [ ] **Signup completo**: criar tenant teste com email descartável (mailinator)
  - [ ] Recebe email de verificação (Resend)
  - [ ] Clica link → confirma email
  - [ ] Faz login → cai no Onboarding
  - [ ] Completa onboarding (segmento, marca, conector, templates, equipe)
  - [ ] Vê Dashboard com dados de demo
- [ ] Logout → Login admin (`ADMIN_DEFAULT_EMAIL`) → entra como super-admin
- [ ] Verifica `https://<backend>.onrender.com/api/v1/super-admin/tenants` lista o tenant que acabou de criar

---

## 6. Convite dos pilotos (10 min)

Para cada um dos 5-10 tenants piloto:

1. Mande email convidando para criar conta em `https://<vercel-url>.vercel.app/registrar`
2. Envie credenciais de Stripe **test mode** para teste de fluxo de pagamento (cartão `4242 4242 4242 4242`)
3. Configure canal de feedback: WhatsApp/Slack/email dedicado
4. Diga claramente:
   - É **Beta gratuito** — sem cobrança real
   - Bugs/feedback são bem-vindos
   - Dados podem ser apagados ao final do Beta (avise antes)

---

## 7. Monitoramento durante o Beta

### Logs em tempo real
- Backend: Render Dashboard → **Logs** (24h retention free)
- Frontend: Vercel Dashboard → **Deployments → Logs**

### Erros não-tratados
- Sentry recebe stack traces automaticamente (se `SENTRY_DSN` setado)

### Saúde de serviços
- Render dorme após 15 min sem request — **acordar via cron público** (UptimeRobot free, ping a cada 14 min em `/health/live`)
- Supabase free tem 500 MB — monitor em Supabase Dashboard
- Upstash free tem 10k req/dia — monitor em Upstash Dashboard

### Métricas de produto
- PostHog (já wired): events `auth_login`, `auth_register`, `tenant_onboarding_completed`
- Adicionar mais events conforme uso real (não construir contra hipóteses)

---

## 8. Rollback strategy

Se algo quebrar grave em produção:

1. **Render**: Dashboard → **Deploys → Rollback** ao deploy anterior (1-clique, ~30s)
2. **Vercel**: Dashboard → **Deployments → ⋯ → Promote to Production** ao deploy anterior
3. **Banco**: Supabase tem backup automático 7 dias — restore via SQL Editor

---

## 9. Próximos passos pós-Beta funcional

Quando você tiver 3-5 tenants ativos com dados reais:

| Prioridade | Item | Por quê |
|---|---|---|
| 🔴 1 | Alertas integrados no Dashboard de chegada | Admin entra e VÊ os problemas, não precisa caçar |
| 🟡 2 | CRM mínimo: Cadastro de Clientes + segmentação A/B/C | Destrava comércio/serviços |
| 🟡 3 | Contas a Receber | Fecha visão de caixa do CFO |
| 🟢 4 | Forecast IA: ruptura estoque + previsão vendas | Primeiro "wow" para upgrade Pro |
| 🟢 5 | Drill-down contextual | Clicar em "Top 5 clientes" → vendas filtradas pelo cliente |
| 🟢 6 | OEE + meta de produção | Diferencial para tenants industry |

Plus, em paralelo:
- Pentest externo (R$ 10-30k) — bloqueador antes do GA público
- DPIA + DPA com advogado (R$ 5-15k) — bloqueador Enterprise
- CNPJ + Stripe live mode KYC — quando primeiro tenant decidir pagar

---

## Conectar API Tiete Espumas (SGBR/BI) — 3 caminhos

Você quer testar o sistema com dados reais da Tiete Espumas. Boa notícia: o sistema já tem suporte completo. Escolha o caminho:

### Caminho A — Auto-seed via env vars no Render (recomendado para Beta)

Adicione 2 env vars no Render (além do checklist principal acima):

```bash
SGBR_API_URL=http://108.181.223.103:3007
SGBR_CREDENTIALS=iga:123456
SGBR_SEED_TENANT_ID=default     # opcional, default já é o usado
```

Após o deploy, no PRIMEIRO boot do backend, ele detecta que não há datasources cadastrados e roda `seedDefaultDataSources()` (em `back-end-gest-o/src/seedDataSources.ts`). Isso cria automaticamente **6 datasources** para o tenant `default`:

| Nome | Endpoint | É auth source? |
|------|----------|----------------|
| Vendas - Tiete Espumas | `/sgbrbi/vendas/analitico` | ✅ sim |
| Notas Fiscais - Tiete Espumas | `/sgbrbi/vendanfe/analitico` | não |
| Contas Pagas - Tiete Espumas | `/sgbrbi/contas/pagas` | não |
| Produção - Tiete Espumas | `/sgbrbi/produzido` | não |
| Estoque - Tiete Espumas | `/sgbrbi/estoque` | não |
| Compras - Tiete Espumas | `/sgbrbi/compras` | não |

Cada um vem pré-configurado com:
- `type: 'sgbr_bi'`
- `authMethod: 'jwt'`
- `loginEndpoint: '/sgbrbi/usuario/login'`
- `loginFieldUser: 'login'`
- `loginFieldPassword: 'senha'`
- `passwordMode: 'sha256'` (a senha vai pro SGBR já em hex SHA-256)
- `apiUrl: $SGBR_API_URL`
- `authCredentials: $SGBR_CREDENTIALS` (criptografado at-rest com AES-256-GCM via `IGA_SECRETS_KEY`)

Login no admin → Dashboard já recebe dados.

### Caminho B — UI manual em `/datasources`

Se preferir cadastrar pela tela (1 datasource por endpoint, ou 1 só com endpoints rotativos):

1. Login como admin
2. **Configurações → Fontes de Dados → Nova fonte**
3. Selecione preset **"SGBR BI"** (já preenche `loginEndpoint`, `loginFieldUser`, `loginFieldPassword`)
4. Preencha:
   - **Nome**: `Compras Tiete Espumas` (ou o que quiser)
   - **Tipo**: SGBR BI (já vem selecionado pelo preset)
   - **API URL**: `http://108.181.223.103:3007`
   - **Endpoint de login**: `/sgbrbi/usuario/login`
   - **Endpoint de dados**: `/sgbrbi/compras` (varia por tipo: `/sgbrbi/vendas/analitico`, `/sgbrbi/produzido`, `/sgbrbi/estoque`, `/sgbrbi/contas/pagas`, `/sgbrbi/vendanfe/analitico`)
   - **Login**: `iga`
   - **Senha**: `123456`
   - **Hash da senha**: **SHA-256** (importante — o SGBR exige SHA-256 hex no campo `senha`)
   - **Marcar "É fonte de auth"**: ✅ apenas no primeiro datasource (vendas). Os outros reusam o token.
5. Salvar → Testar conexão.
6. Repita para cada um dos 6 endpoints.

> Esse caminho é demorado (6 cadastros). Use o Caminho A em produção e este só se quiser entender/customizar campo a campo.

### Caminho C — Validar API standalone antes do deploy

Antes de mexer em qualquer infra, rode local:

```bash
cd back-end-gest-o
bash scripts/test-sgbr-tiete.sh
```

O script:
1. Faz hash SHA-256 da senha `123456`
2. POST em `/sgbrbi/usuario/login` com `{ login: "iga", senha: "<hash-256>" }`
3. Extrai o token JWT da resposta
4. Faz GET em cada um dos 6 endpoints com `Authorization: Bearer <token>`
5. Reporta status, tamanho da resposta e contagem aproximada de linhas

Se tudo retornar 200, o IGA Gestão **vai conectar sem precisar de mudança de código**. Se algum endpoint der 401/500, é problema na API SGBR (não no IGA).

> Variáveis customizáveis: `SGBR_API_URL`, `SGBR_LOGIN`, `SGBR_PASSWORD`. O script roda só com `bash` + `curl` + `openssl`. Recomendo `jq` instalado para pretty-print do JSON.

### O que verificar após o seed (Caminho A) rodar

Pelo painel `/datasources` ou via SQL:

```sql
SELECT id, name, type, status, last_checked_at, last_error, data_endpoint
FROM datasources
WHERE tenant_id = 'default'
ORDER BY name;
```

Esperado: 6 linhas com `status = 'active'` e `last_error IS NULL` após primeira chamada do warm cache (~12 min após boot) ou após você abrir alguma página que consuma os dados (Dashboard, Estoque, etc.).

### Troubleshooting Tiete Espumas

| Sintoma | Causa provável | Fix |
|---------|----------------|-----|
| Login retorna 401 | Senha não está em SHA-256 ou login errado | Confirme `passwordMode='sha256'` no datasource (UI ou SQL) |
| Login retorna timeout | API SGBR fora do ar ou firewall do Render | Rodar Caminho C local primeiro pra confirmar |
| Endpoint retorna 200 mas array vazio | Token expirou ou faltou parâmetro `dt_de`/`dt_ate` | NF e algumas rotas exigem range de data — ver script `test-sgbr-tiete.sh` |
| Dashboard fica sem dados após 5 min | Cache vazio + warm cache ainda não rodou | Esperar 12 min OU forçar via clique em qualquer page que consuma a fonte |
| `503` ao chamar `/api/proxy/data` | Backend Render dorme após 15min — primeira request leva 30-60s | UptimeRobot free fazendo ping a cada 14 min em `/health/live` resolve |

---

## Troubleshooting

### Backend não inicia, log diz "Configuração de produção incompleta"
Faltou alguma env var crítica. A mensagem lista exatamente qual. Setar no Render → redeploy.

### Migration falha no primeiro boot
Verifique `DATABASE_URL` no Render. Confirme que a string é Connection Pooler (porta `6543`), não Direct (5432).

### CORS errors no console do browser
`FRONTEND_URL` no Render está diferente da URL Vercel. Atualize e redeploy backend.

### Render dorme demais (response 30-60s no 1º request)
Plano free dorme após 15min. Solução: UptimeRobot free com ping a cada 14 min em `/health/live`.

### Stripe webhook 400 invalid signature
`STRIPE_WEBHOOK_SECRET` não bate com o do dashboard Stripe. Re-copie do **Signing secret** do endpoint específico (não da chave secreta da conta).

### Email não chega
1. Verificar log do Render — Resend logs aparecem no console
2. Verificar Resend Dashboard → **Logs**
3. Domínio do remetente em `PUBLIC_BASE_URL` precisa estar verificado no Resend (DNS) — para Beta pode usar `onboarding@resend.dev` (default sem verificação)
