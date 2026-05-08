# Deploy Free — IGA Gestão (Beta Fechado)

Guia passo-a-passo para colocar o SaaS no ar **gastando R$ 0**, usando free tiers de Vercel + Render + Supabase + Upstash + Resend + Sentry + PostHog.

> **Modelo**: Beta gratuito (5–10 amigos, sem cobrar). Quando for cobrar, será necessário CNPJ + Stripe KYC + advogado.

---

## Arquitetura final

```
┌────────────────┐  HTTPS   ┌─────────────────────┐  pg+SSL   ┌───────────────┐
│  Vercel (free) │ ───────▶ │  Render free Node   │ ────────▶ │ Supabase free │
│  Vite SPA      │          │  Express API        │           │ Postgres 0.5G │
│  ~50ms loads   │  CORS    │  dorme após 15min   │  rediss   ├───────────────┤
└────────────────┘ ◀───────▶│  cold start ~30s    │ ────────▶ │ Upstash free  │
       ▲                    └─────────────────────┘           │ Redis 10k/dia │
       │                              │                       └───────────────┘
       │                              ├──▶ Resend (3k email/mês)
   Cloudflare DNS                     ├──▶ Sentry (5k events/mês)
   (DNS + SSL grátis)                 └──▶ PostHog Cloud (1M events/mês)
```

**Custo mensal**: R$ 0.

**Limitações**:
- Render free **dorme após 15min** sem requisições. Primeiro hit acorda em ~30s. Pra Beta interno, é aceitável.
- Supabase free **pausa o projeto após 1 semana** sem queries. Mantenha um cron pingando (UptimeRobot já faz isso).
- Postgres free 500 MB → caberão ~5–10 tenants confortáveis.

---

## Passo 1 — Criar contas (15 min)

Crie todas com o **mesmo email** (idealmente um Gmail só pro IGA — facilita gestão):

| Serviço | URL | O que pegar |
|---|---|---|
| GitHub | já tem | repo já está em `Maykesantos98/gest-o-Analisededados` |
| Render | https://render.com | login com GitHub |
| Vercel | https://vercel.com | login com GitHub |
| Supabase | https://supabase.com | login com GitHub |
| Upstash | https://upstash.com | login com GitHub |
| Resend | https://resend.com | login com GitHub |
| Sentry | https://sentry.io | sign up free |
| PostHog Cloud | https://posthog.com | sign up free |
| UptimeRobot | https://uptimerobot.com | sign up free |
| Cloudflare | https://cloudflare.com | só se for usar domínio próprio |

---

## Passo 2 — Supabase (Postgres) — 5 min

1. **New Project** → nome `iga-gestao` → senha forte (anote!) → região `South America (São Paulo)`.
2. Aguardar provisionar (~2min).
3. **Project Settings → Database**:
   - Copiar **Connection String** (Transaction pooler, porta 6543) — vai virar `DATABASE_URL` no Render.
   - Copiar **Direct Connection** (porta 5432) — vai virar `DATABASE_URL_BACKUP` no GitHub Secrets (pra `pg_dump`).

### Aplicar migrations

Tem 2 caminhos:

**A) Deixar o backend criar tudo no primeiro boot** (mais simples):
- O backend já tem migrations idempotentes (`db/postgresMigrations.ts`).
- Quando subir o Render service com `IGA_STORAGE_DRIVER=postgres`, ele aplica tudo.

**B) Aplicar localmente antes de subir**:
```bash
cd back-end-gest-o
DATABASE_URL="postgresql://postgres.<ref>:<senha>@aws-0-sa-east-1.pooler.supabase.com:6543/postgres" \
POSTGRES_SSL=1 \
node --import tsx src/db/migratePostgres.ts
```

Vou recomendar **A** — é o caminho oficial e já está testado.

---

## Passo 3 — Upstash Redis — 3 min

1. **Create Database** → `iga-redis` → região `sa-east-1` (ou US East se SA não estiver disponível) → tipo **Regional** (não Global — Global é pago).
2. Eviction policy: `noeviction`.
3. Após criar, **Details → REST API/Endpoint**: copiar `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`. Mas o backend usa Redis nativo (não REST), então:
4. Copiar **Connection string** padrão: `rediss://default:<senha>@<host>.upstash.io:6379`. Esse é o `REDIS_URL`.

> **Nota**: Upstash free tier suporta TLS (`rediss://`) — o backend já está configurado.

---

## Passo 4 — Resend (Email) — 3 min

1. **API Keys → Create** → nome `iga-prod` → escopo `Sending access` → copiar `RESEND_API_KEY`.
2. **Domains** — pular por enquanto (vai usar `onboarding@resend.dev` como sender via env `MAIL_FROM`).
   - Quando for ter domínio próprio, adicionar e validar SPF/DKIM aqui.

