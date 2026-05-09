# Critério de "100%" — IGA Gestão SaaS

Define quando o produto está pronto para escalar venda para clientes em qualquer segmento.

## Definição

> **Está 100% quando um cliente novo consegue, sem suporte humano, completar a jornada signup → onboarding → conectar dados → ver dashboard → convidar equipe → pagar — em qualquer um dos 4 segmentos (indústria, comércio, serviços, distribuição), sem encontrar nenhuma string ou comportamento específico de um único nicho (ex.: "espuma", "SGBR", "/sgbrbi/*") em lugar visível.**

## Jornada que precisa funcionar end-to-end

| Etapa | Critério | Endpoint / Página |
|-------|----------|-------------------|
| 1. Signup | Cliente escolhe segmento e empresa em < 1 min | `POST /api/v1/auth/register` + `RegisterPage` |
| 2. Email verification | Recebe email, clica link, sessão ativa | `POST /api/v1/auth/verify-email` |
| 3. Onboarding | 5 passos: Perfil → Marca → Dados → Templates → Equipe; opcional CSV import inicial | `OnboardingPage` |
| 4. Conector | Lista filtra por segmento; recommended pré-selecionado | `GET /api/v1/connectors?segment=...` |
| 5. DataSource | Configurado com mappings; teste de conexão OK | `POST /api/v1/datasources/:id/test` |
| 6. Dashboard | Renderiza ao menos KPIs e 1 gráfico com dados reais ou demo | `DashboardPage`, `/api/v1/dashboard` |
| 7. Convite equipe | Admin convida 1+ usuários, eles aceitam, ganham permissões | `POST /api/v1/auth/invite` + `accept-invite` |
| 8. Trial → Pagamento | TrialBanner mostra dias restantes; cliente clica → Stripe Checkout → webhook ativa subscription | `POST /api/v1/billing/checkout-session` |
| 9. Cobrança ativa | Status muda para `active`, banner some, app desbloqueia | `subscriptionGate` middleware |

## Checklist por segmento

Para validar 100%, cada segmento precisa rodar a jornada completa:

### Indústria ✅
- [x] Segment selecionável no signup
- [x] Connector recomendado: `iga-custom-api`
- [x] Módulos default: dashboard, financeiro, relatorios, usuarios, auditoria, producao, ficha_tecnica, comercial, compras, estoque, alertas, suporte, datasources, operations
- [x] Aba "Produto base" no Estoque visível
- [x] Templates: executive + finance + operations
- [x] Compatível com SGBR Espuma (legacy clients)

### Comércio ✅
- [x] Segment selecionável no signup
- [x] Connector recomendado: `bling`
- [x] Módulos default: dashboard, financeiro, relatorios, usuarios, auditoria, comercial, compras, estoque, alertas, suporte, datasources
- [x] Aba "Produto base" oculta no Estoque
- [x] Templates: executive + finance + sales

### Serviços ✅
- [x] Segment selecionável no signup
- [x] Connector recomendado: `omie`
- [x] Módulos default: dashboard, financeiro, relatorios, usuarios, auditoria, comercial, alertas, suporte, datasources, operations
- [x] Sem produção/estoque/ficha_tecnica
- [x] Templates: executive + finance + services-ops

### Distribuição ✅
- [x] Segment selecionável no signup
- [x] Connector recomendado: `bling`
- [x] Módulos default: dashboard, financeiro, relatorios, usuarios, auditoria, comercial, compras, estoque, alertas, suporte, datasources, operations
- [x] Templates: executive + finance + logistics

## Anti-checklist (o que NÃO pode aparecer)

Para qualquer segmento que não seja `industry` com connector SGBR, NENHUMA dessas strings/comportamentos pode aparecer:

- [ ] String "SGBR" em qualquer label, título, placeholder ou subtitle visível ao usuário
- [ ] String "espuma" ou "aglomerado" em UI (exceto se connector explicitamente é SGBR Espuma)
- [ ] Endpoint `/sgbrbi/*` sugerido como placeholder
- [ ] Aba "Produto Base" no Estoque (só industry)
- [ ] Página `FichaTecnicaPage` no menu (só industry)
- [ ] Connector `sgbr-espuma` na lista de opções de onboarding (filtrado por segmento)

## Status do código (2026-05-09)

### Pronto e validado por testes ✅
- Auth completo: refresh tokens com rotação, MFA, account lockout, HIBP — `auth.ts` + 76 testes
- API Keys com 4 scopes timing-safe — `apiKeyAuth.ts`
- Billing Stripe end-to-end — `billing.ts`
- Bypass billing bloqueado em prod — `subscriptionGate.ts:32`
- Segments registry com 4 perfis + helpers — `segments.ts` + 12 testes
- Connector compatibility per segment — `connectorRegistry.listBySegment()` + 6 testes
- RegisterPage com card-selector visual de segmento + endpoint público `/api/v1/segments`
- OnboardingPage com 5 passos + CSV upload + auto-suggest connector por segmento
- EstoquePage usa `tenant.connector.labels` e oculta aba intermediária para non-industry
- DEFAULT_TENANT neutro (sem labels SGBR)
- OrgSwitcher no header (acesso direto)
- HelpCenter e Changelog dinâmicos via API
- PublicShares e SavedViews completos com expiração e revoke

### Dívida técnica registrada (não-bloqueante)
- `DataSourceConfigPage.tsx` 1026 linhas — refator em sub-componentes (próximo sprint)
- `vendor-antd` chunk 1.38MB — investigar lazy-loading de subpacotes Ant Design
- E2E não rodam em CI — adicionar workflow GitHub Actions
- CRUDs first-party de nicho (Clientes para comércio, Contratos para serviços) — roadmap explícito

### Verificação manual recomendada antes de "release público"
1. Subir staging com `IGA_STORAGE_DRIVER=postgres`, `STRIPE_*` em modo test
2. Cadastrar 4 tenants (1 por segmento) com 4 emails diferentes
3. Para cada um: completar onboarding até dashboard, convidar 1 colega, abrir Stripe checkout em modo teste, simular pagamento via webhook
4. Verificar que nenhum tenant não-industry vê string SGBR/espuma em UI
5. Rodar `npm run test:e2e -- smoke-saas` — deve passar
6. Lighthouse score > 80 em /, /login, /register, /onboarding

## Como medir continuamente

- CI: `npm run test` em ambos repos (deve manter 110 testes passando)
- Build: `npm run build` ambos (sem warnings novos)
- Lint: `npm run lint` ambos
- Bundle size: `npm run size:check` (frontend)
- E2E nightly: GitHub Actions semanal rodando `smoke-saas.spec.ts`
