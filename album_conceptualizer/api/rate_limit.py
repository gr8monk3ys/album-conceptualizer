"""Rate limiting middleware."""

from __future__ import annotations

import hashlib
import time
from collections import defaultdict, deque
from dataclasses import dataclass

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from album_conceptualizer.config import get_settings


@dataclass
class RateLimitConfig:
    max_per_minute: int


_EXEMPT_PATHS = frozenset(
    {
        "/health",
        "/ready",
        "/live",
        "/api/v1/health",
        "/api/v1/ready",
        "/api/v1/live",
    }
)


def _is_exempt_path(path: str) -> bool:
    return path in _EXEMPT_PATHS


def _token_fingerprint(token: str) -> str:
    """Hash sensitive credentials before using them in limiter keys."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


_MAX_TRACKED_KEYS = 10_000
_SWEEP_INTERVAL = 300  # seconds between full sweeps of stale keys


class InMemoryRateLimiter(BaseHTTPMiddleware):
    """Per-IP rate limiter (in-memory) with bounded key eviction."""

    def __init__(self, app, config: RateLimitConfig):
        super().__init__(app)
        self.config = config
        self._requests: dict[str, deque[float]] = defaultdict(deque)
        self._last_sweep: float = 0.0

    def _get_key(self, request: Request) -> str:
        api_key = request.headers.get("x-api-key")
        if not api_key:
            auth = request.headers.get("authorization")
            if auth and auth.lower().startswith("bearer "):
                api_key = auth.split()[1]
        if api_key:
            return f"api:{_token_fingerprint(api_key)}"
        client_ip = request.client.host if request.client else "unknown"
        return f"ip:{client_ip}"

    def _sweep_stale(self, now: float) -> None:
        """Remove keys whose buckets are empty or fully expired."""
        if now - self._last_sweep < _SWEEP_INTERVAL:
            return
        self._last_sweep = now
        window_start = now - 60
        stale = [k for k, v in self._requests.items() if not v or v[-1] < window_start]
        for k in stale:
            del self._requests[k]

    def _allowed(self, key: str) -> bool:
        now = time.time()
        window_start = now - 60
        bucket = self._requests[key]
        while bucket and bucket[0] < window_start:
            bucket.popleft()
        if len(bucket) >= self.config.max_per_minute:
            return False
        bucket.append(now)
        self._sweep_stale(now)
        return True

    async def dispatch(self, request: Request, call_next):
        settings = (
            request.app.state.settings if hasattr(request.app.state, "settings") else get_settings()
        )
        if not settings.rate_limit_enabled:
            return await call_next(request)

        if _is_exempt_path(request.url.path):
            return await call_next(request)

        key = self._get_key(request)
        if not self._allowed(key):
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded"},
                headers={"X-Rate-Limited": "true"},
            )
        response = await call_next(request)
        response.headers["X-Rate-Limited"] = "false"
        return response


class RedisRateLimiter(BaseHTTPMiddleware):  # pragma: no cover
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

    def _get_key(self, request: Request) -> str:
        api_key = request.headers.get("x-api-key")
        if not api_key:
            auth = request.headers.get("authorization")
            if auth and auth.lower().startswith("bearer "):
                api_key = auth.split()[1]
        if api_key:
            return f"api:{_token_fingerprint(api_key)}"
        client_ip = request.client.host if request.client else "unknown"
        return f"ip:{client_ip}"

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
        settings = (
            request.app.state.settings if hasattr(request.app.state, "settings") else get_settings()
        )
        if not settings.rate_limit_enabled:
            return await call_next(request)

        if _is_exempt_path(request.url.path):
            return await call_next(request)

        key = self._get_key(request)
        if not self._allowed(key):
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded"},
                headers={"X-Rate-Limited": "true"},
            )
        response = await call_next(request)
        response.headers["X-Rate-Limited"] = "false"
        return response
