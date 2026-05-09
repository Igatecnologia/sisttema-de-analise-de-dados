---
name: iga-multi-tenant
description: Multi-tenant SaaS com RLS PostgreSQL + 4 segmentos (industry/commerce/services/distribution). Use SEMPRE que mexer em isolamento por tenant, RLS policies, segments, connectors com segments[], TenantContext do front, ou middleware tenant.
---

# IGA Multi-tenant — Referência canônica

## Modelo de dados

Toda tabela de negócio tem `tenant_id TEXT NOT NULL` + RLS Postgres `FORCE`:

```sql
ALTER TABLE <tabela> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <tabela> FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_<tabela> ON <tabela>;
CREATE POLICY tenant_isolation_<tabela> ON <tabela>
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON <tabela> TO iga_app;
```

Tabelas com RLS: `users`, `tenants`, `datasources`, `sessions`, `alerts`, `copilot_messages`, `scheduled_reports`, `audit_log`, `auth_action_tokens`, `tenant_onboarding`, `api_keys`, `saved_views`, `public_shares`, `customers`, `production_targets`.

## Como o tenant_id chega ao Postgres

`back-end-gest-o/src/db/postgres.ts::postgresTenantContext()` faz `SET LOCAL app.current_tenant_id = $1` em cada request via AsyncLocalStorage. Middleware aplicado em `app.ts` antes das rotas.

## Sempre que adicionar nova tabela

1. Schema com `tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`
2. Migration Postgres com ENABLE+FORCE RLS + policy + GRANT to iga_app
3. Migration SQLite (`db/sqlite.ts`) idempotente (sem RLS — SQLite não suporta)
4. Storage helper que filtra por tenantId no SQLite
5. Teste em `db/postgresRls.test.ts`

## Segmentos de negócio

`back-end-gest-o/src/segments.ts` define 4 BusinessSegment: `industry`, `commerce`, `services`, `distribution`.

Cada segmento tem `defaultModules[]` e `recommendedConnectorId`. Connectors declaram `segments: BusinessSegment[]` indicando compatibilidade.

Endpoint público `/api/v1/segments` lista os 4 + connectors compatíveis. RegisterPage e OnboardingPage consomem.

Tenant tem coluna `segment` (migration 012). Default no signup é `industry`.

## TenantContext (frontend)

`front-end-gest-o/src/tenant/TenantContext.ts` — DEFAULT_TENANT é neutro (não SGBR). Tenant carrega:
- `companyName, logoUrl, primaryColor, subtitle`
- `enabledModules: string[]`
- `segment?: BusinessSegment`
- `connector?: { id, name, labels, segments?, productTypes, demoData? }`
- `plan, trialEndsAt`

Pages que mostram dados industriais devem checar `tenant.segment === 'industry'` para mostrar UI específica (ex: aba "Produto base" no EstoquePage).

## RBAC + permissions

19 permissões granulares em `back-end-gest-o/src/permissions.ts`. Roles: `admin` (todas), `manager` (sem users:* e support), `viewer` (só :view). `resolveEffectivePermissions(role, custom)` permite override per-user.

## Anti-pattern (NÃO fazer)

- Não consultar tabela tenant-aware sem o middleware setar `app.current_tenant_id` — RLS nega
- Não passar tenant_id no body do request — sempre extrair de `req.auth.tenantId` (do JWT)
- Não criar novo connector sem declarar `segments[]`
- Não duplicar UI labels por segmento — use `tenant.connector.labels` (`product`, `rawMaterial`, `production`, `stock`, `sales`)
