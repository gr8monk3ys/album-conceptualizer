"""Health check endpoints."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel


router = APIRouter()


class HealthResponse(BaseModel):
    """Health check response model."""

    status: str
    timestamp: datetime
    version: str
    components: dict[str, str]


class ReadinessCheck(BaseModel):
    """Individual readiness check result."""

    healthy: bool
    detail: str | None = None


class ReadinessResponse(BaseModel):
    """Readiness check response model."""

    status: str  # "ok" or "degraded"
    checks: dict[str, ReadinessCheck]
    # Keep legacy ``ready`` field for backward compatibility.
    ready: bool


def _check_sqlite(settings: Any) -> ReadinessCheck:
    """Verify that the SQLite database is reachable and responsive."""
    try:
        db_path = settings.storage_db_path
        conn = sqlite3.connect(str(db_path), timeout=2)
        try:
            conn.execute("SELECT 1")
            return ReadinessCheck(healthy=True, detail=str(db_path))
        finally:
            conn.close()
    except Exception as exc:  # noqa: BLE001
        return ReadinessCheck(healthy=False, detail=str(exc))


def _check_redis(settings: Any) -> ReadinessCheck:
    """Verify that Redis is reachable (sync ping)."""
    redis_url = getattr(settings, "redis_url", None)
    if not redis_url:
        return ReadinessCheck(healthy=False, detail="redis_url not configured")
    try:
        import redis as redis_lib  # noqa: WPS433

        client = redis_lib.from_url(redis_url, socket_connect_timeout=2)
        client.ping()
        return ReadinessCheck(healthy=True, detail=redis_url)
    except ImportError:
        return ReadinessCheck(healthy=False, detail="redis package not installed")
    except Exception as exc:  # noqa: BLE001
        return ReadinessCheck(healthy=False, detail=str(exc))


@router.get("/health", response_model=HealthResponse)
async def health_check(request: Request) -> HealthResponse:
    """
    Check API health status.

    Returns basic health information about the API.
    Simple 200 OK suitable for k8s liveness probes.
    """
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now(timezone.utc),
        version=request.app.version,
        components={
            "api": "healthy",
            "database": "not_configured",
        },
    )


@router.get("/ready")
async def readiness_check(request: Request) -> dict:
    """
    Check if the API is ready to serve requests.

    Performs deeper checks on dependencies including database and
    cache connectivity.  Returns ``{"status": "ok", "checks": {...}}``
    when all dependencies are healthy, or
    ``{"status": "degraded", "checks": {...}}`` when one or more
    dependency checks fail.
    """
    checks: dict[str, ReadinessCheck] = {
        "api": ReadinessCheck(healthy=True),
    }

    settings = getattr(request.app.state, "settings", None)

    # -- Storage backend connectivity --
    if settings and settings.storage_backend == "sqlite":
        checks["sqlite"] = _check_sqlite(settings)
    elif settings and settings.storage_backend == "file":
        checks["file_storage"] = ReadinessCheck(healthy=True, detail="file backend")
    else:
        checks["storage"] = ReadinessCheck(healthy=True, detail="in-memory")

    # -- Redis connectivity (when any redis-backed feature is active) --
    uses_redis = settings and (
        getattr(settings, "rate_limit_backend", "") == "redis"
        or getattr(settings, "quota_backend", "") == "redis"
        or getattr(settings, "collab_realtime_backend", "") == "redis"
    )
    if uses_redis:
        checks["redis"] = _check_redis(settings)

    # -- Vector store --
    if hasattr(request.app.state, "vector_store") and request.app.state.vector_store:
        checks["vector_store"] = ReadinessCheck(healthy=True)
    else:
        checks["vector_store"] = ReadinessCheck(healthy=False, detail="not configured")

    # -- LLM configuration --
    if settings and (settings.anthropic_api_key or settings.openai_api_key):
        checks["llm"] = ReadinessCheck(healthy=True)
    else:
        checks["llm"] = ReadinessCheck(healthy=False, detail="no API key configured")

    # -- Production guardrails --
    if settings:
        guardrails_ok = not settings.strict_production or not settings.production_issues()
        checks["production_guardrails"] = ReadinessCheck(healthy=guardrails_ok)
    else:
        checks["production_guardrails"] = ReadinessCheck(healthy=True)

    all_healthy = all(c.healthy for c in checks.values())
    status = "ok" if all_healthy else "degraded"

    return {
        "status": status,
        "checks": {name: check.model_dump() for name, check in checks.items()},
        "ready": all_healthy,
    }


@router.get("/live")
async def liveness_check() -> dict:
    """Simple liveness probe for container orchestration."""
    return {"status": "alive"}


@router.get("/metrics", response_model=None)
async def metrics(request: Request, format: str | None = None):
    """Basic metrics snapshot for monitoring."""
    registry = getattr(request.app.state, "metrics", None)
    if not registry:
        return {"detail": "Metrics unavailable"}
    if format and format.lower() in {"prometheus", "text"}:
        snapshot = registry.to_dict()
        lines = [
            "# TYPE album_conceptualizer_requests_total counter",
            f"album_conceptualizer_requests_total {snapshot['request_count']}",
            "# TYPE album_conceptualizer_errors_total counter",
            f"album_conceptualizer_errors_total {snapshot['error_count']}",
            "# TYPE album_conceptualizer_request_duration_ms_sum counter",
            f"album_conceptualizer_request_duration_ms_sum {snapshot['total_duration_ms']}",
            "# TYPE album_conceptualizer_request_duration_ms_count counter",
            f"album_conceptualizer_request_duration_ms_count {snapshot['request_count']}",
            "# TYPE album_conceptualizer_request_duration_ms_avg gauge",
            f"album_conceptualizer_request_duration_ms_avg {snapshot['avg_duration_ms']}",
            "# TYPE album_conceptualizer_request_duration_ms_min gauge",
            f"album_conceptualizer_request_duration_ms_min {snapshot['min_duration_ms']}",
            "# TYPE album_conceptualizer_request_duration_ms_max gauge",
            f"album_conceptualizer_request_duration_ms_max {snapshot['max_duration_ms']}",
            "# TYPE album_conceptualizer_request_duration_ms_p95 gauge",
            f"album_conceptualizer_request_duration_ms_p95 {snapshot['p95_duration_ms']}",
            "# TYPE album_conceptualizer_uptime_seconds gauge",
            f"album_conceptualizer_uptime_seconds {snapshot['uptime_seconds']}",
        ]
        for status, count in snapshot["status_counts"].items():
            lines.append(f'album_conceptualizer_status_total{{status="{status}"}} {count}')
        for path, count in snapshot["path_counts"].items():
            lines.append(f'album_conceptualizer_path_total{{path="{path}"}} {count}')
        for path, duration_ms in snapshot["path_duration_ms"].items():
            lines.append(
                f'album_conceptualizer_path_duration_ms_sum{{path="{path}"}} {duration_ms}'
            )
        body = "\n".join(lines) + "\n"
        return Response(content=body, media_type="text/plain; version=0.0.4")
    return registry.to_dict()