---

## Passo 5 — Render (Backend) — 10 min

1. **New + → Blueprint** → conectar repo GitHub `Maykesantos98/gest-o-Analisededados`.
2. Render lê o `render.yaml` e cria o service `iga-gestao-api`.
3. Aguardar build (~5min).
4. Quando aparecer "Pending env vars", clicar e preencher (em **Environment**):

```
DATABASE_URL              = <connection string Supabase pooler 6543>
REDIS_URL                 = <connection string Upstash rediss://>
ADMIN_DEFAULT_EMAIL       = seu-email@dominio.com
ADMIN_DEFAULT_PASSWORD    = <senha forte com 14+ chars — anote, é o login admin>
IGA_SESSION_JWT_SECRET    = <openssl rand -hex 48 — gerar local>
IGA_SECRETS_KEY           = <openssl rand -hex 32 — gerar local>
SUPER_ADMIN_EMAILS        = seu-email@dominio.com
FRONTEND_URL              = https://iga-gestao.vercel.app   (preencher após Passo 6)
PUBLIC_BASE_URL           = https://iga-gestao.vercel.app
RESEND_API_KEY            = <do Passo 4>
TURNSTILE_SECRET          = (deixe vazio por enquanto)
SENTRY_DSN                = (preencher no Passo 8)
```

Gerar secrets localmente (Git Bash ou WSL):
```bash
openssl rand -hex 48   # IGA_SESSION_JWT_SECRET
openssl rand -hex 32   # IGA_SECRETS_KEY
```

5. **Save Changes** → Render reinicia o service automaticamente.
6. Após ~2min, abrir `https://iga-gestao-api.onrender.com/health/ready`. Deve retornar JSON com `status: "ok"` e `storage.postgres.ok: true`.

> **Cold start**: o primeiro `/health/ready` pode demorar ~30s. Normal.

---

## Passo 6 — Vercel (Frontend) — 8 min

1. **Add New → Project** → import repo `Maykesantos98/gest-o-Analisededados`.
2. **Root Directory**: `front-end-gest-o`
3. **Framework Preset**: Vite (auto-detectado)
4. **Build Command**: `npm run build` (default)
5. **Output Directory**: `dist`
6. **Environment Variables** (em Production):

```
VITE_API_BASE_URL    = https://iga-gestao-api.onrender.com
VITE_USE_MOCKS       = false
VITE_HTTP_TIMEOUT_MS = 60000
VITE_SENTRY_DSN      = (preencher no Passo 8)
VITE_POSTHOG_KEY     = (preencher no Passo 9)
VITE_POSTHOG_HOST    = https://app.posthog.com
```

7. **Deploy**. Aguardar ~2min.
8. Pegar a URL final: `https://iga-gestao.vercel.app` (Vercel pode dar um sufixo random — você pode renomear em **Settings → Domains**).
9. **Voltar ao Render** e atualizar `FRONTEND_URL` e `PUBLIC_BASE_URL` com a URL real do Vercel. Save → reinicia.

---

## Passo 7 — Testar end-to-end (5 min)

1. Abrir o Vercel URL no navegador.
2. Login: usar `ADMIN_DEFAULT_EMAIL` / `ADMIN_DEFAULT_PASSWORD` definidos no Passo 5.
3. Verificar que a tela de login funciona, dashboard carrega, e CSP/CORS não bloqueiam.
4. Abrir DevTools → Network → conferir que requests vão para `iga-gestao-api.onrender.com` e retornam 200.

Se o primeiro hit demorar 30s e depois ficar rápido, está tudo certo (Render free dormindo).

### Criar primeiro tenant cliente

1. Logar como admin.
2. Ir em `/super-admin` → criar tenant.
3. Criar usuário admin do tenant via `/usuarios`.
4. Compartilhar `https://iga-gestao.vercel.app/login?tenant=<slug>` com o cliente Beta.

---

## Passo 8 — Sentry (Error Tracking) — 5 min

1. **Create Project** → React → nome `iga-frontend` → criar.
2. Copiar o **DSN** que aparece (formato `https://<key>@o<org>.ingest.sentry.io/<project>`).
3. Settings do projeto → Performance → habilitar.
4. Voltar ao **Vercel** e adicionar `VITE_SENTRY_DSN=<dsn>`. Redeploy.
5. Criar um segundo projeto Sentry para Node `iga-backend` (opcional, se quiser tracking server-side).
6. No Render, adicionar `SENTRY_DSN=<dsn-backend>`.

Free tier: **5k events/mês** — sobra muito pra Beta.

---

## Passo 9 — PostHog (Analytics) — 5 min

1. **New Project** → nome `iga-gestao` → free cloud.
2. Copiar **Project API Key** (formato `phc_...`).
3. Adicionar no Vercel:
   ```
   VITE_POSTHOG_KEY=phc_...
   VITE_POSTHOG_HOST=https://app.posthog.com
   ```
