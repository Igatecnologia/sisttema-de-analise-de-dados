"""FastAPI app entrypoint."""

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from iga_ai.config import get_settings
from iga_ai.deps.observability import init_observability, log
from iga_ai.routes import chat, health


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    init_observability()
    settings = get_settings()
    log.info("iga_ai.starting", env=settings.env, port=settings.port)
    yield
    log.info("iga_ai.stopping")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="IGA Gestao IA",
        version="0.1.0",
        description="Microservice Python que executa o Copilot do IGA Gestao",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.node_backend_url],
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["authorization", "content-type", "x-ai-conversation-id"],
    )

    app.include_router(health.router, tags=["health"])
    app.include_router(chat.router, tags=["chat"])
    return app


app = create_app()
