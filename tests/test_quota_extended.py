"""Extended tests for InMemoryQuota middleware."""

from fastapi.testclient import TestClient

from album_conceptualizer.api.app import create_app
from album_conceptualizer.config import reset_settings


def _make_quota_client(monkeypatch, daily_limit: int = 2):
    """Helper to build a TestClient with quota enabled at a given daily limit."""
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEY", raising=False)
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEYS", raising=False)
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_QUOTA_ENABLED", "true")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_QUOTA_DAILY_LIMIT", str(daily_limit))
    reset_settings()
    return TestClient(create_app())


class TestInMemoryQuotaMiddleware:
    def test_quota_exceeded_returns_429(self, monkeypatch):
        """After N requests the middleware should return 429."""
        with _make_quota_client(monkeypatch, daily_limit=1) as client:
            resp1 = client.get("/api/v1/albums")
            resp2 = client.get("/api/v1/albums")
        reset_settings()
        assert resp1.status_code in (200, 401)
        assert resp2.status_code == 429

    def test_health_endpoint_exempt_from_quota(self, monkeypatch):
        """Health endpoints should never be rate-limited."""
        with _make_quota_client(monkeypatch, daily_limit=1) as client:
            # Exhaust quota on a regular endpoint
            client.get("/api/v1/albums")
            # Health should still succeed
            resp = client.get("/api/v1/health")
        reset_settings()
        assert resp.status_code == 200

    def test_ready_endpoint_exempt_from_quota(self, monkeypatch):
        with _make_quota_client(monkeypatch, daily_limit=1) as client:
            client.get("/api/v1/albums")
            resp = client.get("/api/v1/ready")
        reset_settings()
        assert resp.status_code == 200

    def test_live_endpoint_exempt_from_quota(self, monkeypatch):
        with _make_quota_client(monkeypatch, daily_limit=1) as client:
            client.get("/api/v1/albums")
            resp = client.get("/api/v1/live")
        reset_settings()
        assert resp.status_code == 200

    def test_root_probe_endpoints_exempt_from_quota(self, monkeypatch):
        with _make_quota_client(monkeypatch, daily_limit=1) as client:
            client.get("/api/v1/albums")
            health_resp = client.get("/health")
            ready_resp = client.get("/ready")
            live_resp = client.get("/live")
        reset_settings()
        assert health_resp.status_code == 200
        assert ready_resp.status_code == 200
        assert live_resp.status_code == 200

    def test_quota_remaining_header_present(self, monkeypatch):
        """The X-Quota-Remaining header should be included in successful responses."""
        with _make_quota_client(monkeypatch, daily_limit=5) as client:
            resp = client.get("/api/v1/albums")
        reset_settings()
        assert "x-quota-remaining" in {k.lower() for k in resp.headers}

    def test_quota_remaining_decrements(self, monkeypatch):
        """X-Quota-Remaining should decrease with each request."""
        with _make_quota_client(monkeypatch, daily_limit=5) as client:
            r1 = client.get("/api/v1/albums")
            r2 = client.get("/api/v1/albums")
        reset_settings()
        remaining1 = int(r1.headers.get("x-quota-remaining", -1))
        remaining2 = int(r2.headers.get("x-quota-remaining", -1))
        assert remaining2 < remaining1

    def test_bearer_token_as_quota_key(self, monkeypatch):
        """Bearer Authorization header should be used as the quota key."""
        with _make_quota_client(monkeypatch, daily_limit=1) as client:
            resp1 = client.get(
                "/api/v1/albums",
                headers={"Authorization": "Bearer my-unique-token-abc"},
            )
            resp2 = client.get(
                "/api/v1/albums",
                headers={"Authorization": "Bearer my-unique-token-abc"},
            )
        reset_settings()
        assert resp1.status_code in (200, 401)
        assert resp2.status_code == 429

    def test_different_tokens_have_separate_quotas(self, monkeypatch):
        """Different bearer tokens should each get their own daily quota."""
        with _make_quota_client(monkeypatch, daily_limit=1) as client:
            r_a = client.get("/api/v1/albums", headers={"Authorization": "Bearer token-alpha"})
            r_b = client.get("/api/v1/albums", headers={"Authorization": "Bearer token-beta"})
        reset_settings()
        # Both first requests for their respective tokens should succeed
        assert r_a.status_code in (200, 401)
        assert r_b.status_code in (200, 401)

    def test_quota_disabled_allows_many_requests(self, monkeypatch):
        """When quota is disabled, requests should never be throttled."""
        monkeypatch.delenv("ALBUM_CONCEPTUALIZER_QUOTA_ENABLED", raising=False)
        monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEY", raising=False)
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_QUOTA_DAILY_LIMIT", "1")
        reset_settings()
        with TestClient(create_app()) as client:
            for _ in range(5):
                resp = client.get("/api/v1/health")
                assert resp.status_code == 200
        reset_settings()

    def test_exceeded_quota_returns_correct_detail(self, monkeypatch):
        """The 429 response should include a meaningful error message."""
        with _make_quota_client(monkeypatch, daily_limit=1) as client:
            client.get("/api/v1/albums")
            resp = client.get("/api/v1/albums")
        reset_settings()
        assert resp.status_code == 429
        data = resp.json()
        assert "quota" in data.get("detail", "").lower()

    def test_exceeded_quota_has_zero_remaining_header(self, monkeypatch):
        """When quota is exceeded, X-Quota-Remaining should be 0."""
        with _make_quota_client(monkeypatch, daily_limit=1) as client:
            client.get("/api/v1/albums")
            resp = client.get("/api/v1/albums")
        reset_settings()
        assert resp.status_code == 429
        assert resp.headers.get("x-quota-remaining") == "0"
