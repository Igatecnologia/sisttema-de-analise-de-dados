# DPIA — Data Protection Impact Assessment

> **Status**: rascunho preenchido. Revisar com advogado/DPO antes de assinar.
> **Versão**: 1.0
> **Data**: 2026-05-08
> **Próxima revisão**: 2027-05-08 (anual ou em mudanças significativas)

## 1. Identificação do controlador

- **Razão social**: _[preencher]_
- **CNPJ**: _[preencher]_
- **Endereço**: _[preencher]_
- **Encarregado (DPO)**: _[nome] — lgpd@igagestao.com.br_
- **Produto avaliado**: IGA Gestão — SaaS de business intelligence industrial
- **URL**: https://iga-gestao.vercel.app (Beta) / https://igagestao.com.br (futuro)

## 2. Descrição do tratamento

A plataforma IGA Gestão coleta e processa dados pessoais e operacionais para:

1. **Autenticação e gestão de conta** — identificar usuários únicos por tenant.
2. **Conexão com ERPs do cliente** — proxy autenticado que busca dados do ERP do cliente para exibir dashboards.
3. **Comunicação transacional** — emails de verificação, convites, alertas de segurança, relatórios agendados.
4. **Análise de uso (opt-in)** — métricas anônimas de produto (PostHog) e telemetria de erro (Sentry).
5. **Cobrança recorrente (futuro)** — quando o Beta migrar para GA pago via Stripe.

## 3. Dados pessoais coletados

| Categoria | Campos | Origem | Sensível? |
|---|---|---|---|
| Identificação | nome, email | usuário (cadastro) | Não |
| Acesso | senha (hash argon2id), MFA secret cifrado, backup codes hasheados | usuário | Crítico (criptografado at-rest) |
| Sessão | IP hasheado, User-Agent hasheado, timestamps | request HTTP | Pseudonimizado |
| Auditoria | ações realizadas, recurso afetado, metadata | sistema | Não |
| Operacional do ERP | qualquer dado retornado pela API do ERP do cliente — pode incluir nome de cliente final, CPF/CNPJ, valores financeiros | proxy | **Variável — depende do ERP** |
| Comunicação | conteúdo de mensagens enviadas ao Copilot IA | usuário | Pode conter PII |
| Pagamento (futuro) | nome do titular, dados de cartão tokenizados pela Stripe | Stripe | Crítico (não armazenamos cartão) |

## 4. Bases legais (LGPD Art. 7º)

| Atividade | Base legal | Justificativa |
|---|---|---|
| Cadastro e autenticação | Art. 7º V — execução de contrato | Necessário para fornecer o serviço |
| Conexão com ERPs do cliente | Art. 7º V — execução de contrato | O cliente solicita o serviço expressamente |
| Cobrança via Stripe | Art. 7º V — execução de contrato | Necessário para faturamento |
| Detecção de fraude/segurança | Art. 7º IX — legítimo interesse | Proteção da plataforma e dos demais clientes |
| Telemetria de erro (Sentry) | Art. 7º IX — legítimo interesse | Manutenção da disponibilidade |
| Analytics (PostHog) | Art. 7º I — consentimento | Banner de cookies opt-in |
| Marketing (futuro) | Art. 7º I — consentimento | Banner de cookies opt-in |

## 5. Compartilhamento e sub-processadores

Lista atualizada em https://iga-gestao.vercel.app/legal/sub-processors.

| Sub-processador | Finalidade | País | Base de transferência internacional |
|---|---|---|---|
| Render | Hospedagem aplicação | EUA | Cláusulas contratuais padrão (LGPD Art. 33 II) |
| Supabase | PostgreSQL gerenciado | EUA / Brasil (sa-east-1) | Cláusulas contratuais padrão |
| Upstash | Cache Redis | EUA | Cláusulas contratuais padrão |
| Vercel | CDN frontend | Global anycast | Cláusulas contratuais padrão |
| Resend | Envio de emails | EUA | Cláusulas contratuais padrão |
| Stripe (futuro) | Processamento de pagamento | EUA / Irlanda | Cláusulas contratuais padrão |
| Cloudflare (futuro) | DNS / WAF | Global anycast | Cláusulas contratuais padrão |
| Sentry | Telemetria de erro | EUA | Cláusulas contratuais padrão |
| Groq | Inferência LLM (Copilot) | EUA | Cláusulas contratuais padrão; opt-out por tenant disponível |
| PostHog | Analytics | EUA | Cláusulas contratuais padrão; opt-in obrigatório |

## 6. Retenção e eliminação

| Categoria | Retenção | Justificativa |
|---|---|---|
| Conta ativa | enquanto a assinatura existir | Execução do contrato |
| Conta excluída | 7 dias soft-delete + 30 dias backup | Janela de recuperação + ciclo de backup |
| Dados financeiros | 5 anos após emissão | Obrigação legal (LGPD Art. 7º §1º) |
| Audit log | indefinido (com hash chain) | Integridade e investigação de incidentes |
| Logs de aplicação | 30 dias | Operacional |
| Backups | 30 dias rotativo | Recuperação de desastre |
| Sessões | 8h após inatividade | Segurança |

