"""asyncpg pool — conexao com o mesmo Postgres do backend Node.

RLS eh aplicado SET LOCAL app.current_tenant_id ANTES de cada query
(quando aplicavel). Para a maioria dos casos, iga-ai NAO toca o banco
diretamente — usa o cliente HTTP para Node, que ja aplica RLS.

Uso direto so no AI-4 (RAG, ai_documents, ai_usage).
"""

from contextlib import asynccontextmanager
from typing import AsyncIterator

import asyncpg

from iga_ai.config import get_settings

_pool: asyncpg.Pool | None = None


async def init_pool() -> asyncpg.Pool:
    global _pool
    if _pool is not None:
        return _pool
    settings = get_settings()
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL nao configurado")
    _pool = await asyncpg.create_pool(settings.database_url, min_size=2, max_size=10)
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("pool nao inicializado — chame init_pool() no startup")
    return _pool


@asynccontextmanager
async def tenant_connection(tenant_id: str) -> AsyncIterator[asyncpg.Connection]:
    """Adquire conexao do pool com RLS configurado para o tenant."""
    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("SELECT set_config('app.current_tenant_id', $1, true)", tenant_id)
            yield conn
