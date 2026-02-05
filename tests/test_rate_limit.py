import os

from fastapi.testclient import TestClient

from album_conceptualizer.api.app import create_app
from album_conceptualizer.config import reset_settings


def test_rate_limit_blocks_after_threshold(monkeypatch):
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_RATE_LIMIT_ENABLED", "true")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_RATE_LIMIT_PER_MINUTE", "2")
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEY", raising=False)
    reset_settings()

    app = create_app()
    client = TestClient(app)

    # Health endpoints are exempt; use a protected route to trigger rate limit
    response = client.get("/api/v1/albums")
    assert response.status_code == 200
    response = client.get("/api/v1/albums")
    assert response.status_code == 200

    # Third request should be rate limited
    response = client.get("/api/v1/albums")
    assert response.status_code == 429


def test_rate_limit_exempts_health(monkeypatch):
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_RATE_LIMIT_ENABLED", "true")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_RATE_LIMIT_PER_MINUTE", "1")
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEY", raising=False)
    reset_settings()

    app = create_app()
    client = TestClient(app)

    # Health should remain available even with strict limits
    assert client.get("/api/v1/health").status_code == 200
    assert client.get("/api/v1/ready").status_code in (200, 503, 500)
    assert client.get("/api/v1/live").status_code == 200