Endpoints implementados (LGPD Art. 18):
- `GET /api/v1/lgpd/my-data` — direito de acesso
- `GET /api/v1/lgpd/export` — direito de portabilidade
- `POST /api/v1/lgpd/anonymize` — direito de anonimização (Art. 18 IV)
- `POST /api/v1/lgpd/erase` — direito de eliminação (Art. 18 VI)

SLA de resposta: **15 dias úteis** (recomendação ANPD).

## 7. Direitos do titular (LGPD Art. 18)

| Direito | Implementação |
|---|---|
| I — Confirmação | endpoint `/lgpd/my-data` |
| II — Acesso | endpoint `/lgpd/my-data` |
| III — Correção | tela `/configuracoes` (perfil do usuário) |
| IV — Anonimização | endpoint `/lgpd/anonymize` |
| V — Portabilidade | endpoint `/lgpd/export` (JSON estruturado) |
| VI — Eliminação | endpoint `/lgpd/erase` |
| VII — Compartilhamento | tabela em `/legal/sub-processors` |
| VIII — Negativa de consentimento | banner de cookies + opt-out PostHog |
| IX — Revogação | banner de cookies — efeito imediato |

Canal: **lgpd@igagestao.com.br**

## 8. Segurança aplicada

Controles documentados em `SECURITY-BASELINE.md`. Resumo:

- **Senhas**: argon2id (RFC 9106), MFA TOTP opcional, HIBP check, lockout adaptativo
- **Sessão**: JWT 8h em cookie HttpOnly+Secure+SameSite=Strict, refresh token com rotation
- **Transmissão**: HTTPS/TLS obrigatório, HSTS preload, Cloudflare DNSSEC (futuro)
- **Repouso**: criptografia at-rest (Supabase) + AES-256-GCM em segredos sensíveis (MFA secret, credenciais ERP)
- **Auditoria**: hash chain SHA-256 (Postgres `REVOKE UPDATE/DELETE`)
- **Multi-tenant**: Row Level Security com 5 cenários automatizados
- **Proxy**: validação SSRF (RFC1918, loopback, link-local, metadata cloud)
- **Backups**: pg_dump diário cifrado (artifact GitHub Actions)
- **CI/CD**: SAST (Semgrep OWASP), SCA (npm audit + Trivy), secret scan (gitleaks), SBOM (CycloneDX)
- **Headers**: CSP dinâmico multi-tenant, COOP, CORP, Reporting-Endpoints, HSTS

## 9. Riscos identificados e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Vazamento de credenciais ERP | Baixa | Alto | AES-256-GCM at-rest; chave em env separada; auditoria de acesso |
| Cross-tenant data leak | Baixa | Crítico | RLS Postgres + 5 cenários automatizados em CI |
| SSRF via proxy | Baixa | Alto | Validação RFC1918/loopback/metadata + safeUFetch wrapper |
| Credential stuffing | Média | Médio | HIBP check, lockout adaptativo, MFA opcional |
| PII em prompts Copilot | Média | Médio | Aviso na UI; futuro: redaction pré-envio |
| Vazamento via stack trace | Baixa | Médio | structuredLog com `redactSecrets`; Sentry `beforeSend` (pendente) |
| DPA não-assinado com vendor | Média | Médio | Lista mantida em `/legal/sub-processors`; checklist de onboarding |
| Funcionário acessar dados | Baixa | Alto | Sem console admin direto em prod; super-admin com audit log + impersonation com banner |

## 10. Notificação de incidentes (LGPD Art. 48)

Runbook em `INCIDENT-RESPONSE.md`. Resumo:

- **SEV-0** (vazamento de PII): notificar ANPD em 48h, comunicar titulares afetados
- **SEV-1** (comprometimento de credencial): revogar sessões, forçar reset, comunicar titular
- **SEV-2** (anomalia detectada): investigação 24h, post-mortem em 7 dias
- **SEV-3** (bug funcional): correção em sprint normal

Template de notificação ANPD em `docs/compliance/template-notificacao-anpd.md` (a criar).

## 11. Aprovação

| Papel | Nome | Assinatura | Data |
|---|---|---|---|
| Controlador | _[preencher]_ | _[ ]_ | _[ ]_ |
| DPO | _[preencher]_ | _[ ]_ | _[ ]_ |
| Tech Lead | _[preencher]_ | _[ ]_ | _[ ]_ |
| Advogado externo | _[preencher]_ | _[ ]_ | _[ ]_ |

---

> Este DPIA é um documento vivo. Revisar a cada mudança significativa: novo sub-processador, nova categoria de dado coletada, mudança de finalidade, incidente reportável.
