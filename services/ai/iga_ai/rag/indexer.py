"""Indexer — popula ai_documents com embeddings das entidades do tenant.

Stub do AI-4. Em producao roda como Celery task:
- Faturamento mensal: 1 doc por mes × tenant (gerado por job nightly)
- Alerts: 1 doc por alerta resolvido (trigger a cada 15min)
- Audit log: 1 doc por acao admin relevante (trigger)
- Scheduled reports: snapshots dos relatorios gerados
- Saved views: views salvas pelo usuario
- Onboarding: goal/segment/companySize do tenant

Cada doc tem: tenant_id, entity_type, entity_id, content (texto Jinja2),
metadata JSON, embedding (Voyage 1024-dim), tsv (FTS portugues).
"""

import json
from typing import Any

from iga_ai.deps.db import tenant_connection
from iga_ai.deps.observability import log
from iga_ai.rag.embeddings import embed


async def index_document(
    *,
    tenant_id: str,
    entity_type: str,
    entity_id: str,
    content: str,
    metadata: dict[str, Any] | None = None,
) -> None:
    """Insere ou atualiza um documento RAG para o tenant."""
    embedding = await embed(content, input_type="document")
    embedding_vector = embedding[0]
    async with tenant_connection(tenant_id) as conn:
        await conn.execute(
            """
            INSERT INTO ai_documents (tenant_id, entity_type, entity_id, content, metadata, embedding, updated_at)
            VALUES ($1, $2, $3, $4, $5::jsonb, $6, now())
            ON CONFLICT (tenant_id, entity_type, entity_id) DO UPDATE SET
              content = EXCLUDED.content,
              metadata = EXCLUDED.metadata,
              embedding = EXCLUDED.embedding,
              updated_at = now()
            """,
            tenant_id,
            entity_type,
            entity_id,
            content,
            json.dumps(metadata or {}),
            embedding_vector,
        )
        log.info("rag.indexed", tenant_id=tenant_id, entity_type=entity_type, entity_id=entity_id)


async def reindex_tenant(tenant_id: str) -> int:
    """Reindexa todas entidades de um tenant. CLI: scripts/index_tenant.py.

    Stub — implementacao real busca entidades do Node REST e indexa em loop.
    """
    log.info("rag.reindex_tenant_stub", tenant_id=tenant_id)
    return 0
