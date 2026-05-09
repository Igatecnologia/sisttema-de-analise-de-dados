# SECURITY-BASELINE.md — IGA Gestao

Documento de referencia para o estado atual dos controles de seguranca implementados.
Atualizado em 2026-05-07.

## Identidade e autenticacao

- **Hash de senha**: argon2id (m=64MB, t=3, p=4) com graceful migration de scrypt v2/v1 no proximo login
- **Sessao**: JWT HS256 8h em cookie HttpOnly + Secure + SameSite=Strict; tenantId obrigatorio; UA family tracking
- **Refresh token**: 7d com rotation + reuse detection (revoga familia em hijack); endpoint `/auth/refresh`
- **MFA/TOTP**: opcional com QR code, 10 backup codes hasheados; segredo cifrado AES-256-GCM
- **Account lockout**: 5 falhas/10min -> 30min lock; 3 lockouts/24h -> exige reset (chave por email+tenant)
- **Pwned password (HIBP)**: k-anonymity, bloqueia se count >= 100
- **Captcha (Turnstile)**: aplicado em /login, /register, /forgot-password
- **Forgot password timing-safe**: baseline 600ms; resposta generica
- **Login alerts**: email em novo dispositivo, mudanca de senha, MFA toggle

## Multi-tenant

- **Row Level Security** (Postgres): FORCE em users, sessions, datasources, alerts, copilot_messages, scheduled_reports, audit_log, auth_action_tokens, tenant_onboarding
- **Politicas**: `tenant_id = current_setting('app.current_tenant_id')`; WITH CHECK em INSERT/UPDATE
- **Defense-in-depth**: `readAllForTenant` + `findUserByIdForTenantAsync` em storage; `selectDataSource` filtra
- **Testes**: 5 cenarios automatizados (read/insert WITH CHECK/update/delete/cross-table)

## Proxy e SSRF

- **Validacao de URL**: scheme http(s) only, blocklist RFC1918 + loopback + link-local + CGNAT 100.64/10 + IPv6 privado + metadata cloud + hostnames sentinela
- **Wrapper `safeUFetch`**: validacao runtime antes de cada fetch externo (8 sites)
- **`selectDataSource`** rejeita datasources com URL ruim (defense-in-depth)
- **Override controlado**: env `ALLOW_PRIVATE_HOSTS` (CSV) — uso apenas em dev

## Audit log

- **Hash chain SHA-256** (`prev_hash` + `row_hash` com canonical JSON)
- **Atomicidade**: SQLite via `db.transaction`; Postgres via `pg_advisory_xact_lock('iga_audit_chain')`
- **Anti-tamper**: Postgres REVOKE UPDATE/DELETE em audit_log para `iga_app`
- **Verificacao**: `GET /audit/verify` recalcula chain e retorna 409 com `brokenAt` em mismatch

## Input e logs

- **Body size por rota**: auth 4KB, copilot 32KB, global 1MB
- **Prototype pollution guard**: bloqueia `__proto__`, `constructor`, `prototype` em qualquer profundidade
- **Validacao Zod**: aplicado nos endpoints publicos (login, register, MFA, billing, etc)
- **PII redaction**: `utils/redactSecrets` recursivo + `utils/piiMask` (CPF/CNPJ/email/telefone/cartao); aplicado em `services/structuredLog`

## Rate limiting

- **`rate-limit-redis`** quando `REDIS_URL` setado; fallback memory
- **Limiters**: auth/login (20/15min), change-password (5/h), copilot (20/min/user), datasources test (10/min), proxy (60/min), users:create (20/h)
- **Tenant rate limit**: middleware separado para limitar por tenant

## Headers e CORS

- **Helmet**: HSTS 1y + preload, referrer-policy strict-origin-when-cross-origin
- **CSP dinamico**: `connect-src` montado por connector do tenant (sgbr -> *.sgbrbi.com.br, bling -> *.bling.com.br, etc)
- **Permissions-Policy**: camera/microphone/geolocation/payment desabilitados
- **CORS dinamico** (SEC-3.5): aceita `FRONTEND_URL` + regex `^https://[a-z0-9-]+\.igagestao\.com\.br$` para subdomains tenant

## Privacidade (LGPD)

- **Endpoints**: `/lgpd/my-data`, `/lgpd/export`, `/lgpd/anonymize`, `/lgpd/erase`
- **Cookie consent**: banner com 3 categorias (essential/analytics/marketing); decisao versionada em localStorage
- **Paginas legais**: /legal/privacidade, /legal/termos, /legal/cookies
- **Bases legais**: execucao de contrato + legitimo interesse + consentimento documentados

## Disclosure

- `/.well-known/security.txt` (RFC 9116)
- `/security/policy` — politica de divulgacao responsavel
- `/security` — pagina publica com features

## Endpoints admin

- `GET /audit/verify` — recalcula hash chain
- `GET /api/v1/super-admin/tenants` — lista cross-tenant (gated por `SUPER_ADMIN_EMAILS`)
- `POST /api/v1/super-admin/tenants/:id/{suspend,activate}`
- `GET /api/v1/super-admin/metrics` — MRR, ativos, em trial, suspensos

## Pendente (SEC-3 e SEC-4 completos)

- SAST/DAST/SCA no CI (Semgrep, Snyk, OWASP ZAP, Trivy, gitleaks)
- SBOM CycloneDX por release
- CSP com nonce (substituir `unsafe-inline` em style-src)
- Doppler/Vault para secrets management
- File upload security (Multer + magic bytes + sanitize SVG) — necessario quando feature chegar
- WAF Cloudflare (Bot Fight, OWASP CRS, geo-block)
- DPIA + DPO + RoPA formal
- Pentest externo (R$ 8-25k, gate de GA)
- SIEM + detection rules (Datadog/Loki + PagerDuty)
- Backups encrypted at rest + cross-region + Object Lock
- SSO Enterprise (SAML/OIDC via WorkOS/Auth0)
- Bug bounty publico (Hall of Fame -> HackerOne pos-GA)

## Variaveis de ambiente sensiveis

```
IGA_SESSION_JWT_SECRET   # 48 bytes hex (openssl rand -hex 48)
IGA_SECRETS_KEY          # 32 bytes hex (openssl rand -hex 32) — AES-256-GCM
ADMIN_DEFAULT_PASSWORD   # >= 14 chars
TURNSTILE_SECRET         # do Cloudflare
STRIPE_SECRET_KEY        # sk_live_... ou sk_test_...
STRIPE_WEBHOOK_SECRET    # whsec_... do Stripe Dashboard
SUPER_ADMIN_EMAILS       # CSV (ex: ceo@empresa.com,seguranca@empresa.com)
SECURITY_CONTACT_EMAIL   # default security@igagestao.com.br
HIBP_DISABLED=1          # em air-gapped
```

## Variaveis frontend

```
VITE_TURNSTILE_SITE_KEY  # public key do Cloudflare Turnstile
```
