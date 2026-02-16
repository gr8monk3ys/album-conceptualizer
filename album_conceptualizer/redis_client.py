"""Shared Redis client factory."""
from __future__ import annotations

import logging
from functools import lru_cache

logger = logging.getLogger("album_conceptualizer.redis_client")


@lru_cache(maxsize=1)
def get_redis_client(redis_url: str):
    """Get or create a shared Redis client."""
    try:
        import redis
    except ImportError:
        raise ImportError("Redis requires the 'redis' package. Install with: pip install redis")

    client = redis.from_url(redis_url, decode_responses=True)
    # Verify connection
    try:
        client.ping()
        logger.info("Redis connected", extra={"url": redis_url.split("@")[-1]})  # Don't log credentials
    except redis.ConnectionError as exc:
        logger.error("Redis connection failed: %s", exc)
        raise
    return client


async def check_redis_health(redis_url: str | None) -> dict:
    """Check Redis health for readiness endpoint."""
    if not redis_url:
        return {"status": "skipped", "reason": "not configured"}
    try:
        client = get_redis_client(redis_url)
        info = client.info("server")
        return {
            "status": "healthy",
            "version": info.get("redis_version", "unknown"),
        }
    except Exception as exc:
        return {"status": "unhealthy", "error": str(exc)}
