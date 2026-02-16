"""Shared FastAPI middleware."""

from __future__ import annotations

import time
import uuid
from collections.abc import Callable

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from album_conceptualizer.api.metrics import MetricsRegistry
from album_conceptualizer.logging import get_logger, request_id_var


logger = get_logger("album_conceptualizer.api")


# ---------------------------------------------------------------------------
# Request-ID middleware
# ---------------------------------------------------------------------------


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Generate a unique request ID for every incoming HTTP request.

    * Reads an existing ``X-Request-ID`` header if one is provided by a
      reverse-proxy / load-balancer; otherwise generates a new UUID-4.
    * Stores the value in :data:`~album_conceptualizer.logging_config.request_id_var`
      so that every log record emitted during the request includes it.
    * Echoes the value back as an ``X-Request-ID`` response header.
    """

    async def dispatch(self, request: Request, call_next: Callable):
        rid = request.headers.get("x-request-id") or str(uuid.uuid4())
        token = request_id_var.set(rid)
        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = rid
            return response
        finally:
            request_id_var.reset(token)


# ---------------------------------------------------------------------------
# Request logging
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Metrics collection
# ---------------------------------------------------------------------------


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
