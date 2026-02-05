"""Shared FastAPI middleware."""

from __future__ import annotations

import time
from typing import Callable

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from album_conceptualizer.logging import get_logger
from album_conceptualizer.api.metrics import MetricsRegistry


logger = get_logger("album_conceptualizer.api")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log basic request/response metadata."""

    async def dispatch(self, request: Request, call_next: Callable):
        start = time.time()
        response = await call_next(request)
        duration_ms = (time.time() - start) * 1000
        logger.info(
            "request",
            extra={
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "duration_ms": round(duration_ms, 2),
            },
        )
        return response


class MetricsMiddleware(BaseHTTPMiddleware):
    """Collect basic request metrics in memory."""

    async def dispatch(self, request: Request, call_next: Callable):
        response = await call_next(request)
        metrics: MetricsRegistry | None = getattr(request.app.state, "metrics", None)
        if metrics:
            metrics.record(request.url.path, response.status_code)
        return response
