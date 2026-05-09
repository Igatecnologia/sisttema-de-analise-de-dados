"""Healthchecks: liveness + readiness."""

from fastapi import APIRouter

from iga_ai.config import get_settings

router = APIRouter()


@router.get("/health/live")
async def live() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/ready")
async def ready() -> dict[str, object]:
    settings = get_settings()
    checks = {
        "anthropic": bool(settings.anthropic_api_key),
        "shared_secret": bool(settings.iga_ai_shared_secret) or not settings.is_production,
        "node_backend_url": bool(settings.node_backend_url),
    }
    all_ok = all(checks.values())
    return {"status": "ok" if all_ok else "degraded", "checks": checks}
