# AGENTS.md — Mapa do sistema para IAs e agentes

Documento único para **entender o monorepo**, **integrações SGBR**, **pontos fracos** e **como diagnosticar problemas** sem reinventar o contexto a cada sessão.

---

## 1. O que é este repositório

Workspace **“sistema de gestão”** com pelo menos:

| Pasta | Papel |
|-------|--------|
| `front-end-gest-o/` | SPA React (Vite + TypeScript): BI, financeiro, ERP leve, configuração de fontes, auth. |
| `back-end-gest-o/` | API Node/Express: auth, CRUD usuários, **proxy** para SGBR BI, datasources persistidos, rotas ERP/finance stub onde aplicável. |
| `docs/` | Documentação auxiliar (matrizes, dicionários, orçamentos). |

O produto é um **painel administrativo + análise de dados** que, com fontes cadastradas, consome **APIs SGBr BI** via backend (`/api/proxy/data`), não direto do browser para o SGBR em produção típica.

---

## 2. Stack resumida

**Frontend:** React 18, Vite, TypeScript, Ant Design, React Router, TanStack Query, Axios, Day.js, Recharts.

**Backend:** Express, JWT/auth, proxy com timeout e **paginação automática** para SGBR, storage de datasources (JSON por tenant em dev).

**Variáveis críticas (front):** `VITE_API_BASE_URL` — **somente origem** (`http://localhost:3000`), **sem** `/api/v1` no final (senão URLs duplicam). Ver `front-end-gest-o/src/api/apiEnv.ts`.

**Tenant:** `tenantStorage` prefixa chaves no `localStorage`; listagem de fontes e preferências dependem do tenant atual.

---

## 3. Como rodar (desenvolvimento)

```bash
# Backend (ajuste porta conforme README do back)
cd back-end-gest-o && npm install && npm run dev

# Frontend
cd front-end-gest-o && npm install && npm run dev
```

Build: `npm run build` em cada projeto.

---

## 4. Arquitetura de dados (o núcleo)

### 4.1 Fontes de dados (DataSources)

- Cadastro na UI: rota típica **Fontes de dados** (`/fontes-de-dados`).
- API: `GET/POST/PUT/DELETE /api/v1/datasources` (ver `dataSourceService.ts`).
- Cache local no front: `tenantStorage` chave `datasources` — **precisa** de `listDataSourcesFromApi()` para refletir o servidor.

Cada fonte tem: `apiUrl` (base), `dataEndpoint` (path tipo `/sgbrbi/vendas/analitico`), `loginEndpoint`, credenciais, `type: sgbr_bi`, etc.

### 4.2 Proxy unificado

- `GET /api/proxy/data?dt_de=YYYY.MM.DD&dt_ate=YYYY.MM.DD&requireDsId=1&dsId=<uuid>`
- O backend monta URL: `apiUrl + dataEndpoint` + query, com token SGBR quando `loginEndpoint` está configurado.
- **SGBR:** parâmetro de data usa **ponto** (`2026.02.01`), não hífen — função `toSgbrBiDateParam` no front.

**Paginação:** `back-end-gest-o/src/routes/proxy.ts` — env `PROXY_DATA_AUTO_PAGINATE`, `PROXY_DATA_MAX_AUTO_PAGES`, `SGBR_PROXY_DEFAULT_TAMANHO` (padrão página grande para não truncar). Respostas podem trazer header `x-iga-proxy-truncated: 1`.

### 4.3 Matriz tela → serviço → origem

Referência detalhada: `docs/MATRIZ_TELA_DATASOURCE.md`.

Regra geral: telas analíticas usam `getVendasAnalitico` → proxy + `dsId`. Sem `dsId` com `requireDsId=1` → **422**.

---

## 5. Módulos funcionais importantes (frontend)

| Área | Arquivos / serviços |
|------|---------------------|
| Vendas analítico | `vendasAnaliticoService.ts`, `VendasAnaliticoPage.tsx`, agregados `vendasAnaliticoAggregates.ts` |
| Dashboard / relatórios | `dashboardService.ts`, `ReportsPage.tsx`, `queryKeys.ts` |
| Financeiro | `FinancePage.tsx`, `financeService.ts`, `buildFinanceFromVendasRows` |
| Contas a pagar | `contasPagasService.ts`, `financeReportsService.ts`, `ContasPagarTab.tsx`, `getContasPagarSgbrDataSource()` em `dataSourceService.ts` |
| Fontes + picker | `dataSourceService.ts`, `vendasAnaliticoSourceSelection.ts`, `VendasAnaliticoSourcePicker.tsx` (header) |
| Comercial / NF | `notasFiscaisProxyService.ts`, `ComercialPage.tsx` |
| Rotas | `front-end-gest-o/src/routes/AppRouter.tsx` |

