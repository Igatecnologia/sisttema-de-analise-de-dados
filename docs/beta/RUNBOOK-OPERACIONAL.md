# Runbook operacional — Beta IGA Gestão

> Manual de operação diária durante o Beta. Tenha aberto no segundo monitor.

---

## Acessos rápidos

| Ferramenta | URL | O que fazer aqui |
|---|---|---|
| **Render** | dashboard.render.com | Status do backend, logs, restart manual |
| **Vercel** | vercel.com/dashboard | Deploys do frontend e landing |
| **Supabase** | supabase.com/dashboard | SQL Editor, métricas DB, backups |
| **Upstash** | console.upstash.com | Métricas Redis |
| **Resend** | resend.com/emails | Emails enviados, deliverability |
| **Sentry** | sentry.io | Errors em tempo real |
| **PostHog** | app.posthog.com | Eventos de uso |
| **UptimeRobot** | uptimerobot.com | Uptime histórico |
| **GitHub Actions** | github.com/[seu]/iga-gestao/actions | CI/CD + DB backups |

---

## Operações diárias (5 min/dia)

### Manhã (09h)
- [ ] Sentry: algum erro novo? — abre 1 minuto
- [ ] UptimeRobot: backend e landing 100% nas últimas 24h?
- [ ] Resend: emails do dia anterior foram entregues?
- [ ] WhatsApp Beta: alguma mensagem nova de cliente?

### Tarde (14h)
- [ ] PostHog: quantos `auth_login` nas últimas 24h? Se zero, algum cliente sumiu
- [ ] Supabase: tamanho do DB — % usado de 500MB

### Noite (18h)
- [ ] Responder tudo que ficou pendente

### Sexta (16h)
- [ ] Revisar feedback Beta da semana
- [ ] Decidir o que entra na próxima sprint
- [ ] Comunicar mudanças aos clientes Beta

---

## Comandos úteis

### Ver logs do backend em tempo real
```
Render dashboard → Service → Logs → Live tail
ou via CLI:
  render logs --service iga-gestao-api --tail
```

### Conectar no Postgres prod
```
DATABASE_URL="postgresql://postgres.<ref>:<senha>@aws-0-sa-east-1.pooler.supabase.com:6543/postgres" \
psql "$DATABASE_URL"

\dt                              # listar tabelas
SELECT count(*) FROM tenants;    # tenants ativos
SELECT slug, plan, status FROM tenants;
```

### Forçar backup manual
```
GitHub → Actions → DB Backup → "Run workflow"
```

### Restore de backup
```
1. GitHub Actions → último DB Backup → download artifact
2. Em local com pg_restore:
   pg_restore --clean --no-owner -d "$DATABASE_URL_DIRECT" backup.dump
```

### Reativar tenant suspenso
```sql
UPDATE tenants SET status = 'active' WHERE slug = 'NOME-CLIENTE';
```

### Ampliar limite de copilot mensal de um tenant
```sql
UPDATE subscriptions SET plan = 'pro' WHERE tenant_id = (
  SELECT id FROM tenants WHERE slug = 'NOME-CLIENTE'
);
```

### Ver auditoria de um usuário específico
```sql
SELECT created_at, action, resource, metadata_json
FROM audit_log
WHERE user_id = 'XXX'
ORDER BY created_at DESC
LIMIT 50;
```

### Verificar integridade do audit log (hash chain)
```
GET /audit/verify
→ retorna 200 se ok, 409 se chain quebrada (potencial tampering)
```

---

## Incidentes — o que fazer

### Cliente reporta "sistema lento"

1. Olha Sentry — tem timeout?
2. Render dashboard → Metrics → response time p95 dos últimos 10 min
3. Supabase → Database → CPU/Memory usage
4. Se for cold start: avisa cliente que primeiro hit do dia demora 30s
5. Se for sustentado: investiga query lenta no Supabase Query Performance

### Cliente reporta "não consigo logar"

1. Pede pra ele tentar `/forgot-password`
2. Resend → tem email enviado pra ele?
3. Sentry → há `login_failed` ou `login_blocked_locked` no userId dele?
4. Se locked: SQL `DELETE FROM login_failures WHERE email = 'X'` (tabela de lockout)
5. Se persistir: impersonate via `/super-admin` e cria nova senha

