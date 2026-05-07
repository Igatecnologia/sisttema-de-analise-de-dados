# INCIDENT-RESPONSE.md — IGA Gestao

Runbook de resposta a incidentes de seguranca/disponibilidade.

## Severidade

| Nivel | Definicao | SLA Resposta | Comunicacao |
|---|---|---|---|
| **SEV-0** | Vazamento confirmado de PII (CPF, senhas, dados de cliente) ou downtime total | 15 min | Cliente afetado em 4h, ANPD em 48h (LGPD Art. 48), publico em 7d |
| **SEV-1** | Vetor critico ativo (RCE, SSRF explorado, credential stuffing massivo) | 30 min | Cliente afetado em 24h |
| **SEV-2** | Brecha contida ou risco alto sem evidencia de exploit (audit chain quebrada, login_failed em volume anomalo) | 2h | Equipe interna |
| **SEV-3** | Bug menor, falha pontual de feature | 24h | Apenas ticket |

## On-call

- Primary: [definir nome+telefone]
- Secondary: [definir]
- Manager escalation: [definir]

## Triagem inicial (qualquer SEV)

1. **Confirme**: o evento eh real? Reproducao em staging ou logs.
2. **Contenha**: revogue sessions/tokens afetados; suspenda tenant via super-admin se necessario; bloqueie IP no Cloudflare.
3. **Preserve evidencia**: snapshot de `audit_log`, exports de Sentry, copia dos logs estruturados ate +24h apos descoberta.
4. **Comunique** conforme tabela acima.

## Detection rules (manuais ate SIEM rodar)

- 10+ `login_failed` em 5min para mesma conta -> SEV-2 (login_blocked_locked vai disparar)
- 50+ `login_failed` cross-tenant em 1min -> SEV-1 (credential stuffing)
- `refresh_reuse_detected` -> SEV-1 (sessao roubada — revogou familia automaticamente)
- `audit_log.verify` retornando 409 -> **SEV-0** (tampering — preserve banco imediatamente)
- Pico anomalo de `proxy_blocked_ssrf` -> SEV-2 (alguem testando SSRF)
- 5xx > 5% por 10min -> SEV-2

## Playbooks especificos

### Vazamento de credenciais de banco (SEV-0)
1. Trocar `DATABASE_URL` no Render/AWS imediatamente
2. Forcar `revokeAllUserSessions` para todos os usuarios afetados
3. Rotacionar `IGA_SESSION_JWT_SECRET` e `IGA_SECRETS_KEY`
4. Notificar ANPD em 48h via canal oficial
5. Email para clientes em 4h com escopo + acoes recomendadas
6. Post-mortem em 7 dias

### Audit chain quebrada (SEV-0)
1. **Nao escrever mais nada em audit_log** (manualmente revogar `INSERT` no Postgres se necessario)
2. Usar `GET /audit/verify` para identificar `brokenAt` (id + index + reason)
3. Snapshot da tabela completa via `pg_dump --table=audit_log`
4. Investigar: foi tampering humano (acesso indevido ao DB) ou bug de codigo?
5. Se tampering: SEV-0 publico; se bug: corrige e re-emite linhas afetadas com novo prefixo

### Credential stuffing detectado (SEV-1)
1. Habilitar Cloudflare Bot Fight Mode em modo agressivo
2. Aumentar threshold do account_lockout temporariamente (3 falhas em vez de 5)
3. Email de alerta a usuarios cuja conta teve tentativa
4. Block automatic IPs no `ALLOW_PRIVATE_HOSTS` reverso (deny list — feature futura)

### MFA reset (suporte)
1. Confirmar identidade do user por video chamada
2. Validar 1 backup code remanescente OU consultar email + ultimo login + dados financeiros
3. Em caso negativo: pedir documento foto + selfie; aprovar manualmente
4. Executar `disableMfa(userId)` direto no banco com audit explicito

### Tenant suspension (abuse)
1. Identificar abuse: scraping, spam, violacao de termos
2. `POST /api/v1/super-admin/tenants/:id/suspend`
3. Email ao admin do tenant explicando motivo
4. SLA: 7 dias para apelacao antes de hard delete

## Pos-incident

Para todo SEV-0/1/2:
- Post-mortem em 7 dias com:
  - Timeline (deteccao, contenção, recuperacao)
  - Causa raiz (5 whys)
  - Action items com owners e prazos
  - Mudancas em runbook se aplicavel
- Compartilhar com cliente afetado (resumo executivo)
- Tabletop exercise trimestral testando este runbook

## Contatos externos

- ANPD: incidente@anpd.gov.br | 0800 285 7676
- Cloudflare Enterprise support: [tier]
- Stripe: dashboard.stripe.com/support
- Render/AWS: ticket via console

## Chaves PGP

[Adicionar quando configurar /.well-known/pgp-key.txt]
