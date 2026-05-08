# CONTINUE — handoff para próxima sessão

> Documento de retomada. Tudo que precisa para continuar exatamente de onde parou.

## Onde paramos

- **Repo:** https://github.com/Maykesantos98/gest-o-Analisededados.git
- **Branch:** `master` (sincronizada com `origin/master`)
- **Último commit:** `f537b05 test(e2e): adicionar 15 smokes SaaS + correcoes de auth/CSRF/tenant`
- **Working tree:** limpo no que importa; `apresentacao-iga.html` é local (gitignored).

### Estado de teste

- **Backend:** 47 vitest pass + 5 RLS skipped (sem DATABASE_URL) → 52 testes
- **E2E backend SaaS:** 15/15 smokes passando (`--project=api`)
- **E2E UI:** auth.setup OK; 4 testes legados (bi-reports, rbac-and-crud) com seletores obsoletos
- **Type-check:** limpo backend + frontend

### Sprints concluídas

- S0 ✅ S1 ✅ S2 ✅ S3 ✅ S4 ✅ S5 ✅ (100%) S7 ✅ S8 ✅
- SEC-1 ✅ 95% (1.4 Doppler e 1.7 file upload são operacional/sem feature)
- SEC-2 ✅ 90% (só falta 2.7 SSO Enterprise — paid)
- SEC-3 ⚠️ 30% (CORS dinâmico + security.txt feitos; falta SAST/DAST/CSP nonce/WAF)
- SEC-4 ⚠️ 40% (LGPD endpoints + cookie consent + IR runbook feitos; falta DPIA + pentest)

---

## Próximo passo recomendado: **caminho mínimo para 1º pagante (~4 semanas)**

Em ordem:

### 1. **S6 Deploy Cloud** (~2 sem) — operacional
- [ ] Conta Render (ou alternativa): Postgres gerenciado + Redis gerenciado
- [ ] Cloudflare em frente: WAF, SSL, DDoS, CDN
- [ ] Wildcard SSL para `*.igagestao.com.br`
- [ ] Sentry (error tracking) + uptime monitoring
- [ ] Backup PostgreSQL diário com restore testado
- [ ] CI/CD GitHub Actions: `lint → tsc → test → build → deploy` blue-green

**Variáveis a setar no painel Render:**
```
ADMIN_DEFAULT_EMAIL=admin@iga.com
ADMIN_DEFAULT_PASSWORD=...                  # ≥14 chars
IGA_SESSION_JWT_SECRET=...                  # openssl rand -hex 48
IGA_SECRETS_KEY=...                         # openssl rand -hex 32
DATABASE_URL=postgresql://...
IGA_STORAGE_DRIVER=postgres
REDIS_URL=redis://...
TURNSTILE_SECRET=...                        # opcional
STRIPE_SECRET_KEY=sk_test_...               # ou sk_live_
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
BILLING_SUCCESS_URL=https://app.../billing/sucesso
BILLING_CANCEL_URL=https://app.../billing/cancelado
SUPER_ADMIN_EMAILS=ceo@empresa.com
```

**Frontend `.env.production`:**
```
VITE_API_BASE_URL=https://api.igagestao.com.br
VITE_TURNSTILE_SITE_KEY=...
```

### 2. **SEC-4 essencial** (~1.5 sem)
- [ ] DPIA assinado (advogado externo R$ 1500-3000)
- [ ] DPA com Stripe + Cloudflare + Resend + Groq
- [ ] Termos de Uso revisados juridicamente (`/legal/termos` já tem stub)
- [ ] CNPJ ativo + canal `lgpd@igagestao.com.br`
- [ ] DPO designado (fracionado ~R$ 1500/mês)

### 3. **Pentest externo** (~1 sem) — **gate GA**
- [ ] Cotar Tempest, Conviso, Hackone (BR) — R$ 8-25k
- [ ] Escopo: web app (api + frontend) + auth
- [ ] Critério aceite: zero critical, zero high

### 4. **Beta Fechado** — convidar 5-10 tenants

---

## Como retomar o ambiente local

### Backend dev (porta 3001)

```bash
cd back-end-gest-o
PORT=3001 \
ADMIN_DEFAULT_EMAIL=admin@iga.com \
ADMIN_DEFAULT_PASSWORD='AdminTeste2026!' \
FRONTEND_URL=http://127.0.0.1:4173 \
BILLING_GATE_DISABLED=1 \
npm run dev
```

> Se a senha tiver <14 chars, o seedAdmin gera senha aleatória e grava em `data/FIRST_LOGIN.txt`.

### Frontend dev (porta 5173)

```bash
cd front-end-gest-o
npm run dev
```

### Rodar todos os testes

```bash
# Backend
cd back-end-gest-o && npm test

# E2E smoke SaaS (rápido — só HTTP, sem UI)
cd front-end-gest-o
CI=true E2E_ADMIN_EMAIL=admin@iga.com E2E_ADMIN_PASSWORD='AdminTeste2026!' \
npx playwright test --project=api

# E2E UI completa
CI=true E2E_ADMIN_EMAIL=admin@iga.com E2E_ADMIN_PASSWORD='AdminTeste2026!' \
npx playwright test --project=chromium
```

### Login admin local

```
Email: admin@iga.com
Senha: AdminTeste2026!
```

