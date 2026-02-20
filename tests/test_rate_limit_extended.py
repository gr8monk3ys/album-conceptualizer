"""Extended tests for InMemoryRateLimiter middleware."""

from fastapi.testclient import TestClient

from album_conceptualizer.api.app import create_app
from album_conceptualizer.config import reset_settings


def _make_rate_limited_client(monkeypatch, max_per_minute: int = 1):
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEY", raising=False)
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEYS", raising=False)
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_RATE_LIMIT_ENABLED", "true")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_RATE_LIMIT_PER_MINUTE", str(max_per_minute))
    reset_settings()
    return TestClient(create_app())


class TestInMemoryRateLimiter:
    def test_rate_limit_exceeded_returns_429(self, monkeypatch):
        with _make_rate_limited_client(monkeypatch, max_per_minute=1) as client:
            resp1 = client.get("/api/v1/albums")
            resp2 = client.get("/api/v1/albums")
        reset_settings()
        assert resp1.status_code in (200, 401)
        assert resp2.status_code == 429

    def test_health_endpoint_exempt_from_rate_limit(self, monkeypatch):
        with _make_rate_limited_client(monkeypatch, max_per_minute=1) as client:
            # Exhaust rate limit
            client.get("/api/v1/albums")
            # Health should still work
            resp = client.get("/api/v1/health")
        reset_settings()
        assert resp.status_code == 200

    def test_ready_endpoint_exempt_from_rate_limit(self, monkeypatch):
        with _make_rate_limited_client(monkeypatch, max_per_minute=1) as client:
            client.get("/api/v1/albums")
            resp = client.get("/api/v1/ready")
        reset_settings()
        assert resp.status_code == 200

    def test_live_endpoint_exempt_from_rate_limit(self, monkeypatch):
        with _make_rate_limited_client(monkeypatch, max_per_minute=1) as client:
            client.get("/api/v1/albums")
            resp = client.get("/api/v1/live")
        reset_settings()
        assert resp.status_code == 200

    def test_root_probe_endpoints_exempt_from_rate_limit(self, monkeypatch):
        with _make_rate_limited_client(monkeypatch, max_per_minute=1) as client:
            client.get("/api/v1/albums")
            health_resp = client.get("/health")
            ready_resp = client.get("/ready")
            live_resp = client.get("/live")
        reset_settings()
        assert health_resp.status_code == 200
        assert ready_resp.status_code == 200
        assert live_resp.status_code == 200

    def test_rate_limit_response_includes_header(self, monkeypatch):
        with _make_rate_limited_client(monkeypatch, max_per_minute=1) as client:
            client.get("/api/v1/albums")
            resp = client.get("/api/v1/albums")
        reset_settings()
        assert resp.status_code == 429
        assert resp.headers.get("x-rate-limited") == "true"

    def test_successful_request_has_rate_limited_false_header(self, monkeypatch):
        with _make_rate_limited_client(monkeypatch, max_per_minute=5) as client:
            resp = client.get("/api/v1/albums")
        reset_settings()
        assert resp.headers.get("x-rate-limited") == "false"

    def test_bearer_token_as_rate_limit_key(self, monkeypatch):
        """Bearer token should be used as the per-client rate limit key."""
        with _make_rate_limited_client(monkeypatch, max_per_minute=1) as client:
            resp1 = client.get(
                "/api/v1/albums",
                headers={"Authorization": "Bearer rate-test-token"},
            )
            resp2 = client.get(
                "/api/v1/albums",
                headers={"Authorization": "Bearer rate-test-token"},
            )
        reset_settings()
        assert resp1.status_code in (200, 401)
        assert resp2.status_code == 429

    def test_x_api_key_header_as_rate_limit_key(self, monkeypatch):
        """X-API-Key header should be used as the per-client rate limit key."""
        with _make_rate_limited_client(monkeypatch, max_per_minute=1) as client:
            resp1 = client.get(
                "/api/v1/albums",
                headers={"X-API-Key": "my-api-key-xyz"},
            )
            resp2 = client.get(
                "/api/v1/albums",
                headers={"X-API-Key": "my-api-key-xyz"},
            )
        reset_settings()
        assert resp1.status_code in (200, 401)
        assert resp2.status_code == 429

    def test_different_keys_have_separate_limits(self, monkeypatch):
        """Different API keys should have independent rate limits."""
        with _make_rate_limited_client(monkeypatch, max_per_minute=1) as client:
            r1 = client.get("/api/v1/albums", headers={"X-API-Key": "key-alpha"})
            r2 = client.get("/api/v1/albums", headers={"X-API-Key": "key-beta"})
        reset_settings()
        assert r1.status_code in (200, 401)
        assert r2.status_code in (200, 401)

    def test_rate_limit_disabled_allows_many_requests(self, monkeypatch):
        monkeypatch.delenv("ALBUM_CONCEPTUALIZER_RATE_LIMIT_ENABLED", raising=False)
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_RATE_LIMIT_PER_MINUTE", "1")
        reset_settings()
        with TestClient(create_app()) as client:
            for _ in range(5):
                resp = client.get("/api/v1/health")
                assert resp.status_code == 200
        reset_settings()

    def test_exceeded_rate_limit_has_correct_detail(self, monkeypatch):
        with _make_rate_limited_client(monkeypatch, max_per_minute=1) as client:
            client.get("/api/v1/albums")
            resp = client.get("/api/v1/albums")
        reset_settings()
        assert resp.status_code == 429
        data = resp.json()
        assert "rate limit" in data.get("detail", "").lower()


class TestQuotaWithApiKeyHeader:
    """Ensure x-api-key header is used as the quota key (covers branch 31→35)."""

    def test_x_api_key_header_used_as_quota_key(self, monkeypatch):
        monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEY", raising=False)
        monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEYS", raising=False)
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_QUOTA_ENABLED", "true")
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_QUOTA_DAILY_LIMIT", "1")
        reset_settings()
        with TestClient(create_app()) as client:
            resp1 = client.get("/api/v1/albums", headers={"X-API-Key": "quota-key-abc"})
            resp2 = client.get("/api/v1/albums", headers={"X-API-Key": "quota-key-abc"})
        reset_settings()
        assert resp1.status_code in (200, 401)
        assert resp2.status_code == 429
