---
name: iga-connectors
description: ERP integrations e datasources — SGBR BI, Bling, Tiny, Omie, IGA Custom API, CSV. Use ao mexer em routes/proxy.ts, routes/erp.ts, routes/finance.ts, connectors/, áreas (estoque/produzido/vendas/compras/contas/recebiveis/notasfiscais), field mappings, password hash modes (sha256/plain), JWT login dos ERPs, ou DataSourceConfigPage do front.
---

# IGA Connectors — Referência canônica

## Arquitetura

```
Frontend → /api/proxy/data?dsId=X → routes/proxy.ts → resolve datasource (SQLite/Postgres) →
authenticate na API externa (cache 45min) → busca dados com paginação automática →
field mappings → cache 5min LRU → retorna array
```

`back-end-gest-o/src/routes/proxy.ts` é o coração (1500+ linhas, crítico). NÃO mexer sem ler o arquivo todo primeiro.

## Connector pattern

Interface `IndustryConnector` em `back-end-gest-o/src/connectors/industryConnector.ts`:

```typescript
interface IndustryConnector {
  id: string                                          // 'sgbr-espuma', 'bling', etc.
  name: string
  cspConnectSrc: string[]                             // domínios para CSP dinâmico
  labels: ConnectorLabels                             // PT-BR para UI
  segments: BusinessSegment[]                         // segmentos compatíveis
  areaHints: Record<ConnectorArea, string[]>          // hints de URL por área
  warmTargets: WarmTarget[]                           // endpoints aquecidos por job
  getProductTypes(): string[]
  classifyProduct(row: Record<string, unknown>): ProductClassification
  normalizeRow(row, area?): Record<string, unknown>
  getDemoData(): ConnectorDemoData
}
```

7 connectors built-in: `Generic`, `SgbrEspuma`, `IgaCustomApi`, `Csv`, `Bling`, `Tiny`, `Omie`. Registro em `connectorRegistry.ts`. Hot-reload: `IGA_CONNECTORS_DIR` aceita JSON files.

## 7 áreas de dados (ConnectorArea)

`estoque`, `produzido`, `vendas`, `compras`, `contas` (a pagar), `recebiveis` (a receber), `notasfiscais`. Cada connector mapeia hints. Endpoint `/finance/contas-receber` lê área `recebiveis`; `/finance/contas-pagar` lê `contas`.

## Auth nos ERPs externos

Modos suportados (`passwordMode` no datasource):
- `plain` (default): senha em texto puro no body
- `sha256`: SGBR BI exige — hash hex SHA-256 da senha

Auth methods (`authMethod`):
- `none`: público
- `bearer_token`: header `Authorization: Bearer <token>`
- `basic_auth`: `Authorization: Basic base64(user:pass)`
- `api_key`: header customizável
- `jwt`: login no `loginEndpoint` retorna token, cache 45min

Campos: `loginFieldUser` (login/username/email/cpf), `loginFieldPassword` (senha/password/pwd).

## SGBR BI (Tiete Espumas)

Caso de teste do Beta. Configuração canônica:
```
apiUrl: http://108.181.223.103:3007
loginEndpoint: /sgbrbi/usuario/login
loginFieldUser: 'login', loginFieldPassword: 'senha'
passwordMode: 'sha256'
authMethod: 'jwt'
```

6 endpoints: `/sgbrbi/vendas/analitico`, `/sgbrbi/vendanfe/analitico`, `/sgbrbi/contas/pagas`, `/sgbrbi/produzido`, `/sgbrbi/estoque`, `/sgbrbi/compras`.

Auto-seed em `seedDataSources.ts` cria os 6 quando `SGBR_API_URL` e `SGBR_CREDENTIALS` estão setados (formato `login:senha`).

## DataSourceConfigPage (frontend)

`front-end-gest-o/src/pages/DataSourceConfigPage.tsx` (1.282 linhas — refator pendente).

Features:
- Drawer com 3 FormSections (Servidor/Login/Teste) + Collapse "Integração"
- Modo Guiado (Steps 4 passos) vs Avançado (form único) — toggle Segmented
- Templates locais (localStorage por tenant) — botão "Salvar como template"
- Importação em lote (BulkImportDataSourcesModal) — preset SGBR Tiete cria 6 fontes
- "Duplicar fonte" no menu de ações
- Hash da senha sempre visível quando há login
- Teste de conexão com diagnóstico expandível

## SSRF protection

`back-end-gest-o/src/utils/urlSafety.ts::validateExternalApiUrl()` bloqueia IPv4/IPv6 privados, loopback, metadata (169.254.169.254, fd00::/8). Sempre validar URL antes de fetch externo.

## Anti-pattern (NÃO fazer)

- Não usar `process.env.SGBR_CREDENTIALS` como fallback no proxy — credenciais vêm do datasource criptografado por tenant (`AES-256-GCM` em `crypto.ts`)
- Não hardcodar paths SGBR em rotas de negócio — usar `connector.areaHints[area]` para resolver dinamicamente
- Não esquecer SSRF check em qualquer URL que vem do tenant
