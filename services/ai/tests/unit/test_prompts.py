"""Tests para system prompt builder."""

from iga_ai.agents.prompts import (
    SYSTEM_PROMPT_BASE,
    build_dynamic_system_prompt,
    build_session_context,
)


def test_session_context_has_user_role() -> None:
    ctx = build_session_context(user_name="Maria", user_role="admin")
    assert "Maria" in ctx
    assert "Administrador" in ctx


def test_session_context_role_labels() -> None:
    assert "Gestor" in build_session_context("X", "manager")
    assert "Visualizador" in build_session_context("X", "viewer")


def test_session_context_with_goal() -> None:
    ctx = build_session_context("Maria", "admin", monthly_goal=250000)
    assert "Meta mensal" in ctx
    assert "R$" in ctx


def test_session_context_without_goal() -> None:
    ctx = build_session_context("Maria", "admin", monthly_goal=None)
    assert "Meta mensal" not in ctx


def test_dynamic_system_prompt_combines_base_and_context() -> None:
    out = build_dynamic_system_prompt("Maria", "admin", monthly_goal=100000)
    assert SYSTEM_PROMPT_BASE in out
    assert "Maria" in out
    assert "CONHECIMENTO DO SISTEMA IGA GESTÃO" in out
