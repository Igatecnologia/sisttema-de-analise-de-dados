# Arquitetura — IGA Gestão e Análise de Dados

Este documento consolida as decisões e práticas para evoluir o projeto para um **sistema administrativo + BI** pronto para produção (2025/2026): **segurança**, **governança**, **performance** e **UX**.

## Objetivo

Criar um “centro de comando” com:
- Dashboard único com KPIs, gráficos e drill-down
- Relatórios com filtros (URL), export e rastreabilidade
- Módulos administrativos (CRUDs) com RBAC e auditoria
- Pronto para receber dados de uma API (banco) de forma resiliente e segura

## Stack (decisão)

- **UI**: Ant Design
- **Rotas**: React Router
- **HTTP**: Axios (`src/services/http.ts`) com interceptors
- **Server state**: TanStack Query (cache/dedupe/retry/paginação)
- **Contratos**: Zod (validação runtime) para respostas da API
- **Datas**: Day.js

## Camada de dados (API)

### Diretrizes
- **Nunca confiar só no TypeScript** para respostas da API (TS não valida em runtime).
- Validar respostas com **Zod** (ex: `src/api/validatedHttp.ts`).
- Separar:
  - **client HTTP** (`http`)
  - **services** (funções por domínio)
  - **hooks** (TanStack Query) para UI

### Padrões recomendados (TanStack Query)
- Query keys consistentes (ex: `src/query/queryKeys.ts`).
- `staleTime` adequado para dashboards; evitar refetch agressivo sem necessidade.
- Paginação/ordenação/filtros: preferir **server-side** com params na URL.
- Mutations:
  - `onSuccess` → `invalidateQueries`
  - (opcional) optimistic update com rollback

## Dashboard e BI

### UX essencial
- Filtros no topo, **persistidos na URL**
- Drill-down (clique no gráfico filtra tabela/other widgets)
- “Última atualização” e refresh
- Saved Views (próximo passo): salvar filtros/colunas

### Performance
- Para grandes volumes:
  - Paginação server-side
  - Virtualização de tabela/listas (tanstack-virtual)
  - Evitar renderizações desnecessárias (Profiler antes de otimizar)

## Segurança e RBAC

### RBAC em 3 níveis
- **Rota**: bloqueio de acesso (403)
- **Menu**: ocultar itens sem permissão
- **Ação**: desabilitar/ocultar ações (create/edit/delete/export)

Formato recomendado: `recurso:ação` (ex: `reports:export`, `users:write`).

## Auditoria (governança)

Auditoria deve registrar:
- ator, ação, alvo, data/hora, metadados relevantes
- filtros por período/ação/usuário e export

**Atenção LGPD/GDPR**:
- Nunca registrar PII sensível em logs de erro/telemetria.
- Quando usar Sentry, habilitar **data scrubbing** (remover e-mail, tokens, documentos, etc.).
- Preferir registrar no audit log apenas IDs e metadados não sensíveis.

## Governança de dados (LGPD)

Diretrizes práticas:
- **Minimização**: a API deve enviar apenas campos necessários para renderização.
- **Mascaramento**: PII (CPF/e-mail) deve ser mascarada por padrão e revelada apenas sob ação explícita (e auditada).
- **Direito ao esquecimento**: processos de exclusão/anonimização devem refletir no UI (e gerar log).

## Acessibilidade (A11y)

Checklist mínimo (WCAG):
- navegação por teclado e foco visível
- labels/aria para botões/inputs
- contraste adequado (principalmente no dark mode)

## Observabilidade

Quando for produção real:
- Sentry (erros + performance)
- scrubbing de dados sensíveis
- tracing de requests críticos (login, exports, relatórios)

## Testes (estratégia)

- **E2E (Playwright)**: login, RBAC, navegação, CRUD crítico, export CSV
- **Unit**: utils/services, parsers/contratos Zod

## Exportação de dados (por volume)

Recomendação:
- **Pequeno (< 5k linhas)**: export no frontend (ExcelJS/SheetJS).
- **Médio (5k a 50k)**: CSV com streaming (quando possível) e progress.
- **Grande (> 50k)**: job no backend (fila) + notificação quando concluir.

