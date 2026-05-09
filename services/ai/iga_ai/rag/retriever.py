"""Retriever híbrido — FTS portugues + vector cosine + Voyage rerank-2.

Aplica Reciprocal Rank Fusion antes do rerank para combinar os dois canais
de busca (textual e semantica). Retorna top_k documentos.

Stub funcional do AI-4 — pronto para usar quando ai_documents estiver
populado e VOYAGE_API_KEY configurado.
"""

from dataclasses import dataclass
from typing import Any

from iga_ai.deps.db import tenant_connection
from iga_ai.rag.embeddings import embed, rerank


@dataclass
class RagDocument:
    id: int
    entity_type: str
    entity_id: str
    content: str
    metadata: dict[str, Any]
    score: float


def reciprocal_rank_fusion(
    rankings: list[list[tuple[int, float]]],
    k: int = 60,
) -> list[tuple[int, float]]:
    """RRF: cada item ganha sum(1/(k + rank_i)) sobre todas as listas.

    Robusto a scores de escalas diferentes (cosine 0..1 vs ts_rank arbitrary).
    """
    scores: dict[int, float] = {}
    for ranking in rankings:
        for rank, (doc_id, _score) in enumerate(ranking, start=1):
            scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank)
    return sorted(scores.items(), key=lambda x: x[1], reverse=True)


async def retrieve(query: str, tenant_id: str, k: int = 8) -> list[RagDocument]:
    """Busca hibrida + rerank. Devolve top_k docs ordenados por relevancia."""
    q_embedding = (await embed(query, input_type="query"))[0]

    async with tenant_connection(tenant_id) as conn:
        vector_rows = await conn.fetch(
            """
            SELECT id, entity_type, entity_id, content, metadata, 1 - (embedding <=> $1) AS score
            FROM ai_documents
            WHERE tenant_id = $2 AND embedding IS NOT NULL
            ORDER BY embedding <=> $1
            LIMIT 20
            """,
            q_embedding,
            tenant_id,
        )
        fts_rows = await conn.fetch(
            """
            SELECT id, entity_type, entity_id, content, metadata,
                   ts_rank_cd(content_tsv, plainto_tsquery('portuguese', $1)) AS score
            FROM ai_documents
            WHERE tenant_id = $2 AND content_tsv @@ plainto_tsquery('portuguese', $1)
            ORDER BY score DESC
            LIMIT 20
            """,
            query,
            tenant_id,
        )

    by_id: dict[int, RagDocument] = {}
    for row in [*vector_rows, *fts_rows]:
        if row["id"] not in by_id:
            by_id[row["id"]] = RagDocument(
                id=row["id"],
                entity_type=row["entity_type"],
                entity_id=row["entity_id"],
                content=row["content"],
                metadata=dict(row["metadata"] or {}),
                score=0.0,
            )

    fused = reciprocal_rank_fusion(
        [
            [(r["id"], r["score"]) for r in vector_rows],
            [(r["id"], r["score"]) for r in fts_rows],
        ]
    )
    if not fused:
        return []

    candidate_docs = [by_id[doc_id] for doc_id, _ in fused if doc_id in by_id]
    if len(candidate_docs) <= k:
        for doc, (_, fused_score) in zip(candidate_docs, fused, strict=False):
            doc.score = fused_score
        return candidate_docs

    rerank_results = await rerank(query, [d.content for d in candidate_docs], top_k=k)
    final = []
    for index, score in rerank_results:
        doc = candidate_docs[index]
        doc.score = score
        final.append(doc)
    return final
