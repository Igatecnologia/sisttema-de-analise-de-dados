"""LLM provider abstraction.

Default: OpenAI (gpt-4o-mini para Free/Pro, gpt-4o para Enterprise).
Fallback: Anthropic Claude.
"""

from functools import lru_cache
from typing import Any, AsyncIterator, Protocol

from anthropic import AsyncAnthropic
from openai import AsyncOpenAI

from iga_ai.config import Settings, get_settings


class StreamChunk(Protocol):
    """Eventos genericos retornados pelo provider stream."""

    type: str  # 'text' | 'tool_use' | 'done'


class LlmProvider(Protocol):
    """Interface comum entre OpenAI / Anthropic / Gemini."""

    name: str

    async def stream_with_tools(
        self,
        *,
        system: str,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        model: str,
        max_tokens: int = 1024,
        temperature: float = 0.3,
    ) -> AsyncIterator[dict[str, Any]]:
        ...


@lru_cache(maxsize=1)
def _openai_client() -> AsyncOpenAI:
    settings = get_settings()
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY nao configurado")
    return AsyncOpenAI(api_key=settings.openai_api_key, base_url=settings.openai_base_url)


@lru_cache(maxsize=1)
def _anthropic_client() -> AsyncAnthropic:
    settings = get_settings()
    if not settings.anthropic_api_key:
        raise RuntimeError("ANTHROPIC_API_KEY nao configurado")
    return AsyncAnthropic(api_key=settings.anthropic_api_key)


def model_for_plan(plan: str, settings: Settings | None = None) -> str:
    """Routing por plano: Enterprise -> premium; Pro -> default; Free -> fast."""
    s = settings or get_settings()
    if s.llm_provider == "anthropic":
        if plan == "enterprise":
            return s.anthropic_model_premium
        if plan == "pro":
            return s.anthropic_model_default
        return s.anthropic_model_fast
    # default: OpenAI
    if plan == "enterprise":
        return s.openai_model_premium
    if plan == "pro":
        return s.openai_model_default
    return s.openai_model_fast


def get_llm_clients() -> tuple[AsyncOpenAI | None, AsyncAnthropic | None]:
    """Retorna clientes disponiveis (None se chave nao configurada)."""
    settings = get_settings()
    openai = _openai_client() if settings.openai_api_key else None
    anthropic = _anthropic_client() if settings.anthropic_api_key else None
    return openai, anthropic


def primary_provider_name() -> str:
    settings = get_settings()
    if settings.llm_provider == "anthropic" and settings.anthropic_api_key:
        return "anthropic"
    if settings.llm_provider == "openai" and settings.openai_api_key:
        return "openai"
    # Fallback: usa o que tiver chave
    if settings.openai_api_key:
        return "openai"
    if settings.anthropic_api_key:
        return "anthropic"
    raise RuntimeError("Nenhum provider IA configurado (OPENAI_API_KEY ou ANTHROPIC_API_KEY)")
