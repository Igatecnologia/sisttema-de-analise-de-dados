"""Smoke tests para /health/* endpoints."""

from fastapi.testclient import TestClient

from iga_ai.main import app


def test_health_live() -> None:
    client = TestClient(app)
    response = client.get("/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_ready_returns_status() -> None:
    client = TestClient(app)
    response = client.get("/health/ready")
    assert response.status_code == 200
    body = response.json()
    assert "status" in body
    assert "checks" in body
