# RoPA — Registro de Operações de Tratamento de Dados Pessoais

> **LGPD Art. 37** — todo controlador deve manter registro das operações de tratamento.
> **Versão**: 1.0
> **Data**: 2026-05-08
> **Última revisão**: 2026-05-08

## 1. Identificação

- **Controlador**: _[preencher razão social + CNPJ]_
- **DPO**: _[nome] — lgpd@igagestao.com.br_

## 2. Operações registradas

### Op-001 — Cadastro e autenticação de usuários

| Campo | Valor |
|---|---|
| Finalidade | Permitir acesso autenticado ao SaaS |
| Base legal | Art. 7º V — execução de contrato |
| Categorias de dados | Nome, email, hash de senha, MFA secret cifrado, IP/UA hasheados |
| Categorias de titulares | Administradores e usuários do tenant cliente |
| Sub-processadores | Render (hosting), Supabase (DB) |
| Transferência internacional | EUA — cláusulas contratuais padrão |
| Retenção | Enquanto a conta existir + 7 dias soft delete |
| Medidas de segurança | argon2id, MFA opcional, sessão httpOnly+Secure, RLS multi-tenant |

### Op-002 — Conexão com ERP do cliente (proxy)

| Campo | Valor |
|---|---|
| Finalidade | Buscar dados do ERP do cliente para exibir dashboards |
| Base legal | Art. 7º V — execução de contrato |
| Categorias de dados | Dados operacionais retornados pela API do ERP — pode incluir nome, CPF/CNPJ, valores financeiros de clientes finais |
| Categorias de titulares | Clientes finais do tenant (B2B2C) |
| Sub-processadores | ERP do próprio tenant (controlado pelo cliente) |
| Transferência internacional | Depende do ERP — geralmente Brasil |
| Retenção | Cache 5min em memória + Redis; nada persistido pelo IGA |
| Medidas de segurança | Credenciais ERP cifradas AES-256-GCM; SSRF protection; audit log |

### Op-003 — Comunicação transacional

| Campo | Valor |
|---|---|
| Finalidade | Enviar emails de verificação, convite, alertas, relatórios |
| Base legal | Art. 7º V — execução de contrato |
| Categorias de dados | Email destinatário, conteúdo da mensagem |
| Categorias de titulares | Usuários cadastrados |
| Sub-processadores | Resend |
| Transferência internacional | EUA — cláusulas contratuais padrão |
| Retenção | Sem retenção pelo IGA; Resend mantém logs por 30 dias |
| Medidas de segurança | API key Resend em env separada; SPF/DKIM no domínio (quando configurado) |

### Op-004 — Audit log

| Campo | Valor |
|---|---|
| Finalidade | Rastrear ações de segurança e atender obrigações regulatórias |
| Base legal | Art. 7º IX — legítimo interesse + Art. 7º II — obrigação legal |
| Categorias de dados | userId, tenantId, action, resource, metadata (sem PII de payload) |
| Categorias de titulares | Usuários do sistema |
| Sub-processadores | Supabase |
| Transferência internacional | EUA — cláusulas contratuais padrão |
| Retenção | Indefinido (com hash chain para integridade) |
| Medidas de segurança | Postgres `REVOKE UPDATE, DELETE`; SHA-256 hash chain; verify endpoint |

### Op-005 — Telemetria de erro (Sentry)

| Campo | Valor |
|---|---|
| Finalidade | Detectar e diagnosticar falhas no sistema |
| Base legal | Art. 7º IX — legítimo interesse |
| Categorias de dados | Stack trace, breadcrumbs, IP, browser; PII redactada via `beforeSend` |
| Categorias de titulares | Usuários ativos do sistema |
| Sub-processadores | Sentry (Functional Software, Inc.) |
| Transferência internacional | EUA — cláusulas contratuais padrão |
| Retenção | 90 dias |
| Medidas de segurança | DSN público; redact PII antes de enviar |

### Op-006 — Analytics de produto (PostHog)

| Campo | Valor |
|---|---|
| Finalidade | Medir uso e melhorar UX |
| Base legal | Art. 7º I — consentimento explícito (banner cookies) |
| Categorias de dados | userId hasheado, eventos de uso (sem conteúdo sensível) |
| Categorias de titulares | Usuários que aceitarem cookies analytics |
| Sub-processadores | PostHog Inc. |
| Transferência internacional | EUA — cláusulas contratuais padrão |
| Retenção | Configurável; default 1 ano |
| Medidas de segurança | `opt_out_tracking_by_default: true`; sem captura de input fields |

### Op-007 — Cobrança via Stripe (futuro / GA pago)

| Campo | Valor |
|---|---|
| Finalidade | Processar assinaturas e cobranças recorrentes |
| Base legal | Art. 7º V — execução de contrato |
| Categorias de dados | Nome titular, dados de cartão tokenizados, histórico de cobrança |
| Categorias de titulares | Administradores do tenant que ativarem billing |
| Sub-processadores | Stripe |
| Transferência internacional | EUA / Irlanda — cláusulas contratuais padrão |
| Retenção | 5 anos (obrigação fiscal) |
| Medidas de segurança | PCI-DSS (Stripe); IGA não armazena PAN; webhook signature |

### Op-008 — Copilot IA (Groq)

| Campo | Valor |
|---|---|
| Finalidade | Responder perguntas sobre dados do tenant |
| Base legal | Art. 7º V — execução de contrato |
| Categorias de dados | Prompt do usuário (pode conter PII se digitada); dados do tenant retornados pelas tools |
| Categorias de titulares | Usuários que utilizarem o Copilot |
| Sub-processadores | Groq Inc. |
| Transferência internacional | EUA — cláusulas contratuais padrão |
| Retenção | Conforme configuração de retenção do Copilot (default 30 dias) |
| Medidas de segurança | Aviso explícito na UI; disabled per-tenant possível; cleanup job; redaction (futuro) |

## 3. Revisões

| Data | Versão | Mudança | Aprovador |
|---|---|---|---|
| 2026-05-08 | 1.0 | Versão inicial | _[preencher]_ |

---

> RoPA deve ser atualizado em qualquer mudança: novo sub-processador, nova categoria de dado, mudança de retenção, novo escopo do tratamento.