> Pré-condição: backend foi iniciado pela primeira vez com `ADMIN_DEFAULT_PASSWORD='AdminTeste2026!'` e o DB ainda existe.
> Se DB foi limpo, o admin será recriado com a senha do env.

---

## Pendências técnicas conhecidas

### Pequenas (1-2h cada)
- [x] **S5 T8** — `SettingsPage` para configurar empresa/equipe/integrações no perfil do tenant
- [x] **S5 LGPD export tenant** — `GET /api/v1/tenants/:id/export` (admin do tenant)
- [x] **Limites por plano** — middleware que conta users/datasources/copilot calls e bloqueia conforme plan
- [ ] **Atualizar testes E2E legados** — bi-reports.spec.ts e rbac-and-crud.spec.ts têm seletores obsoletos

### Médias (4-8h)
- [x] **S7 impersonation** — super-admin entra como tenant X com banner vermelho fixo + audit
- [ ] **OPS-3 a11y** — WCAG 2.2 AA audit + correções (Lighthouse a11y ≥ 95)
- [ ] **OPS-4 analytics** — PostHog tracking 30+ events + feature flags
- [ ] **Bling/Tiny/Omie OAuth real** — connectors hoje são stubs; precisam client_id/secret de cada

### Grandes (refactors >8h)
- [ ] **SEC-2.7 SSO Enterprise** — WorkOS/Clerk/Auth0 (R$ 50/conexão)
- [ ] **CSP com nonce** — substituir `unsafe-inline` em style-src
- [ ] **SAST/DAST/SCA no CI** — workflow `.github/workflows/security.yml` + tokens (Semgrep, Snyk, Trivy, gitleaks)
- [ ] **Refresh token: substituir** session JWT 8h por access 15min — hoje coexistem; refactor maior

---

## Pontos de atenção

1. **Senha em git público:** `e46252e:render.yaml` ainda tem `IgaGestao@2026!`. Rotacionar antes de deploy real.
2. **SQLite WAL no DB local:** ao matar backend, espere 3-5s antes de `rm data/iga.db*` (file locks).
3. **CORS dinâmico:** override regex via env `CORS_TENANT_DOMAIN_REGEX`. Default aceita `^https://[a-z0-9-]+\.igagestao\.com\.br$`.
4. **Stripe webhook:** registrado **antes** do `express.json()` em `app.ts` para preservar raw body (signature). Ao adicionar middleware global, manter ordem.
5. **`.env.e2e`:** está no `.gitignore` (intencional). Aponta para `http://127.0.0.1:3001` localmente.
6. **PORT_MAX no backend:** se a porta estiver ocupada, ele faz auto-shift para `PORT+20`. Em testes setei `PORT_MAX=PORT` para ficar fixo — em dev pode deixar default.
7. **`tsx watch` + porta ocupada:** ao salvar arquivo, tsx mata processo antigo mas porta pode ficar travada por ~2s — aguarde ou use `node dist/server.js` direto (build prod).

---

## Commits da maratona (referência)

```
f537b05 test(e2e): adicionar 15 smokes SaaS + correcoes de auth/CSRF/tenant
b34388f feat: completar S5 frontend + S7 super admin + S8 connectors + SEC-3/4 essenciais
0a56903 docs(plano): atualizar PLANO-SAAS.md com status real
eaad527 feat: MFA UI + Captcha + Refresh tokens + Billing minimo (Stripe)
36b2f9c feat(security): SEC-2.3 HIBP + 2.10 alerts + 2.8 history + 2.5 binding + 2.1 MFA + 1.8 RL + 1.2 argon2
b286552 feat(security): SEC-2.9 timing-safe + SEC-2.4 lockout + RLS coverage
5aef434 feat(security): SEC-1.3 audit log hash chain
3972874 fix(security): SEC-1.5 PII redaction + SEC-1.6 prototype pollution
7d00493 refactor(s3): desacoplar SGBR — connector pattern
d86739b fix(security): correções críticas multi-tenant — IDOR, JWT, SSRF
779fdd7 chore: sincronizar projeto completo com remoto
```

---

## Arquivos de referência

- `PLANO-SAAS.md` — plano completo com status atualizado por sprint
- `SECURITY-BASELINE.md` — controles de segurança implementados
- `INCIDENT-RESPONSE.md` — runbook de incidentes
- `apresentacao-iga.html` — pitch deck (gitignored, local)
- `back-end-gest-o/src/connectors/industryConnector.ts` — interface para novos connectors
- `back-end-gest-o/src/services/subscriptionStore.ts` — modelo de billing
- `back-end-gest-o/src/middleware/subscriptionGate.ts` — feature gating 402
- `back-end-gest-o/src/services/mfa.ts` — TOTP + backup codes
- `back-end-gest-o/src/services/refreshTokenStore.ts` — rotation com reuse detection
- `front-end-gest-o/tests/e2e/smoke-saas.spec.ts` — 15 testes do SaaS

---

## Contatos / decisões pendentes

- [ ] Definir **DPO** (interno fracionado vs externo)
- [ ] Definir **provedor pentest** (Tempest vs Conviso)
- [ ] Definir **provedor cloud** (Render vs Hetzner vs Railway)
- [ ] Definir **CRM** (HubSpot Free vs Pipedrive)
- [ ] Definir **error tracking** (Sentry self-hosted vs cloud)
- [ ] Definir **DB managed** (Supabase vs Neon vs Render Postgres)
