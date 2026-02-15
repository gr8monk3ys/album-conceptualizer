"""Shared FastAPI middleware."""

from __future__ import annotations

import time
from collections.abc import Callable

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from album_conceptualizer.api.metrics import MetricsRegistry
from album_conceptualizer.logging import get_logger


logger = get_logger("album_conceptualizer.api")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log basic request/response metadata."""

    async def dispatch(self, request: Request, call_next: Callable):
        start = time.time()
        response = await call_next(request)
        duration_ms = (time.time() - start) * 1000
        route = request.scope.get("route")
        route_path = getattr(route, "path", request.url.path)
        logger.info(
            "request",
            extra={
                "method": request.method,
                "path": route_path,
                "status": response.status_code,
                "duration_ms": round(duration_ms, 2),
            },
        )
        return response


class MetricsMiddleware(BaseHTTPMiddleware):
    """Collect basic request metrics in memory."""

    async def dispatch(self, request: Request, call_next: Callable):
        start = time.time()
        response = await call_next(request)
        metrics: MetricsRegistry | None = getattr(request.app.state, "metrics", None)
        if metrics:
            route = request.scope.get("route")
            route_path = getattr(route, "path", request.url.path)
            metrics.record(
                route_path, response.status_code, duration_ms=(time.time() - start) * 1000
            )
        return response
