"""Agente principal — provider-agnostic.

Default: OpenAI (gpt-4o-mini para Pro, gpt-4o para Enterprise).
Fallback: Anthropic Claude.

Loop chat ↔ tool-call manual com providers nativos. Em AI-4 migramos
para Pydantic AI; por ora a abstracao em agents/providers.py basta.
"""

from typing import Any, AsyncIterator

from iga_ai.agents.providers import stream_anthropic, stream_openai
from iga_ai.agents.tools import TOOL_DEFINITIONS
from iga_ai.deps.llm import get_llm_clients, model_for_plan, primary_provider_name
from iga_ai.deps.observability import log
from iga_ai.tools.client import NodeClient

MAX_TOOL_ROUNDS = 4


class StreamEvent:
    """Eventos emitidos no stream para o cliente (compativel com TS)."""

    @staticmethod
    def token(text: str) -> dict[str, str]:
        return {"type": "token", "text": text}

    @staticmethod
    def tool_call(name: str, args: dict[str, object]) -> dict[str, object]:
        return {"type": "tool_call", "name": name, "args": args}

    @staticmethod
    def done() -> dict[str, str]:
        return {"type": "done"}

    @staticmethod
    def error(message: str) -> dict[str, str]:
        return {"type": "error", "message": message}


def _stream_factory(provider_name: str):  # type: ignore[no-untyped-def]
    """Retorna o adapter de stream para o provider escolhido."""
    openai_client, anthropic_client = get_llm_clients()
    if provider_name == "anthropic":
        if anthropic_client is None:
            raise RuntimeError("Anthropic client nao disponivel")

        async def _wrap(**kwargs: Any) -> AsyncIterator[dict[str, Any]]:
            async for evt in stream_anthropic(client=anthropic_client, **kwargs):
                yield evt

        return _wrap

    if openai_client is None:
        raise RuntimeError("OpenAI client nao disponivel")

    async def _wrap(**kwargs: Any) -> AsyncIterator[dict[str, Any]]:
        async for evt in stream_openai(client=openai_client, **kwargs):
            yield evt

    return _wrap


async def run_agent(
    *,
    node_client: NodeClient,
    system_prompt: str,
    history: list[dict[str, str]],
    user_prompt: str,
    plan: str = "pro",
    provider: str | None = None,
) -> AsyncIterator[dict[str, object]]:
    """Roda o ciclo chat <-> tool-call ate resposta final ou MAX_TOOL_ROUNDS."""
    chosen_provider = provider or primary_provider_name()
    model = model_for_plan(plan)
    log.info("agent.start", provider=chosen_provider, model=model)

    streamer = _stream_factory(chosen_provider)

    messages: list[dict[str, Any]] = []
    for m in history:
        if m.get("role") in ("user", "assistant") and isinstance(m.get("content"), str):
            messages.append({"role": m["role"], "content": m["content"]})
    messages.append({"role": "user", "content": user_prompt})

    for round_idx in range(MAX_TOOL_ROUNDS):
        log.info("agent.round", round=round_idx + 1, model=model, provider=chosen_provider)
        tool_calls: list[dict[str, Any]] = []
        assistant_text_parts: list[str] = []
        had_error = False

        async for evt in streamer(
            system=system_prompt,
            messages=messages,
            tools=TOOL_DEFINITIONS,
            model=model,
            max_tokens=1024,
            temperature=0.3,
        ):
            if evt["type"] == "token":
                assistant_text_parts.append(str(evt["text"]))
                yield StreamEvent.token(str(evt["text"]))
            elif evt["type"] == "tool_call":
                tool_calls.append(evt)
            elif evt["type"] == "error":
                had_error = True
                yield StreamEvent.error(str(evt.get("message", "erro desconhecido")))
                return
            # 'done' eh implícito quando o stream encerra

        if had_error:
            return

        if not tool_calls:
            yield StreamEvent.done()
            return

        # Adiciona assistant message com tool_use blocks (formato interno)
        assistant_blocks: list[dict[str, Any]] = []
        if assistant_text_parts:
            assistant_blocks.append({"type": "text", "text": "".join(assistant_text_parts)})
        for tc in tool_calls:
            assistant_blocks.append(
                {"type": "tool_use", "id": tc["id"], "name": tc["name"], "input": tc["args"]}
            )
        messages.append({"role": "assistant", "content": assistant_blocks})

        # Executa tools em sequencia
        tool_results: list[dict[str, Any]] = []
        for tc in tool_calls:
            try:
                result = await node_client.call_tool(tc["name"], tc["args"])
                content_str = str(result)
                tool_results.append(
                    {"type": "tool_result", "tool_use_id": tc["id"], "content": content_str}
                )
            except Exception as exc:  # noqa: BLE001
                log.warning("agent.tool_error", tool=tc["name"], error=str(exc))
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": tc["id"],
                        "content": f'{{"error": "Falha ao executar tool: {exc}"}}',
                        "is_error": True,
                    }
                )

        messages.append({"role": "user", "content": tool_results})

    yield StreamEvent.done()
