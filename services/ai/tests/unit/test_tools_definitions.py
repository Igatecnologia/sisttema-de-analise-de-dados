"""Garante que os 18 tools estao bem-formados (nome unico, schema valido)."""

from iga_ai.agents.tools import TOOL_DEFINITIONS


def test_18_tools_present() -> None:
    assert len(TOOL_DEFINITIONS) == 18


def test_tool_names_unique() -> None:
    names = [t["name"] for t in TOOL_DEFINITIONS]
    assert len(set(names)) == len(names), f"nomes duplicados: {names}"


def test_each_tool_has_schema() -> None:
    for t in TOOL_DEFINITIONS:
        assert "name" in t
        assert "description" in t
        assert "input_schema" in t
        schema = t["input_schema"]
        assert schema["type"] == "object"
        assert "properties" in schema


def test_critical_tools_present() -> None:
    names = {t["name"] for t in TOOL_DEFINITIONS}
    expected = {
        "get_overview",
        "get_users",
        "get_datasources",
        "get_alerts",
        "get_faturamento_mes",
        "get_faturamento_periodo",
        "get_faturamento_comparativo_mensal",
        "set_monthly_revenue_goal",
        "clear_monthly_revenue_goal",
    }
    missing = expected - names
    assert not missing, f"tools criticas faltando: {missing}"
