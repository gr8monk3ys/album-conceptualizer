from fastapi.testclient import TestClient

from album_conceptualizer.api.app import create_app
from album_conceptualizer.config import reset_settings


def test_quota_blocks_after_limit(monkeypatch):
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_QUOTA_ENABLED", "true")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_QUOTA_DAILY_LIMIT", "2")
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEY", raising=False)
    reset_settings()

    app = create_app()
    client = TestClient(app)

    assert client.get("/api/v1/albums").status_code == 200
    assert client.get("/api/v1/albums").status_code == 200

    response = client.get("/api/v1/albums")
    assert response.status_code == 429
    assert response.headers.get("X-Quota-Remaining") == "0"


def test_quota_exempts_health(monkeypatch):
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_QUOTA_ENABLED", "true")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_QUOTA_DAILY_LIMIT", "1")
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEY", raising=False)
    reset_settings()

    app = create_app()
    client = TestClient(app)

    assert client.get("/api/v1/health").status_code == 200
    assert client.get("/api/v1/ready").status_code in (200, 503, 500)
    assert client.get("/api/v1/live").status_code == 200