---

## 6. Problemas e armadilhas conhecidos (leia antes de “corrigir”)

### 6.1 PDF do SGBr vs totais na tela

- Relatórios PDF (ex.: **listagem de pedido de venda**) agregam por **pedido/DAV** e data de **pedido**.
- O analítico do BI costuma ser **por linha (item)** e filtro `dt_de`/`dt_ate` pode ser **emissão NF**, **fechamento** (`datafec`), etc.
- **Não é bug de soma** se divergir: são critérios diferentes. O código aplica `lineReceitaRow`, ajuste por pedido (`sumReceitaAjustePedido` / `receitaPedidoGrupo`) quando há `totalprodutos` e chave de pedido, e textos de ajuda na Visão Geral explicam isso.

### 6.2 Uma única fonte “vendas” no passado

- Hoje existe seleção **por fonte** e opção **“Todas as fontes”** (várias chamadas proxy, linhas unidas). Fonte errada ou só NF muda completamente os números.

### 6.3 Contas a pagar “não reconhecida”

- O sistema só usa SGBR se `getContasPagarSgbrDataSource()` achar uma fonte cujo path case com **contas a pagar** (vários aliases: `contas/pagas`, `contas/pagar`, `contas-a-pagar`, heurística excluindo “receber”).
- Se **não** achar, cai em `GET /finance/contas-pagar` no backend — hoje **stub retorna `[]`** (`back-end-gest-o/src/routes/finance.ts`). Por isso tela vazia sem fonte compatível **não** significa “API externa quebrada”.

### 6.4 Truncagem de dados

- Se `PROXY_DATA_AUTO_PAGINATE` estiver off ou limite baixo, o proxy devolve só parte das páginas; o front pode expor `analiticoFetchMeta.truncated` na visão financeira.

### 6.5 Contratos Zod

- Linhas SGBR são normalizadas (`sgbrVendaAnaliticoNormalize.ts`); contas a pagar mapeadas em `sgbrContasPagasMap.ts` e filtradas por `contaPagarSchema`. Campos que não parseiam são **descartados** (lista menor que o raw).

---

## 7. Backend: o que é real vs placeholder

- **Proxy:** produção-usável, crítico para BI.
- **Finance `GET /finance/contas-pagar`:** vazio até implementação futura — **sempre preferir fonte SGBR** para contas a pagar reais.
- Conferir `back-end-gest-o/src/routes/*.ts` para stubs.

---

## 8. Documentação adicional (raiz e docs)

| Arquivo | Conteúdo |
|---------|----------|
| `RUNBOOK_INTEGRACOES_DADOS.md` | Contrato SGBR, troubleshooting proxy, envs. |
| `docs/MATRIZ_TELA_DATASOURCE.md` | Tela × endpoint × datasource. |
| `docs/PERFORMANCE_BUDGETS.md` | Metas de latência. |
| `front-end-gest-o/README.md` | Detalhes do front e rotas de API. |
| `front-end-gest-o/COBERTURA_CAMPOS_API_TELAS.md` | Cobertura de campos (quando existir). |

---

## 9. Checklist para o agente implementar mudanças

1. Mudança é **só front**, **só back**, ou **proxy/contrato SGBR**?
2. Novo endpoint de dados: precisa **nova fonte** ou novo **hint** em `dataSourceService.ts`?
3. Query keys do React Query incluem **período** e **fonte** (`sourceId` / `sourceKey`) para invalidar cache correto?
4. Rodar `npx tsc --noEmit` no front após alterações TS.
5. Não expandir escopo: evitar refatorações grandes não pedidas.

---

## 10. Cursor / repositório

Este workspace **pode não ser um único git** no ambiente do usuário; não assumir branches remotos sem verificar.

---

*Última orientação: em dúvida sobre divergência de números, separar **critério de negócio (PDF vs BI)** de **bug de código**; para integração, seguir RUNBOOK e headers do proxy.*
