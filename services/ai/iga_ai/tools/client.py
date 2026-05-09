"""Cliente HTTP para chamar tools no Node backend.

Cada chamada vai com o JWT shared secret recebido do request entrante.
O Node valida o JWT, aplica RLS via app.current_tenant_id e retorna JSON.

Retry exponencial em 5xx/timeout — nao em 4xx (erro logico do agent).
"""

from typing import Any

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from iga_ai.config import get_settings


class NodeClient:
    """Cliente HTTP fino para chamar /api/v1/_internal/tools/* no backend Node."""

    def __init__(self, jwt_shared: str, conversation_id: str | None = None) -> None:
        self._jwt = jwt_shared
        self._conv = conversation_id

    @property
    def _headers(self) -> dict[str, str]:
        h = {
            "Authorization": f"Bearer {self._jwt}",
            "Content-Type": "application/json",
        }
        if self._conv:
            h["X-AI-Conversation-Id"] = self._conv
        return h

    @property
    def _base_url(self) -> str:
        return get_settings().node_backend_url.rstrip("/")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=4),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
        reraise=True,
    )
    async def call_tool(
        self,
        tool_name: str,
        args: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Chama POST /api/v1/_internal/tools/{tool_name} no Node.

        Args sao enviados como JSON body. Retorna o JSON do Node como dict.
        Erros HTTP nao-2xx levantam httpx.HTTPStatusError.
        """
        url = f"{self._base_url}/api/v1/_internal/tools/{tool_name}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=args or {}, headers=self._headers)
            response.raise_for_status()
            data = response.json()
            return data if isinstance(data, dict) else {"result": data}
