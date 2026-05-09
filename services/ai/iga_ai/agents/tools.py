"""Tool definitions para Anthropic Messages API.

Mantem 1:1 com TOOL_DEFINITIONS do orchestrator TS — para que o cutover
seja transparente. Ver back-end-gest-o/src/services/ai/tools.ts.

A execucao real eh feita por NodeClient.call_tool(name, args).
"""

from typing import Any

from anthropic.types import ToolParam


def _obj(properties: dict[str, dict[str, Any]], required: list[str] | None = None) -> dict[str, Any]:
    schema: dict[str, Any] = {"type": "object", "properties": properties}
    if required:
        schema["required"] = required
    return schema


TOOL_DEFINITIONS: list[ToolParam] = [
    {
        "name": "get_overview",
        "description": "Resumo geral da operacao do tenant atual: usuarios ativos, fontes de dados, alertas.",
        "input_schema": _obj({}),
    },
    {
        "name": "get_users",
        "description": "Lista usuarios e acessos do tenant. Apenas admin.",
        "input_schema": _obj({}),
    },
    {
        "name": "get_datasources",
        "description": "Lista fontes de dados configuradas (status de conexao).",
        "input_schema": _obj({}),
    },
    {
        "name": "get_datasource_details",
        "description": "Detalhes de uma fonte de dados especifica.",
        "input_schema": _obj({"id": {"type": "string", "description": "ID da fonte"}}, ["id"]),
    },
    {
        "name": "get_alerts",
        "description": "Lista alertas do sistema. Use onlyUnread=true para focar no que precisa de atencao.",
        "input_schema": _obj({"onlyUnread": {"type": "boolean"}}),
    },
    {
        "name": "get_scheduled_reports",
        "description": "Lista relatorios agendados do tenant.",
        "input_schema": _obj({}),
    },
    {
        "name": "get_audit_log",
        "description": "Log de auditoria de acoes administrativas. Apenas admin.",
        "input_schema": _obj({"limit": {"type": "integer"}}),
    },
    {
        "name": "search_entities",
        "description": "Busca global no sistema (usuarios, fontes, alertas) por termo.",
        "input_schema": _obj({"query": {"type": "string"}}, ["query"]),
    },
    {
        "name": "query_proxy_data",
        "description": "Consulta dados de uma fonte especifica em intervalo de datas.",
        "input_schema": _obj(
            {
                "dsId": {"type": "string"},
                "dtDe": {"type": "string", "description": "AAAA.MM.DD"},
                "dtAte": {"type": "string", "description": "AAAA.MM.DD"},
            },
            ["dsId", "dtDe", "dtAte"],
        ),
    },
    {
        "name": "get_proxy_status",
        "description": "Saude do proxy (cache, tokens, ultimos erros).",
        "input_schema": _obj({}),
    },
    {
        "name": "get_faturamento_mes",
        "description": "Faturamento total de um mes/ano. Use para perguntas como 'vendas de marco'.",
        "input_schema": _obj(
            {
                "year": {"type": "integer"},
                "month": {"type": "integer", "description": "1-12"},
                "includeNfe": {"type": "boolean"},
            },
            ["year", "month"],
        ),
    },
    {
        "name": "get_faturamento_periodo",
        "description": "Faturamento em intervalo de datas explicito.",
        "input_schema": _obj(
            {
                "dtDe": {"type": "string"},
                "dtAte": {"type": "string"},
                "includeNfe": {"type": "boolean"},
            },
            ["dtDe", "dtAte"],
        ),
    },
    {
        "name": "get_faturamento_comparativo_mensal",
        "description": "Compara faturamento mes atual vs mes anterior.",
        "input_schema": _obj(
            {"year": {"type": "integer"}, "month": {"type": "integer"}}, ["year", "month"]
        ),
    },
    {
        "name": "set_monthly_revenue_goal",
        "description": "Define meta mensal de faturamento (mutacao).",
        "input_schema": _obj({"value": {"type": "number"}}, ["value"]),
    },
    {
        "name": "clear_monthly_revenue_goal",
        "description": "Remove meta mensal de faturamento.",
        "input_schema": _obj({}),
    },
    {
        "name": "get_compras_periodo",
        "description": "Compras / materia-prima em intervalo.",
        "input_schema": _obj(
            {"dtDe": {"type": "string"}, "dtAte": {"type": "string"}}, ["dtDe", "dtAte"]
        ),
    },
    {
        "name": "get_producao_periodo",
        "description": "Dados de producao / fabricacao em intervalo.",
        "input_schema": _obj(
            {"dtDe": {"type": "string"}, "dtAte": {"type": "string"}}, ["dtDe", "dtAte"]
        ),
    },
    {
        "name": "get_contas_pagar_periodo",
        "description": "Contas a pagar / titulos financeiros em intervalo.",
        "input_schema": _obj(
            {"dtDe": {"type": "string"}, "dtAte": {"type": "string"}}, ["dtDe", "dtAte"]
        ),
    },
]
