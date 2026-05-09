"""Tests para JWT shared secret validation."""

import time
from typing import Any

import jwt
import pytest
from fastapi.testclient import TestClient

from iga_ai.main import app


def _make_token(secret: str, **overrides: Any) -> str:
    payload = {
        "iss": "iga-backend",
        "aud": "iga-ai",
        "sub": "u_test",
        "tid": "tenant_a",
        "role": "admin",
        "plan": "pro",
        "iat": int(time.time()),
        "exp": int(time.time()) + 60,
    }
    payload.update(overrides)
    return jwt.encode(payload, secret, algorithm="HS256")


def test_chat_requires_authorization_header(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENV", "development")
    monkeypatch.setenv("IGA_AI_SHARED_SECRET", "test-secret-not-real-32bytes-fake")
    from iga_ai.config import get_settings

    get_settings.cache_clear()

    client = TestClient(app)
    response = client.post("/chat", json={"user_prompt": "oi"})
    assert response.status_code == 401


def test_chat_rejects_expired_token(monkeypatch: pytest.MonkeyPatch) -> None:
    secret = "test-secret-not-real-32bytes-fake"
    monkeypatch.setenv("IGA_AI_SHARED_SECRET", secret)
    from iga_ai.config import get_settings

    get_settings.cache_clear()

    expired = _make_token(secret, exp=int(time.time()) - 60)
    client = TestClient(app)
    response = client.post(
        "/chat",
        json={"user_prompt": "oi"},
        headers={"Authorization": f"Bearer {expired}"},
    )
    assert response.status_code == 401
