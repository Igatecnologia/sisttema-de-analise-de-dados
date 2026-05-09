"""Cliente Voyage AI para embeddings + reranking.

Stub do AI-4. Para ativar:
- VOYAGE_API_KEY no env
- voyage-3-large (1024 dims) — recomendado pela Anthropic
"""

from typing import Literal

import httpx

from iga_ai.config import get_settings

VOYAGE_BASE_URL = "https://api.voyageai.com/v1"


async def embed(
    text: str | list[str],
    *,
    input_type: Literal["query", "document"] = "document",
) -> list[list[float]]:
    """Gera embeddings via Voyage AI. Retorna lista de vetores (1024 dims)."""
    settings = get_settings()
    if not settings.voyage_api_key:
        raise RuntimeError("VOYAGE_API_KEY nao configurado")
    inputs = [text] if isinstance(text, str) else text
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            f"{VOYAGE_BASE_URL}/embeddings",
            headers={
                "Authorization": f"Bearer {settings.voyage_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "input": inputs,
                "model": settings.voyage_model,
                "input_type": input_type,
            },
        )
        response.raise_for_status()
        data = response.json()
        return [item["embedding"] for item in data["data"]]


async def rerank(query: str, documents: list[str], top_k: int = 8) -> list[tuple[int, float]]:
    """Reordena documentos por relevancia. Retorna [(index, score)] top_k."""
    settings = get_settings()
    if not settings.voyage_api_key:
        raise RuntimeError("VOYAGE_API_KEY nao configurado")
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            f"{VOYAGE_BASE_URL}/rerank",
            headers={
                "Authorization": f"Bearer {settings.voyage_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "query": query,
                "documents": documents,
                "model": "rerank-2",
                "top_k": top_k,
            },
        )
        response.raise_for_status()
        data = response.json()
        return [(item["index"], item["relevance_score"]) for item in data["data"]]
