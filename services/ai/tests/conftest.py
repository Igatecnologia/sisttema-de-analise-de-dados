"""Shared fixtures."""

import os

import pytest


@pytest.fixture(autouse=True)
def env_setup(monkeypatch: pytest.MonkeyPatch) -> None:
    """Default env vars para todos os testes — evita carregar .env real."""
    monkeypatch.setenv("ENV", "test")
    monkeypatch.setenv("IGA_AI_SHARED_SECRET", "test-secret-not-real-32bytes-fake")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test-fake")
    monkeypatch.setenv("NODE_BACKEND_URL", "http://localhost:3001")
    # Limpa cache do get_settings para pegar nossos valores
    from iga_ai.config import get_settings
    get_settings.cache_clear()