### "Dashboard tá vazio"

1. Datasource configurado? `/super-admin` → tenant → datasources
2. Connector tester retorna 200?
3. Sentry tem `proxy.error`?
4. Confirma com cliente se as credenciais do ERP ainda valem

### Backend caiu

1. UptimeRobot já avisou
2. Render dashboard → Service → Status
3. Se for 502/503: restart no Render (botão Manual Deploy)
4. Se persistir: roll back pro deploy anterior (Render mantém histórico)
5. Comunica clientes Beta no WhatsApp **antes** deles reclamarem

### Postgres atingiu 500MB (limit Supabase free)

1. Identifica tabelas grandes:
   ```sql
   SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
   FROM pg_catalog.pg_statio_user_tables
   ORDER BY pg_total_relation_size(relid) DESC
   LIMIT 10;
   ```
2. Provável: `audit_log` (hash chain mantém histórico)
3. Mitigação imediata: arquivar logs antigos
   ```sql
   DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '90 days';
   ```
   ⚠️ Quebra hash chain — só faça se realmente precisar
4. Solução real: upgrade Supabase Pro (R$ 125/mês) ou migrar pra Neon/RDS

### Vazamento de credencial (gravidade SEC-0)

1. Rotaciona **agora**: `IGA_SESSION_JWT_SECRET`, `IGA_SECRETS_KEY`
2. Revoga todas as sessões ativas:
   ```sql
   DELETE FROM sessions;
   DELETE FROM refresh_tokens;
   ```
3. Comunica clientes Beta — todos vão ter que logar de novo
4. Investiga via audit log o que foi acessado
5. Notifica ANPD em até 48h se PII foi exposta (LGPD Art. 48)

---

## Comunicação com clientes Beta

### Como enviar update mensal
- Newsletter curta (3 bullets) listando o que mudou no mês
- Sem hype, sem marketing — só fato
- Exemplo: "Setembro: corrigimos o bug de filtro do dashboard, adicionamos export PDF, resolvemos o lentidão do estoque crítico"

### Como anunciar manutenção programada
- 48h antes via WhatsApp: "Vamos fazer ajuste no banco sábado às 03h, sistema deve ficar 30 min off"
- Adiciona banner no app via env (`MAINTENANCE_BANNER=...` se tiver feature)

### Como anunciar bug crítico
- WhatsApp imediato: "Detectamos [problema] que afeta [escopo]. Fix saindo em [prazo]."
- Email follow-up com root cause analysis em até 7 dias

### Como pedir feedback recorrente
- Mensal: 3 perguntas curtas (ver `EMAIL-FEEDBACK-D7.md`)
- A cada 3 meses: NPS opcional

---

## Métricas que importam (atualize semanal)

| Métrica | Como medir | Alvo Beta |
|---|---|---|
| Tenants ativos | `SELECT count(*) FROM tenants WHERE status='active'` | 5 |
| Tenants ativos no último 7d | `SELECT count(DISTINCT tenant_id) FROM audit_log WHERE created_at > NOW() - INTERVAL '7 days'` | ≥3 |
| Erros únicos no Sentry/dia | Sentry filter "issues last 24h" | <5 |
| Latência p95 | Render metrics | <2s |
| Bugs reportados/semana | WhatsApp + email | tendência decrescente |
| Decisões tomadas com base no IGA | Pergunta no email D+7 | ≥2/5 |

---

## Quando subir do Beta para Pago

Sinais positivos (todos):
- 4+ dos 5 estão usando semanalmente
- Pelo menos 2 mencionaram "tomei decisão X com IGA"
- Pelo menos 1 perguntou "quanto custa quando virar pago?"
- Sentry < 5 erros únicos/semana
- Você não está apagando incêndio toda hora

Quando isso acontecer:
1. Comunica formalmente o fim do Beta com 30 dias de antecedência
2. Oferece preço Beta preferencial (ex: 50% off por 6 meses)
3. Pede review/depoimento em troca
4. Implementa Stripe + KYC + CNPJ
5. Liga `BILLING_GATE_DISABLED=0`
