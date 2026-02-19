"""Integration tests for authentication and authorization workflows."""

import pytest
from fastapi.testclient import TestClient

from album_conceptualizer.api.app import create_app
from album_conceptualizer.config import reset_settings


@pytest.fixture
def no_auth_client(monkeypatch):
    """Client with no API key configured — all requests succeed."""
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEY", raising=False)
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEYS", raising=False)
    reset_settings()
    app = create_app()
    with TestClient(app) as c:
        yield c
    reset_settings()


@pytest.fixture
def keyed_client(monkeypatch):
    """Client with API key 'test-secret' enforced."""
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_API_KEY", "test-secret")
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEYS", raising=False)
    reset_settings()
    app = create_app()
    with TestClient(app) as c:
        yield c
    reset_settings()


@pytest.fixture
def multi_key_client(monkeypatch):
    """Client with two valid API keys."""
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_API_KEYS", '["key-alpha","key-beta"]')
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEY", raising=False)
    reset_settings()
    app = create_app()
    with TestClient(app) as c:
        yield c
    reset_settings()


@pytest.fixture
def sub_client(monkeypatch):
    """Client with subscription gating enabled."""
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_SUBSCRIPTION_REQUIRED", "true")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_API_KEY", "sub-key")
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEYS", raising=False)
    reset_settings()
    app = create_app()
    with TestClient(app) as c:
        yield c
    reset_settings()


@pytest.mark.integration
class TestNoAuthConfiguration:
    """When no API key is configured every request succeeds."""

    def test_albums_list_accessible(self, no_auth_client):
        assert no_auth_client.get("/api/v1/albums").status_code == 200

    def test_create_album_succeeds(self, no_auth_client):
        resp = no_auth_client.post(
            "/api/v1/albums",
            json={"title": "Open Album", "artist": "Anyone"},
        )
        assert resp.status_code == 201

    def test_health_endpoints_accessible(self, no_auth_client):
        assert no_auth_client.get("/api/v1/health").status_code == 200
        assert no_auth_client.get("/api/v1/live").status_code == 200


@pytest.mark.integration
class TestApiKeyAuthentication:
    """When an API key is configured it must be presented correctly."""

    def test_no_key_returns_401(self, keyed_client):
        assert keyed_client.get("/api/v1/albums").status_code == 401

    def test_wrong_key_returns_401(self, keyed_client):
        resp = keyed_client.get("/api/v1/albums", headers={"X-API-Key": "wrong"})
        assert resp.status_code == 401

    def test_correct_xapi_key_header_succeeds(self, keyed_client):
        resp = keyed_client.get("/api/v1/albums", headers={"X-API-Key": "test-secret"})
        assert resp.status_code == 200

    def test_bearer_auth_header_succeeds(self, keyed_client):
        resp = keyed_client.get(
            "/api/v1/albums",
            headers={"Authorization": "Bearer test-secret"},
        )
        assert resp.status_code == 200

    def test_health_exempt_from_auth(self, keyed_client):
        assert keyed_client.get("/api/v1/health").status_code == 200
        assert keyed_client.get("/api/v1/live").status_code == 200

    def test_create_with_correct_key_succeeds(self, keyed_client):
        resp = keyed_client.post(
            "/api/v1/albums",
            json={"title": "Auth Album", "artist": "Authenticated"},
            headers={"X-API-Key": "test-secret"},
        )
        assert resp.status_code == 201
        assert resp.json()["title"] == "Auth Album"

    def test_full_crud_with_api_key(self, keyed_client):
        """Create → read → update → delete using a consistent API key."""
        headers = {"X-API-Key": "test-secret"}

        album_id = keyed_client.post(
            "/api/v1/albums",
            json={"title": "CRUD Album", "artist": "Artist"},
            headers=headers,
        ).json()["id"]

        assert keyed_client.get(f"/api/v1/albums/{album_id}", headers=headers).status_code == 200

        updated = keyed_client.patch(
            f"/api/v1/albums/{album_id}",
            json={"title": "CRUD Updated"},
            headers=headers,
        )
        assert updated.status_code == 200
        assert updated.json()["title"] == "CRUD Updated"

        assert keyed_client.delete(f"/api/v1/albums/{album_id}", headers=headers).status_code == 204
        assert keyed_client.get(f"/api/v1/albums/{album_id}", headers=headers).status_code == 404


@pytest.mark.integration
class TestMultipleApiKeys:
    """Multiple valid keys can be configured via ALBUM_CONCEPTUALIZER_API_KEYS."""

    def test_first_key_accepted(self, multi_key_client):
        resp = multi_key_client.get("/api/v1/albums", headers={"X-API-Key": "key-alpha"})
        assert resp.status_code == 200

    def test_second_key_accepted(self, multi_key_client):
        resp = multi_key_client.get("/api/v1/albums", headers={"X-API-Key": "key-beta"})
        assert resp.status_code == 200

    def test_unknown_key_rejected(self, multi_key_client):
        resp = multi_key_client.get("/api/v1/albums", headers={"X-API-Key": "key-gamma"})
        assert resp.status_code == 401


@pytest.mark.integration
class TestSubscriptionGating:
    """When ALBUM_CONCEPTUALIZER_SUBSCRIPTION_REQUIRED=true, unpaid requests are blocked."""

    def test_no_token_returns_401(self, sub_client):
        assert sub_client.get("/api/v1/albums").status_code == 401

    def test_valid_key_without_subscription_returns_402(self, sub_client):
        resp = sub_client.get("/api/v1/albums", headers={"X-API-Key": "sub-key"})
        assert resp.status_code == 402

    def test_health_exempt_from_subscription_check(self, sub_client):
        assert sub_client.get("/api/v1/health").status_code == 200
        assert sub_client.get("/api/v1/live").status_code == 200
