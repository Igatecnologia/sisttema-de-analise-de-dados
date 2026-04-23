# ✅ Checklist Evoluído — Frontend Admin + BI (2025–2026)

Este checklist é a “Fonte da Verdade” para evoluir o produto até um **Admin + BI nível empresa**.

## Sprint 1 — Fundação (Base & Arquitetura)
- [x] Setup: Vite + React + TypeScript (strict)
- [x] Ant Design + React Router
- [x] Layout base (Sidebar/Header/Content) responsivo
- [x] Rotas iniciais + 404
- [x] Aliases `@/` (path mapping) para imports
- [x] ESLint + Prettier
- [x] Regras A11y base (jsx-a11y)
- [x] Tokens de Dark/Light via CSS Variables (otimização opcional)

## Sprint 2 — Camada de Dados (Resiliência)
- [x] Axios (`http`) com interceptors (token + 401 global)
- [x] TanStack Query (QueryClient, staleTime, retry)
- [x] Query Key Factory (`src/query/queryKeys.ts`)
- [x] Migração das páginas principais para `useQuery` (sem `useEffect` para fetch)
- [x] Validação runtime (Zod) e helpers (`src/api/validatedHttp.ts`)
- [x] Zod schema por endpoint real (contratos da API)
- [x] MSW (mock realista) para integração paralela ao backend
- [x] Global error handling por código HTTP (mensagens contextuais)

## Sprint 3 — Dashboard (BI PROFISSIONAL)

### 📊 KPIs (evoluído)
- [x] Valor atual
- [x] Variação (%)
- [x] Comparação com período anterior (ex: vs período anterior selecionado)
- [x] Sparkline (mini gráfico) por KPI

### 📈 Gráficos principais (expandido)
- [x] Linha (evolução temporal)
- [x] Barras (comparação)
- [x] Área (tendência acumulada)
- [x] Combinado (linha + barra)
- [x] Pizza/Donut (participação)
- [x] Heatmap (dia/hora)
- [x] Scatter plot (correlação)
- [x] Funnel (conversão)
- [x] Waterfall (ganhos/perdas)
- [x] Radar (performance por categoria)

### 🔎 Interatividade (nível BI)
- [x] Drill-down: clique no gráfico filtra tabela (**dia e mês**)
- [x] Drill-down hierárquico (dia → mês → ano)
- [x] Drill-through (abrir outra página com contexto)
- [x] Tooltip rico (múltiplas métricas)
- [x] Cross-filter (clicar em gráfico filtra outros widgets)
- [x] Multi-seleção em gráficos

### 🧮 Tabelas inteligentes
- [x] Paginação
- [x] Filtros
- [x] Ordenação nas colunas das tabelas (sorter prop)
- [x] Virtualização base (tanstack-virtual) para listas grandes
- [x] Agrupamento (group by)
- [x] Subtotais e totais
- [x] Colunas calculadas
- [x] Colunas customizáveis (mostrar/ocultar)
- [x] Freeze columns (fixar colunas)

### 🔁 Persistência e estado
- [x] URL State
- [x] Saved Views
- [x] Compartilhar link (copiar URL)
- [x] Favoritar dashboards
- [x] Compartilhamento com permissões

## Sprint 4 — UX & Performance Crítica
- [x] Skeletons/Empty States
- [x] Error Boundary global
- [x] Dark/Light + persistência
- [x] Mobile nav em Drawer
- [x] Virtualização (tanstack-virtual) em tabelas/listas grandes (>100 linhas)
- [x] A11y Review completo (WCAG 2.1): teclado/foco/labels/contraste
- [x] Lazy loading de gráficos pesados (quando existirem)

## Sprint 5 — Relatórios (NÍVEL EMPRESA) + Governança

