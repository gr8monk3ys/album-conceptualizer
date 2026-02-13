"""Tests for strict production safety guardrails."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from album_conceptualizer.api.app import create_app
from album_conceptualizer.config import reset_settings


def _clear_prod_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in [
        "ALBUM_CONCEPTUALIZER_STRICT_PRODUCTION",
        "ALBUM_CONCEPTUALIZER_API_KEY",
        "ALBUM_CONCEPTUALIZER_API_KEYS",
        "ALBUM_CONCEPTUALIZER_CORS_ORIGINS",
        "ALBUM_CONCEPTUALIZER_STORAGE_BACKEND",
        "ALBUM_CONCEPTUALIZER_STORAGE_DB",
        "ALBUM_CONCEPTUALIZER_COLLAB_REALTIME_BACKEND",
        "ALBUM_CONCEPTUALIZER_COLLAB_REALTIME_TTL_SECONDS",
        "ALBUM_CONCEPTUALIZER_REDIS_URL",
        "ALBUM_CONCEPTUALIZER_SUBSCRIPTION_REQUIRED",
        "STRIPE_SECRET_KEY",
        "STRIPE_WEBHOOK_SECRET",
    ]:
        monkeypatch.delenv(name, raising=False)


def test_strict_production_rejects_insecure_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    _clear_prod_env(monkeypatch)
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_STRICT_PRODUCTION", "true")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_CORS_ORIGINS", '["*"]')
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_STORAGE_BACKEND", "memory")
    reset_settings()
    with pytest.raises(RuntimeError, match="Strict production validation failed"):
        create_app()
    reset_settings()


def test_strict_production_rejects_redis_collab_without_redis_url(
    monkeypatch: pytest.MonkeyPatch, tmp_path
) -> None:
    _clear_prod_env(monkeypatch)
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_STRICT_PRODUCTION", "true")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_API_KEY", "prod-key")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_CORS_ORIGINS", '["https://app.example.com"]')
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_STORAGE_BACKEND", "sqlite")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_STORAGE_DB", str(tmp_path / "prod.db"))
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_COLLAB_REALTIME_BACKEND", "redis")
    reset_settings()
    with pytest.raises(RuntimeError, match="Strict production validation failed"):
        create_app()
    reset_settings()


def test_strict_production_accepts_secure_configuration(
    monkeypatch: pytest.MonkeyPatch, tmp_path
) -> None:
    _clear_prod_env(monkeypatch)
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_STRICT_PRODUCTION", "true")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_API_KEY", "prod-key")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_CORS_ORIGINS", '["https://app.example.com"]')
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_STORAGE_BACKEND", "sqlite")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_STORAGE_DB", str(tmp_path / "prod.db"))
    reset_settings()

    app = create_app()
    with TestClient(app) as client:
        response = client.get("/api/v1/health")
        assert response.status_code == 200

    reset_settings()
