# Cobertura de Campos API -> Telas

Documento operacional para validar se os campos recebidos da API SGBR possuem destino correto no frontend.

## Endpoint: `/sgbrbi/vendas/analitico`

Campos esperados no payload:

- `data`
- `datafec`
- `codvendedor`
- `nomevendedor`
- `codprod`
- `decprod`
- `qtdevendida`
- `und`
- `qtdeconvertidavd`
- `precocustoitem`
- `valorunit`
- `total`
- `codcliente`
- `nomecliente`
- `cepcliente`
- `totalprodutos`
- `statuspedido`

## Mapeamento atual por tela

| Campo | Uso atual | Tela/serviço |
|---|---|---|
| `data` | Ordenação e timeline | `VendasAnaliticoPage`, `Dashboard`, agregadores |
| `datafec` | Data de fechamento, agrupamento de pedido e exibição | `VendasAnaliticoPage`, drawer de detalhe |
| `codvendedor` | Agrupamento por vendedor (Curva ABC) | `CurvaAbcTab` |
| `nomevendedor` | Exibição de vendedor | `VendasAnaliticoPage` |
| `codprod` | Chave de produto e ranking | `ReportsPage`, `CurvaAbcTab`, agregadores |
| `decprod` | Nome de produto em tabelas e exports | múltiplas telas |
| `qtdevendida` | Quantidade e indicadores | `Vendas`, `Reports`, `Finance`, `Dashboard` |
| `und` | Unidade principal em pedidos | `VendasAnaliticoPage` |
| `qtdeconvertidavd` | Exibição no detalhe do pedido | `VendaAnaliticoDetailDrawer` |
| `precocustoitem` | Custo, lucro e margem | `Finance`, `Reports`, `Dashboard`, `Vendas` |
| `valorunit` | Exibição de preço unitário | `VendaAnaliticoDetailDrawer` |
| `total` | Faturamento principal | todas telas analíticas |
| `codcliente` | Chave de cliente | `Vendas`, `Reports`, `Dashboard` |
| `nomecliente` | Exibição e top clientes | `Vendas`, `Reports`, `Dashboard` |
| `cepcliente` | Exibição no detalhe de cliente | `VendaAnaliticoDetailDrawer` |
| `totalprodutos` | **Não utilizado em KPI/tela** (apenas disponível no payload) | pendente de decisão de produto |
| `statuspedido` | Status visual e filtros | `Vendas`, `CurvaAbcTab`, agregadores |

## Campos sem destino funcional confirmado

- `totalprodutos`

Sugestão: validar com negócio se `totalprodutos` deve substituir/ajustar o `total` em alguma visão específica (ex.: total por DAV).

## Atualizacao (sprints de melhoria)

- Matriz tela/fonte: `docs/MATRIZ_TELA_DATASOURCE.md`
- Dicionario resumido: `docs/DICIONARIO_CAMPOS_ANALITICO.md`
- Teste de contrato Zod: `src/api/vendasAnalitico.contract.test.ts`
- Guia do gestor: `docs/GUIA_GESTOR.md` — tela inicial `Visão do gestor` em `/gestao`

## Checklist de auditoria manual

1. Validar período e fonte ativa (badge azul no cabeçalho).
2. Conferir total da tela com `/api/proxy/reconcile`.
3. Validar se `datafec` está coerente com mês do relatório oficial.
4. Validar amostra de 3 pedidos no detalhe com payload bruto da API.
