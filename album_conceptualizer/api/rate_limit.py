"""Rate limiting middleware."""

from __future__ import annotations

import time
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Deque

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from album_conceptualizer.config import get_settings


@dataclass
class RateLimitConfig:
    max_per_minute: int


class InMemoryRateLimiter(BaseHTTPMiddleware):
    """Naive per-IP rate limiter (in-memory)."""

    def __init__(self, app, config: RateLimitConfig):
        super().__init__(app)
        self.config = config
        self._requests: dict[str, Deque[float]] = defaultdict(deque)

    def _allowed(self, key: str) -> bool:
        now = time.time()
        window_start = now - 60
        bucket = self._requests[key]
        while bucket and bucket[0] < window_start:
            bucket.popleft()
        if len(bucket) >= self.config.max_per_minute:
            return False
        bucket.append(now)
        return True

    async def dispatch(self, request: Request, call_next):
        settings = request.app.state.settings if hasattr(request.app.state, "settings") else get_settings()
        if not settings.rate_limit_enabled:
            return await call_next(request)

        if request.url.path.startswith("/api/v1/health") or request.url.path.startswith(
            "/api/v1/ready"
        ) or request.url.path.startswith("/api/v1/live"):
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        if not self._allowed(client_ip):
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded"},
                headers={"X-Rate-Limited": "true"},
            )
        response = await call_next(request)
        response.headers["X-Rate-Limited"] = "false"
        return response


class RedisRateLimiter(BaseHTTPMiddleware):
    """Redis-backed per-IP rate limiter."""

    def __init__(self, app, config: RateLimitConfig, redis_url: str | None):
        super().__init__(app)
        if not redis_url:
            raise ValueError("Redis rate limiting requires ALBUM_CONCEPTUALIZER_REDIS_URL")
        try:
            import redis
        except ImportError as exc:
            raise ImportError(
                "Redis rate limiting requires the 'redis' package. "
                "Install with `pip install redis`."
            ) from exc

        self.config = config
        self._redis = redis.from_url(redis_url, decode_responses=True)

    def _allowed(self, key: str) -> bool:
        now = time.time()
        window_start = now - 60
        redis_key = f"rate:{key}"
        with self._redis.pipeline() as pipe:
            pipe.zremrangebyscore(redis_key, 0, window_start)
            pipe.zcard(redis_key)
            _, count = pipe.execute()
        if count >= self.config.max_per_minute:
            return False
        member = str(time.time_ns())
        with self._redis.pipeline() as pipe:
            pipe.zadd(redis_key, {member: now})
            pipe.expire(redis_key, 120)
            pipe.execute()
        return True

    async def dispatch(self, request: Request, call_next):
        settings = request.app.state.settings if hasattr(request.app.state, "settings") else get_settings()
        if not settings.rate_limit_enabled:
            return await call_next(request)

        if request.url.path.startswith("/api/v1/health") or request.url.path.startswith(
            "/api/v1/ready"
        ) or request.url.path.startswith("/api/v1/live"):
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        if not self._allowed(client_ip):
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded"},
                headers={"X-Rate-Limited": "true"},
            )
        response = await call_next(request)
        response.headers["X-Rate-Limited"] = "false"
        return response
