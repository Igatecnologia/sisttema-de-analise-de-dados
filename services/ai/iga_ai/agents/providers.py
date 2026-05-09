"""Stream adapters por provider — converte API nativa em eventos uniformes.

Eventos uniformes:
    {"type": "token", "text": str}
    {"type": "tool_call", "id": str, "name": str, "args": dict}
    {"type": "done"}
    {"type": "error", "message": str}

Tools sao expressas em formato OpenAI tool_choice (que tambem mapeia
trivialmente para Anthropic). A normalizacao acontece dentro do adapter.
"""

import json
from typing import Any, AsyncIterator

from anthropic import AsyncAnthropic
from anthropic.types import InputJSONDelta, TextDelta
from openai import AsyncOpenAI


def to_openai_tools(tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Tools no formato OpenAI ja vem prontas — passthrough mas valida shape."""
    out = []
    for tool in tools:
        out.append(
            {
                "type": "function",
                "function": {
                    "name": tool["name"],
                    "description": tool.get("description", ""),
                    "parameters": tool.get("input_schema") or tool.get("parameters") or {"type": "object"},
                },
            }
        )
    return out


def to_anthropic_tools(tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Tools no formato Anthropic."""
    return [
        {
            "name": t["name"],
            "description": t.get("description", ""),
            "input_schema": t.get("input_schema") or t.get("parameters") or {"type": "object"},
        }
        for t in tools
    ]


def to_openai_messages(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Converte mensagens internas (formato Anthropic-ish) para formato OpenAI."""
    out: list[dict[str, Any]] = []
    for m in messages:
        role = m.get("role")
        content = m.get("content")
        if role == "user" and isinstance(content, list):
            # Tool results — virar role:'tool' por bloco
            for block in content:
                if isinstance(block, dict) and block.get("type") == "tool_result":
                    out.append(
                        {
                            "role": "tool",
                            "tool_call_id": block.get("tool_use_id", "unknown"),
                            "content": str(block.get("content", "")),
                        }
                    )
            continue
        if role == "assistant" and isinstance(content, list):
            tool_calls = [b for b in content if isinstance(b, dict) and b.get("type") == "tool_use"]
            text_parts = [b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text"]
            assistant_msg: dict[str, Any] = {"role": "assistant", "content": "".join(text_parts) or None}
            if tool_calls:
                assistant_msg["tool_calls"] = [
                    {
                        "id": tc.get("id", ""),
                        "type": "function",
                        "function": {
                            "name": tc.get("name", ""),
                            "arguments": json.dumps(tc.get("input", {})),
                        },
                    }
                    for tc in tool_calls
                ]
            out.append(assistant_msg)
            continue
        # User/assistant simples (string content)
        out.append({"role": role or "user", "content": content if isinstance(content, str) else str(content)})
    return out


async def stream_openai(
    *,
    client: AsyncOpenAI,
    system: str,
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]],
    model: str,
    max_tokens: int = 1024,
    temperature: float = 0.3,
) -> AsyncIterator[dict[str, Any]]:
    """OpenAI Chat Completions API com tool_calls e streaming."""
    full_messages: list[dict[str, Any]] = [{"role": "system", "content": system}]
    full_messages.extend(to_openai_messages(messages))

    tool_buffers: dict[int, dict[str, str]] = {}
    try:
        stream = await client.chat.completions.create(
            model=model,
            messages=full_messages,  # type: ignore[arg-type]
            tools=to_openai_tools(tools) if tools else None,  # type: ignore[arg-type]
            stream=True,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        async for chunk in stream:
            choice = chunk.choices[0] if chunk.choices else None
            if not choice:
                continue
            delta = choice.delta
            if delta.content:
                yield {"type": "token", "text": delta.content}
            if delta.tool_calls:
                for tc in delta.tool_calls:
                    idx = tc.index
                    buf = tool_buffers.setdefault(idx, {"id": "", "name": "", "args": ""})
                    if tc.id:
                        buf["id"] = tc.id
                    if tc.function and tc.function.name:
                        buf["name"] += tc.function.name
                    if tc.function and tc.function.arguments:
                        buf["args"] += tc.function.arguments
            if choice.finish_reason == "tool_calls":
                for buf in tool_buffers.values():
                    try:
                        args = json.loads(buf["args"]) if buf["args"] else {}
                    except json.JSONDecodeError:
                        args = {}
                    yield {
                        "type": "tool_call",
                        "id": buf["id"],
                        "name": buf["name"],
                        "args": args,
                    }
                tool_buffers.clear()
        yield {"type": "done"}
    except Exception as exc:  # noqa: BLE001
        yield {"type": "error", "message": f"OpenAI error: {exc}"}


async def stream_anthropic(
    *,
    client: AsyncAnthropic,
    system: str,
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]],
    model: str,
    max_tokens: int = 1024,
    temperature: float = 0.3,
) -> AsyncIterator[dict[str, Any]]:
    """Anthropic Messages API com content blocks e SSE."""
    try:
        async with client.messages.stream(
            model=model,
            system=system,
            messages=messages,  # type: ignore[arg-type]
            tools=to_anthropic_tools(tools) if tools else [],  # type: ignore[arg-type]
            max_tokens=max_tokens,
            temperature=temperature,
        ) as stream:
            async for event in stream:
                if event.type == "content_block_delta":
                    delta = event.delta
                    if isinstance(delta, TextDelta) and delta.text:
                        yield {"type": "token", "text": delta.text}
                    elif isinstance(delta, InputJSONDelta):
                        pass  # acumulado pelo SDK no final_message
            final_message = await stream.get_final_message()
        for block in final_message.content:
            if block.type == "tool_use":
                yield {
                    "type": "tool_call",
                    "id": block.id,
                    "name": block.name,
                    "args": block.input if isinstance(block.input, dict) else {},
                }
        yield {"type": "done"}
    except Exception as exc:  # noqa: BLE001
        yield {"type": "error", "message": f"Anthropic error: {exc}"}
