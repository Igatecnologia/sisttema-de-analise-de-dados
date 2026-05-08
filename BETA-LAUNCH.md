# Beta Launch — IGA Gestão

> **Status:** preparado, aguardando deploy.
> **Modelo:** Beta gratuito fechado, 5 empresas convidadas, sem cobrança.

---

## Em 1 frase

Está pronto pra rodar Beta com 5 empresas após executar `DEPLOY-FREE.md` (~1h) +
configurar email/WhatsApp (~30 min). Tudo o que dependia de código foi entregue.

---

## Documentos prontos

| Doc | Para quê |
|---|---|
| [`DEPLOY-FREE.md`](./DEPLOY-FREE.md) | Subir o app na Vercel + Render + Supabase + Upstash em 12 passos |
| [`docs/beta/TERMO-BETA.md`](./docs/beta/TERMO-BETA.md) | Termo de adesão Beta — aceite eletrônico via plataforma |
| [`docs/beta/EMAIL-CONVITE.md`](./docs/beta/EMAIL-CONVITE.md) | 3 versões de email de convite (curta, longa, LinkedIn DM) |
| [`docs/beta/EMAIL-BOAS-VINDAS.md`](./docs/beta/EMAIL-BOAS-VINDAS.md) | Email pós-aceite com próximos passos |
| [`docs/beta/EMAIL-FEEDBACK-D7.md`](./docs/beta/EMAIL-FEEDBACK-D7.md) | Pesquisa 3 perguntas após 7 dias |
| [`docs/beta/ONBOARDING-CLIENTE.md`](./docs/beta/ONBOARDING-CLIENTE.md) | Script de 30 min da reunião com cada cliente |
| [`docs/beta/RUNBOOK-OPERACIONAL.md`](./docs/beta/RUNBOOK-OPERACIONAL.md) | Operação diária + incidentes + comandos úteis |
| [`docs/compliance/DPIA.md`](./docs/compliance/DPIA.md) | LGPD — Avaliação de Impacto (revisar com advogado) |
| [`docs/compliance/RoPA.md`](./docs/compliance/RoPA.md) | LGPD Art. 37 — Registro de Operações de Tratamento |
| [`docs/compliance/DPA-template.md`](./docs/compliance/DPA-template.md) | Modelo de Acordo de Tratamento para Enterprise |
| [`PLANO-SAAS.md`](./PLANO-SAAS.md) | Plano completo (auditado — 218/687 items done) |
| [`PLANO-LANDING-PAGE.md`](./PLANO-LANDING-PAGE.md) | Plano original da landing — implementado |

---

## Sequência de lançamento (ordem recomendada)

### Dia -3: Preparação (~4h)

```
[ ] Executa DEPLOY-FREE.md inteiro (Render + Vercel + Supabase + Upstash + Resend)
[ ] /health/ready retorna 200 com postgres.ok=true
[ ] Login admin funciona em produção
[ ] Email de verificação chega
[ ] Atualiza WhatsApp no rodapé da landing e do app
[ ] Cria grupo WhatsApp "IGA Beta"
[ ] Sentry e PostHog ativos com eventos chegando
```

### Dia -2: Validação interna (~2h)

```
[ ] Cria tenant fictício "betateste"
[ ] Faz fluxo completo: registrar → verificar email → onboarding → dashboard
[ ] Convida segundo usuário fictício, valida email de convite
[ ] Conecta Custom REST API com endpoint de teste
[ ] Faz pergunta no Copilot, valida resposta
[ ] Exporta dados via /lgpd/export, valida ZIP
[ ] Apaga tenant teste, valida soft delete
```

### Dia -1: Identifica os 5

```
[ ] Lista 8-10 candidatos Beta (margem de segurança caso 3 não respondam)
[ ] Confirma com cada um o ERP usado (SGBR / Bling / Tiny / Omie / Custom REST / Excel)
[ ] Personaliza email de convite com [NOME], [EMPRESA], [ERP DELES]
[ ] Envia para os primeiros 3
```

### Dia 0: Lançamento gradual

```
[ ] Manhã: convida 1º cliente (o mais fácil — alguém que você conhece bem)
[ ] Acompanha em tempo real — Sentry, WhatsApp, logs
[ ] À tarde: se 1º deu certo, convida 2º
[ ] Noite: post-mortem do dia. Algo quebrou? Anota.
```

### Dia +1 a +3

```
[ ] Convida 3º, 4º, 5º conforme primeiros responderem bem
[ ] Reunião de onboarding 30 min com cada (script em ONBOARDING-CLIENTE.md)
```

### Dia +7

```
[ ] Envia email de feedback (template em EMAIL-FEEDBACK-D7.md)
[ ] Acompanha respostas
[ ] Compila top 3 dores e top 3 acertos
```

### Dia +30

```
[ ] Revê métricas (ver RUNBOOK-OPERACIONAL.md → métricas que importam)
[ ] Decide: continua Beta gratuito, vira Beta pago, ou pivota
```

---