4. Redeploy.

Eventos que já estão wirados no código (`auth_login`, `auth_register`, `terms_accepted`, `mfa_enabled`) vão começar a aparecer no dashboard PostHog em ~1min após primeiro uso.

Free tier: **1M events/mês** — sobra muito.

---

## Passo 10 — UptimeRobot (Keep-alive + monitoring) — 3 min

Render free dorme após 15min, e Supabase pausa após 1 semana. UptimeRobot resolve os dois pingando periodicamente.

1. **Add New Monitor**:
   - Type: HTTP(s)
   - URL: `https://iga-gestao-api.onrender.com/health/live`
   - Interval: **5 minutes** (free tier mínimo)
2. **Notifications**: adicionar seu email — alerta se cair.
3. Adicionar segundo monitor para o frontend: `https://iga-gestao.vercel.app`.
4. Free tier: **50 monitors com intervalo 5min**.

> Render acorda ao receber HTTP, então ping de 5min mantém ele perpetuamente acordado durante o dia. Pode dormir de madrugada (UptimeRobot continua pingando).

---

## Passo 11 — Backup automatizado — 2 min

Já tem workflow `.github/workflows/db-backup.yml` no repo. Para ativar:

1. GitHub repo → **Settings → Secrets and variables → Actions → New secret**:
   - Nome: `DATABASE_URL_BACKUP`
   - Valor: connection string **direct** do Supabase (porta **5432**, não 6543) — pg_dump não funciona via pooler.
   - Formato: `postgresql://postgres:<senha>@db.<ref>.supabase.co:5432/postgres`
2. **Actions** → executar `DB Backup` manualmente uma vez para validar.
3. A partir daí roda diariamente às 03:00 UTC. Backups ficam como artifacts no GitHub por 30 dias.

> Para restaurar: baixar o `.dump`, rodar `pg_restore --clean --no-owner -d "$DATABASE_URL" backup.dump`.

---

## Passo 12 — Cloudflare Turnstile (anti-bot, opcional) — 3 min

Free tier ilimitado.

1. https://dash.cloudflare.com/?to=/:account/turnstile → **Add site** → nome `iga-gestao` → modo **Managed** → adicionar domínios `*.vercel.app` e `*.onrender.com`.
2. Copiar **Site Key** (público) e **Secret Key**.
3. Vercel: `VITE_TURNSTILE_SITE_KEY=<site-key>` → redeploy.
4. Render: `TURNSTILE_SECRET=<secret>` → restart.

---

## Pronto — Checklist final

- [ ] Backend Render responde em `/health/ready` com `status: ok`
- [ ] Frontend Vercel carrega tela de login
- [ ] Login admin funciona
- [ ] Dashboard carrega dados
- [ ] CORS não bloqueia (DevTools → Network sem erros)
- [ ] CSP não bloqueia (Console sem violations)
- [ ] UptimeRobot configurado (mantém Render acordado)
- [ ] DB backup workflow rodou ao menos 1 vez
- [ ] Sentry recebendo eventos (testar com erro proposital)
- [ ] PostHog recebendo `auth_login` (fazer um login)

---

## Quando algo não funcionar

| Sintoma | Causa provável | Fix |
|---|---|---|
| `/health/ready` retorna 503 | Postgres não conectou | Conferir `DATABASE_URL` (deve ser pooler 6543, com SSL) e `POSTGRES_SSL=1` |
| Frontend vê CORS error | `FRONTEND_URL` no Render diferente da URL Vercel | Atualizar e fazer Render restart |
| Login retorna "CSRF token" | Cookie não está sendo enviado | Verificar que frontend está em HTTPS (Vercel sempre é) e backend `trust proxy` está ativo (já está em prod) |
| Render fica em cold start eterno | Free tier esgotou as 750h/mês | Esperar fim do mês ou upgrade ($7/mês) |
| Supabase pausou | Sem queries por 7 dias | Reativar no dashboard + verificar UptimeRobot pingando |
| Emails não chegam | Resend sem domínio verificado | Sender deve ser `onboarding@resend.dev` ou domínio verificado |

---

## Próximo passo (quando validar mercado)

| Quando | O quê | Custo |
|---|---|---|
| 5+ tenants ativos | Comprar domínio `igagestao.com.br` + Cloudflare DNS | R$ 40/ano |
| 10+ tenants | Render Starter ($7/mês) — sem cold start | R$ 35/mês |
| Antes de cobrar | DPIA + Termos com advogado | R$ 1.5–3k one-shot |
| Antes de GA público | Pentest externo | R$ 8–25k one-shot |
| Antes de cobrar | Stripe KYC + CNPJ ativo | MEI R$ 72/mês |