### 📑 Relatórios (tipos)
- [x] Operacionais: Vendas (base)
- [x] Operacionais: Usuários (base)
- [x] Operacionais: Logs/Auditoria (base)
- [x] Performance (tempo de resposta/uso)
- [x] Financeiro (receita/custos/lucro)
- [x] Conversão (funil)
- [x] Retenção (cohort)
- [x] Tendência e comparação (YoY/MoM)
- [x] Top N / Sazonalidade / Segmentação

### 📤 Exportação (profissional)
- [x] CSV
- [x] Excel formatado (abas/estilos)
- [x] PDF executivo (layout bonito)
- [x] Export gráfico como imagem (PNG/SVG)
- [x] Agendamento de relatórios (simulado)

### 🔍 Filtros avançados
- [x] Básicos
- [x] RBAC aplicado nos módulos
- [x] Intervalo de datas avançado
- [x] Filtros combinados (AND/OR)
- [x] Filtros salvos por usuário

### 🔐 Admin & Compliance
- [x] Login + rotas privadas
- [x] RBAC (rota + menu + ação)
- [x] CRUD Usuários (localStorage) + validação
- [x] Auditoria/Logs (URL + export CSV)
- [x] Audit Trail avançado: “diff” (de/para) em mudanças críticas
- [x] LGPD: masking de PII + log de revelação/acesso sensível

## Sprint 6 — BI Avançado + API Real

### 🔌 Integração real
- [x] Paginação server-side
- [x] Filtros server-side
- [x] Ordenação server-side
- [x] Mutations com invalidação de cache (TanStack Query)
- [x] Zod schema por endpoint real (contratos)

### ⚡ Performance
- [x] Debounce em filtros
- [x] Cache e invalidação consistentes
- [x] Virtualização em datasets muito grandes (ajustes finos)

### 🔄 Tempo real
- [x] Polling configurável
- [x] SSE/WebSocket
- [x] Indicador “dados atualizados agora”

### 🧠 Inteligência (diferencial)
- [x] Insights automáticos (regras simples)
- [x] Destaque de anomalias
- [x] Sugestões de filtros

## Sprint 7 — Qualidade (NÍVEL PRODUTO)

### 🧪 Testes focados em BI
- [x] Filtros + gráficos
- [x] Drill-down / drill-through
- [x] Exportação
- [x] RBAC em relatórios

### 🧪 Testes gerais
- [x] E2E (Playwright): login, navegação, RBAC (403) e CRUD
- [x] Storage State (Playwright) para acelerar
- [x] Unit: services/utils (contratos, parsers)

### 🔐 Segurança e deploy
- [x] CSP e headers de segurança (hosting)
- [x] Checklist de deploy automatizado

## Sprint 8 — Fluxo ERP + BI Operacional (Referência de Negócio)

> Observação: esta sprint representa uma visão de processo fornecida como referência para evolução do front-end.
> Não está vinculada exclusivamente a uma empresa específica.

### 🧩 1) Fluxo ponta a ponta (Fonte da Verdade)
- [x] Mapear fluxo completo: Compra de matéria-prima -> Estoque insumos -> Produção de blocos -> Ficha técnica -> Estoque produto base -> Pedido -> OP -> Baixa m3 -> Faturamento -> Financeiro -> Recebimento -> Dashboards
- [x] Definir pontos de entrada/saída por etapa (quem lança, quando lança, qual evidência)
- [x] Definir status operacionais por etapa (pendente, em produção, faturado, recebido)
- [x] Definir trilha de auditoria mínima por evento crítico

### 🏭 2) Processo produtivo (detalhado)
- [x] Matéria-prima: entrada de compra com classificação (Produção vs Despesa Operacional)
- [x] Produção: cadastrar bloco de espuma com tipo, densidade e volume total (m3)
- [x] Regra crítica: bloquear conclusão de lote sem volume, tipo e densidade
- [x] Produção por lote/período com custo por lote e rendimento

