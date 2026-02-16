"""Tests for the shared Redis client factory."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from album_conceptualizer.redis_client import check_redis_health, get_redis_client


@pytest.fixture(autouse=True)
def _clear_cache():
    """Clear the lru_cache between tests."""
    get_redis_client.cache_clear()
    yield
    get_redis_client.cache_clear()


class TestGetRedisClient:
    """Tests for get_redis_client."""

    def test_creates_client_from_url(self):
        mock_redis_module = MagicMock()
        mock_client = MagicMock()
        mock_redis_module.from_url.return_value = mock_client
        mock_client.ping.return_value = True

        with patch.dict("sys.modules", {"redis": mock_redis_module}):
            client = get_redis_client("redis://localhost:6379/0")

        mock_redis_module.from_url.assert_called_once_with(
            "redis://localhost:6379/0", decode_responses=True
        )
        mock_client.ping.assert_called_once()
        assert client is mock_client

    def test_returns_cached_client_on_second_call(self):
        mock_redis_module = MagicMock()
        mock_client = MagicMock()
        mock_redis_module.from_url.return_value = mock_client
        mock_client.ping.return_value = True

        with patch.dict("sys.modules", {"redis": mock_redis_module}):
            client1 = get_redis_client("redis://localhost:6379/0")
            client2 = get_redis_client("redis://localhost:6379/0")

        assert client1 is client2
        # from_url should only be called once due to caching
        mock_redis_module.from_url.assert_called_once()

    def test_raises_on_connection_failure(self):
        mock_redis_module = MagicMock()
        mock_client = MagicMock()
        mock_redis_module.from_url.return_value = mock_client
        mock_redis_module.ConnectionError = ConnectionError
        mock_client.ping.side_effect = ConnectionError("Connection refused")

        with patch.dict("sys.modules", {"redis": mock_redis_module}):
            with pytest.raises(ConnectionError, match="Connection refused"):
                get_redis_client("redis://localhost:6379/0")


class TestCheckRedisHealth:
    """Tests for check_redis_health."""

    @pytest.mark.asyncio
    async def test_health_skipped_when_no_url(self):
        result = await check_redis_health(None)
        assert result["status"] == "skipped"
        assert "not configured" in result["reason"]

    @pytest.mark.asyncio
    @patch("album_conceptualizer.redis_client.get_redis_client")
    async def test_health_healthy(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.info.return_value = {"redis_version": "7.0.0"}
        mock_get_client.return_value = mock_client

        result = await check_redis_health("redis://localhost:6379/0")

        assert result["status"] == "healthy"
        assert result["version"] == "7.0.0"

    @pytest.mark.asyncio
    @patch("album_conceptualizer.redis_client.get_redis_client")
    async def test_health_unhealthy_on_exception(self, mock_get_client):
        mock_get_client.side_effect = ConnectionError("Connection refused")

        result = await check_redis_health("redis://localhost:6379/0")

        assert result["status"] == "unhealthy"
        assert "Connection refused" in result["error"]
