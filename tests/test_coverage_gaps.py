"""Tests targeting remaining coverage gaps:
- app.py root/compat endpoints (lines 217, 227, 231, 235)
- albums.py search, update 404, delete 404, duplicate, null update (lines 100-101, 169, 174->173, 190, 204-225)
- health.py vector_store and llm readiness checks (lines 62, 67, 91)
- metrics.py record_error, to_dict no-requests, record without duration (lines 24->exit, 29, 33->35)
- storage.py InMemory*.delete noop branches (lines 75->exit, 92-93, 112-113)
"""

import pytest
from fastapi.testclient import TestClient

from album_conceptualizer.api.app import create_app
from album_conceptualizer.api.metrics import MetricsRegistry
from album_conceptualizer.config import reset_settings
from album_conceptualizer.storage import (
    InMemoryAlbumStore,
    InMemoryBibleStore,
    InMemorySubscriptionStore,
)


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_STORAGE_BACKEND", "memory")
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEY", raising=False)
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEYS", raising=False)
    reset_settings()
    app = create_app()
    with TestClient(app) as c:
        yield c
    reset_settings()


def _create_album(client: TestClient, title: str = "Test Album") -> str:
    resp = client.post("/api/v1/albums", json={"title": title, "artist": "Artist"})
    assert resp.status_code == 201
    return resp.json()["id"]


# ---------------------------------------------------------------------------
# App root/compat endpoints (app.py lines 217, 227, 231, 235)
# ---------------------------------------------------------------------------


class TestRootCompatEndpoints:
    def test_root_endpoint(self, client):
        """Covers app.py line 217: GET / returns service metadata."""
        resp = client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Album Conceptualizer API"
        assert "docs" in data

    def test_health_compat_endpoint(self, client):
        """Covers app.py line 227: GET /health compat proxies to health_check."""
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "healthy"

    def test_ready_compat_endpoint(self, client):
        """Covers app.py line 231: GET /ready compat proxies to readiness_check."""
        resp = client.get("/ready")
        assert resp.status_code == 200
        assert "ready" in resp.json()

    def test_live_compat_endpoint(self, client):
        """Covers app.py line 235: GET /live compat proxies to liveness_check."""
        resp = client.get("/live")
        assert resp.status_code == 200
        assert resp.json()["status"] == "alive"


# ---------------------------------------------------------------------------
# Albums: search, 404s, null update, duplicate (albums.py)
# ---------------------------------------------------------------------------


class TestAlbumsExtended:
    def test_list_albums_with_search_filter(self, client):
        """Covers albums.py lines 100-101: search term filters by title/artist."""
        _create_album(client, "Rock Opera")
        _create_album(client, "Jazz Fusion")
        resp = client.get("/api/v1/albums?search=rock")
        assert resp.status_code == 200
        data = resp.json()
        titles = [a["title"] for a in data["items"]]
        assert any("Rock" in t for t in titles)
        assert not any("Jazz" in t for t in titles)

    def test_list_albums_search_by_artist(self, client):
        """Covers albums.py lines 100-101: search also matches artist name."""
        resp = client.post(
            "/api/v1/albums",
            json={"title": "Untitled", "artist": "Radiohead"},
        )
        assert resp.status_code == 201
        resp = client.get("/api/v1/albums?search=radiohead")
        assert resp.status_code == 200
        titles = [a["title"] for a in resp.json()["items"]]
        assert "Untitled" in titles

    def test_update_album_not_found_returns_404(self, client):
        """Covers albums.py line 169: PATCH non-existent album → 404."""
        resp = client.patch("/api/v1/albums/nonexistent-id", json={"title": "New Title"})
        assert resp.status_code == 404

    def test_update_album_with_explicit_null_skips_setattr(self, client):
        """Covers albums.py line 174->173 False branch: null value is not applied."""
        album_id = _create_album(client, "Has Artist Album")
        # Setting artist to null explicitly — covers if value is not None: False branch
        resp = client.patch(f"/api/v1/albums/{album_id}", json={"artist": None})
        assert resp.status_code == 200

    def test_delete_album_not_found_returns_404(self, client):
        """Covers albums.py line 190: DELETE non-existent album → 404."""
        resp = client.delete("/api/v1/albums/nonexistent-id")
        assert resp.status_code == 404

    def test_duplicate_album_success(self, client):
        """Covers albums.py lines 204-225: duplicate_album endpoint success path."""
        album_id = _create_album(client, "Original Album")
        resp = client.post(f"/api/v1/albums/{album_id}/duplicate")
        assert resp.status_code == 201
        dup = resp.json()
        assert "(Copy)" in dup["title"]

    def test_duplicate_album_with_custom_title(self, client):
        """Covers albums.py line 211: new_title overrides default copy title."""
        album_id = _create_album(client, "Source Album")
        resp = client.post(
            f"/api/v1/albums/{album_id}/duplicate",
            params={"new_title": "My Copy"},
        )
        assert resp.status_code == 201
        assert resp.json()["title"] == "My Copy"

    def test_duplicate_album_copies_songs(self, client):
        """Covers albums.py lines 221-222: songs are deep-copied during duplicate."""
        album_id = _create_album(client, "Album With Songs")
        client.post(
            f"/api/v1/albums/{album_id}/songs",
            json={"title": "Track 1", "track_number": 1},
        )
        resp = client.post(f"/api/v1/albums/{album_id}/duplicate")
        assert resp.status_code == 201
        assert resp.json()["song_count"] == 1

    def test_duplicate_album_not_found_returns_404(self, client):
        """Covers albums.py line 207: duplicate non-existent album → 404."""
        resp = client.post("/api/v1/albums/nonexistent/duplicate")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Health readiness — vector_store and llm checks (health.py lines 62, 67)