### 📐 3) Ficha técnica (base de custo)
- [x] Cadastro de dimensões (altura x largura x comprimento)
- [x] Conversão automática para m3 por item e por pedido
- [x] Consumo de matéria-prima por produto
- [x] Custo estimado por produto e por m3
- [x] Validação de consistência (dimensões > 0, densidade válida, unidade padrão m3)

### 📦 4) Estoque (ponto crítico)
- [x] Estoque em 2 níveis: Insumos e Produto Base (espuma em m3)
- [x] Entrada de insumos por compra
- [x] Baixa de insumos na produção
- [x] Entrada de produto base após produção
- [x] Baixa de produto base por consumo em vendas/OP
- [x] Dashboard de estoque: saldo atual (m3), giro, produtos parados, estoque crítico

### 🛒 5) Comercial + OP + Faturamento
- [x] Pedido do cliente com total de peças e total em m3
- [x] OP agrupando pedidos e convertendo consumo total em m3
- [x] Baixa automática de estoque ao confirmar OP
- [x] Faturamento via NF-e ou nota manual (pedido)
- [x] Conciliação pedido x produzido x faturado

### 💰 6) Financeiro (caixa, pagar, receber)
- [x] Venda à vista (dinheiro/PIX) com entrada automática no caixa
- [x] Venda a prazo (boleto/cartão) gerando contas a receber
- [x] Baixa posterior de recebimentos e controle de inadimplência
- [x] Compras gerando contas a pagar
- [x] Classificação financeira: matéria-prima, despesas operacionais, outros

### 📊 7) Dashboards essenciais (gestão)
- [x] Produção: m3 por período, custo por lote, consumo de matéria-prima
- [x] Financeiro: fluxo de caixa, pagar vs receber, inadimplência
- [x] Comercial: vendas por cliente/produto, ticket médio
- [x] Estoque: saldo m3, giro, produtos parados
- [x] Custo e margem: custo real por m3/produto, margem por venda, margem sugerida

### ⚠️ 8) Cálculo de custo real (credibilidade do projeto)
- [x] Compor custo real por m3 com: matéria-prima, energia, mão de obra, perdas e indiretos
- [x] Exibir custo real por produto e por venda
- [x] Exibir margem real e comparação com margem alvo
- [x] Regra de margem: mínima 30%, ideal 40% a 60% (alertas automáticos)

### 🚨 9) Alertas e inteligência operacional
- [x] Alerta de margem baixa
- [x] Alerta de estoque crítico
- [x] Indicador de vazamento de lucro
- [x] Simulador "Se vender X -> lucro Y"

### 📅 10) Cronograma de implementação (10 dias)
- [x] Dia 1-2 (Dev único): mapeamento completo dos processos e falhas
- [x] Dia 2-3 (Dev único): revisão de cadastros (produtos, matéria-prima, clientes, fornecedores, usuários)
- [x] Dia 3-4 (Dev único): padronização de ficha técnica e unidade m3
- [x] Dia 4-5 (Dev único): configuração de produção e supervisão de OP
- [x] Dia 5-6 (Dev único): ajuste de estoque inicial + validação de entradas/saídas
- [x] Dia 6-7 (Dev único): contas a pagar/receber e formas de pagamento
- [x] Dia 7-8 (Dev único): views de vendas, estoque e financeiro
- [x] Dia 8-9 (Dev único): integração/API e automações
- [x] Dia 9-10 (Dev único): dashboards de produção, financeiro, comercial e estoque
- [x] Dia 10 (Dev único): apresentação final, validação e simulação real

### 🧠 11) Entrega executiva para a gestora
- [x] Mostrar perdas atuais (estoque parado, erro de preço, falta de controle)
- [x] Mostrar ganhos imediatos (custo real, margem real, visão diária)
- [x] Mostrar previsibilidade futura (crescimento controlado e decisão segura)
- [x] Responder obrigatoriamente: lucro real por produto, desperdício, produto mais lucrativo, meta de vendas para crescer

