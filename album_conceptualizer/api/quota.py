"""Quota middleware."""

from __future__ import annotations

import logging
import time as _time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from album_conceptualizer.config import get_settings

logger = logging.getLogger("album_conceptualizer.api.quota")


@dataclass
class QuotaConfig:
    daily_limit: int


class InMemoryQuota(BaseHTTPMiddleware):
    """Naive daily quota limiter (in-memory)."""

    _PRUNE_INTERVAL = 3600  # seconds between pruning old date keys

    def __init__(self, app, config: QuotaConfig):
        super().__init__(app)
        self.config = config
        self._usage: dict[tuple[str, date], int] = defaultdict(int)
        self._last_prune: float = _time.monotonic()

    def _get_key(self, request: Request) -> str:
        api_key = request.headers.get("x-api-key")
        if not api_key:
            auth = request.headers.get("authorization")
            if auth and auth.lower().startswith("bearer "):
                api_key = auth.split()[1]
        if api_key:
            return f"api:{api_key}"
        client_ip = request.client.host if request.client else "unknown"
        return f"ip:{client_ip}"

    async def dispatch(self, request: Request, call_next):
        settings = (
            request.app.state.settings if hasattr(request.app.state, "settings") else get_settings()
        )
        if not settings.quota_enabled:
            return await call_next(request)

        if (
            request.url.path.startswith("/api/v1/health")
            or request.url.path.startswith("/api/v1/ready")
            or request.url.path.startswith("/api/v1/live")
        ):
            return await call_next(request)

        now = _time.monotonic()
        if now - self._last_prune > self._PRUNE_INTERVAL:
            cutoff = date.today() - timedelta(days=7)
            stale = [k for k in self._usage if k[1] < cutoff]
            for k in stale:
                del self._usage[k]
            self._last_prune = now

        key = self._get_key(request)
        today = date.today()
        usage_key = (key, today)
        used = self._usage[usage_key]
        if used >= self.config.daily_limit:
            logger.warning(
                "daily quota exceeded",
                extra={"key": key, "used": used, "limit": self.config.daily_limit},
            )
            return JSONResponse(
                status_code=429,
                content={"detail": "Daily quota exceeded"},
                headers={"X-Quota-Remaining": "0"},
            )

        self._usage[usage_key] = used + 1
        response = await call_next(request)
        remaining = max(0, self.config.daily_limit - self._usage[usage_key])
        response.headers["X-Quota-Remaining"] = str(remaining)
        logger.debug(
            "quota check passed",
            extra={"key": key, "remaining": remaining},
        )
        return response


class RedisQuota(BaseHTTPMiddleware):
    """Redis-backed daily quota limiter."""

    def __init__(self, app, config: QuotaConfig, redis_url: str | None):
        super().__init__(app)
        if not redis_url:
            raise ValueError("Redis quota requires ALBUM_CONCEPTUALIZER_REDIS_URL")
        try:
            import redis
        except ImportError as exc:
            raise ImportError(
                "Redis quota requires the 'redis' package. Install with `pip install redis`."
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
            return f"api:{api_key}"
        client_ip = request.client.host if request.client else "unknown"
        return f"ip:{client_ip}"

    def _seconds_until_tomorrow(self) -> int:
        now = datetime.now(UTC)
        tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        return int((tomorrow - now).total_seconds())

    async def dispatch(self, request: Request, call_next):
        settings = (
            request.app.state.settings if hasattr(request.app.state, "settings") else get_settings()
        )
        if not settings.quota_enabled:
            return await call_next(request)

        if (
            request.url.path.startswith("/api/v1/health")
            or request.url.path.startswith("/api/v1/ready")
            or request.url.path.startswith("/api/v1/live")
        ):
            return await call_next(request)

        key = self._get_key(request)
        today = date.today().isoformat()
        redis_key = f"quota:{key}:{today}"
        with self._redis.pipeline() as pipe:
            pipe.incr(redis_key)
            pipe.expire(redis_key, self._seconds_until_tomorrow())
            count, _ = pipe.execute()
        if count > self.config.daily_limit:
            logger.warning(
                "daily quota exceeded (redis)",
                extra={"key": key, "count": count, "limit": self.config.daily_limit},
            )
            return JSONResponse(
                status_code=429,
                content={"detail": "Daily quota exceeded"},
                headers={"X-Quota-Remaining": "0"},
            )

        response = await call_next(request)
        remaining = max(0, self.config.daily_limit - count)
        response.headers["X-Quota-Remaining"] = str(remaining)
        return response