# ---------------------------------------------------------------------------


class TestHealthReadinessExtended:
    def test_readiness_with_vector_store_truthy(self, client):
        """Covers health.py line 62: vector_store check is True when app.state.vector_store set."""
        client.app.state.vector_store = "mocked_store"
        resp = client.get("/api/v1/ready")
        client.app.state.vector_store = None
        assert resp.status_code == 200
        assert resp.json()["checks"]["vector_store"] is True

    def test_readiness_with_anthropic_api_key(self, monkeypatch):
        """Covers health.py line 67: llm check True when ANTHROPIC_API_KEY is set."""
        monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test-key-for-coverage")
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_STORAGE_BACKEND", "memory")
        monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEY", raising=False)
        monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEYS", raising=False)
        reset_settings()
        app = create_app()
        with TestClient(app) as c:
            resp = c.get("/api/v1/ready")
        reset_settings()
        assert resp.status_code == 200
        assert resp.json()["checks"]["llm"] is True

    def test_metrics_endpoint_when_metrics_unavailable(self, client):
        """Covers health.py line 91: return 'Metrics unavailable' when registry is None."""
        saved = client.app.state.metrics
        client.app.state.metrics = None
        resp = client.get("/api/v1/metrics")
        client.app.state.metrics = saved
        assert resp.status_code == 200
        assert resp.json() == {"detail": "Metrics unavailable"}


# ---------------------------------------------------------------------------
# MetricsRegistry direct unit tests (metrics.py lines 24->exit, 29, 33->35)
# ---------------------------------------------------------------------------


class TestMetricsRegistryDirect:
    def test_record_without_duration_does_not_add_to_total(self):
        """Covers metrics.py line 24->exit: False branch of `if duration_ms is not None`."""
        registry = MetricsRegistry()
        registry.record("/api/test", 200)  # No duration_ms argument
        assert registry.total_duration_ms == 0.0
        assert registry.request_count == 1

    def test_record_error_increments_error_count(self):
        """Covers metrics.py line 29: record_error()."""
        registry = MetricsRegistry()
        assert registry.error_count == 0
        registry.record_error()
        assert registry.error_count == 1

    def test_to_dict_with_no_requests_returns_zero_avg(self):
        """Covers metrics.py line 33->35: avg_duration stays 0.0 when request_count == 0."""
        registry = MetricsRegistry()
        result = registry.to_dict()
        assert result["avg_duration_ms"] == 0.0
        assert result["request_count"] == 0


# ---------------------------------------------------------------------------
# InMemory*.delete — False branch when key not present (storage.py)
# ---------------------------------------------------------------------------


class TestInMemoryStoreDeleteNoop:
    def test_album_store_delete_nonexistent_is_noop(self):
        """Covers storage.py line 75->exit: delete non-existent album_id silently succeeds."""
        store = InMemoryAlbumStore()
        store.delete("does-not-exist")  # Should not raise

    def test_bible_store_delete_nonexistent_is_noop(self):
        """Covers storage.py lines 92-93: delete non-existent bible silently succeeds."""
        store = InMemoryBibleStore()
        store.delete("does-not-exist")

    def test_subscription_store_delete_nonexistent_is_noop(self):
        """Covers storage.py lines 112-113: delete non-existent subscription silently succeeds."""
        store = InMemorySubscriptionStore()
        store.delete("does-not-exist")