## Endpoints prontos para o Beta

### Backend (já implementados)
- `POST /api/v1/auth/register` — auto-cadastro com tenant + admin + trial 14d
- `POST /api/v1/auth/login` — login com MFA opcional
- `POST /api/v1/auth/forgot-password` — reset de senha (timing-safe)
- `POST /api/v1/auth/invite` — convite para equipe
- `GET /api/v1/legal/terms-status` — verifica se precisa aceitar Termos
- `POST /api/v1/legal/accept-terms` — registra aceite versionado
- `GET /api/v1/lgpd/my-data` — direito de acesso
- `GET /api/v1/lgpd/export` — direito de portabilidade
- `POST /api/v1/lgpd/anonymize` — direito de anonimização
- `POST /api/v1/lgpd/erase` — direito de eliminação
- `GET /api/v1/super-admin/tenants` — listar tenants Beta
- `POST /api/v1/super-admin/impersonate` — impersonar tenant
- `GET /api/v1/super-admin/metrics` — MRR (zerado no Beta) + tenants ativos
- `POST /api/v1/leads` — captura lead Beta da landing **(novo)**
- `GET /api/v1/status` — status público com versão e uptime **(novo)**
- `GET /security/sbom.json` — SBOM CycloneDX público

### Frontend app (já implementado)
- Login + MFA + tour guiado + cookie consent
- Aceite versionado de Termos com modal blocker
- Super admin com impersonation
- Settings, billing, marketplace de connectors, webhooks
- Dashboard / Produção / Estoque / Financeiro / Vendas / Compras / Copilot
- LGPD self-service (`/seguranca/lgpd`)

### Landing page (já implementada)
- 12 seções com prints reais do app
- Form "Pedir convite Beta" integrado com `/api/v1/leads` **(novo)**
- Logo IGA real, ícones Lucide, animações magic
- SSG estático, 180 kB First Load JS

---

## O que NÃO está pronto (assumido como Beta-acceptable)

| Item | Por quê dispensa | Quando faz |
|---|---|---|
| Pentest externo | R$ 8-25k. Não tem retorno em Beta gratuito. | Antes do GA público |
| DPIA assinado por advogado | R$ 1.5-3k. Template está pronto. | Antes de cobrar |
| Termos revisados juridicamente | Idem. | Antes de cobrar |
| WAF Cloudflare Pro | R$ 100/mês. Risco baixo com 5 clientes. | Após 50+ tenants |
| SSO Enterprise (WorkOS) | R$ 50/conexão. Não pedem em Beta. | Quando 1 cliente Enterprise pedir |
| App nativo iOS/Android | Web responsivo cobre Beta. | Pós-validação de tração |
| Connectors Bling/Tiny/Omie OAuth real | Stub funciona via Custom REST. | Quando cliente Beta pedir |
| Status page externa (statuspage.io) | UptimeRobot público basta. | Após GA |

---

## Checklist final pré-convite

```
INFRA
[ ] App acessível em produção (URL pública funciona)
[ ] HTTPS válido (sem warning do navegador)
[ ] Health check verde (/health/ready)
[ ] Email transacional funcionando (teste com seu email)
[ ] Backup PG executou com sucesso pelo menos 1 vez
[ ] Sentry recebendo eventos
[ ] PostHog recebendo eventos

DADOS
[ ] Tenant default tem trial_ends_at futuro ou BILLING_GATE_DISABLED=1
[ ] Senha admin alterada da default
[ ] SUPER_ADMIN_EMAILS setado com seu email

SUPORTE
[ ] WhatsApp Beta criado e número atualizado no app/landing
[ ] Email lgpd@igagestao.com.br monitorado
[ ] Email suporte@igagestao.com.br monitorado
[ ] UptimeRobot configurado (5min ping)

JURÍDICO
[ ] Termo Beta tem versão atual no termsAcceptance service
[ ] CNPJ ativo (mesmo MEI) — opcional pra Beta gratuito mas profissional
[ ] CNPJ no rodapé do app

CLIENTES
[ ] Lista de 8-10 candidatos
[ ] ERP de cada um confirmado
[ ] Email de convite personalizado pra cada
[ ] 30 min agendado com cada um pra onboarding
```

---

## Quando algo der errado

Veja `docs/beta/RUNBOOK-OPERACIONAL.md` → seção "Incidentes — o que fazer".

Resposta padrão de incidente:

> *"Detectamos [X]. Estimativa de fix: [Y horas/dias]. Alternativa imediata enquanto isso: [Z]. Te atualizo em [tempo]."*

Honestidade > tentativa de esconder. Cliente Beta entende bug. Não entende sumiço.

---

## Boa sorte 🚀

Lembre-se: o Beta serve pra **descobrir o que você não sabe**. Se passar 30 dias e ninguém
reclamar de nada, ou ninguém tomou decisão com o IGA, alguma coisa está errada — provavelmente
não estão usando.

A pior métrica do Beta não é "bug encontrado" — é "ninguém abriu o sistema".
