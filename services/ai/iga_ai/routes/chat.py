"""POST /chat — endpoint principal do agente.

Recebe historico + prompt do usuario, valida JWT shared, e retorna
streaming SSE de eventos {token, tool_call, done, error}.
"""

import json
from typing import AsyncIterator

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse  # type: ignore[import-untyped]

from iga_ai.agents.copilot import run_agent
from iga_ai.agents.prompts import build_dynamic_system_prompt
from iga_ai.deps.auth import CurrentClaims
from iga_ai.deps.observability import log
from iga_ai.tools.client import NodeClient

router = APIRouter()


class HistoryMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    user_prompt: str = Field(min_length=1, max_length=4000)
    history: list[HistoryMessage] = Field(default_factory=list, max_length=40)
    user_name: str | None = None
    monthly_goal: float | None = None
    session_id: str | None = None


@router.post("/chat")
async def chat(
    body: ChatRequest,
    claims: CurrentClaims,
    request: Request,
) -> EventSourceResponse:
    log.info(
        "chat.request",
        tenant_id=claims.tid,
        user_id=claims.sub,
        plan=claims.plan,
        history_len=len(body.history),
        prompt_len=len(body.user_prompt),
    )

    # Extrai o JWT original (string) para repassar ao Node
    auth_header = request.headers.get("authorization", "")
    jwt_shared = auth_header[7:].strip() if auth_header.lower().startswith("bearer ") else ""
    if not jwt_shared:
        raise HTTPException(status_code=401, detail="missing_bearer_for_tools")

    user_name = body.user_name or claims.name or "Usuário"
    system_prompt = build_dynamic_system_prompt(
        user_name=user_name,
        user_role=claims.role,
        monthly_goal=body.monthly_goal,
    )

    node_client = NodeClient(jwt_shared=jwt_shared, conversation_id=body.session_id)

    async def event_generator() -> AsyncIterator[dict[str, str]]:
        try:
            async for evt in run_agent(
                node_client=node_client,
                system_prompt=system_prompt,
                history=[m.model_dump() for m in body.history],
                user_prompt=body.user_prompt,
                plan=claims.plan,
            ):
                yield {"event": str(evt.get("type", "token")), "data": json.dumps(evt)}
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except Exception as exc:  # noqa: BLE001
            log.error("chat.fatal", error=str(exc))
            yield {"event": "error", "data": json.dumps({"type": "error", "message": str(exc)})}

    return EventSourceResponse(event_generator())
