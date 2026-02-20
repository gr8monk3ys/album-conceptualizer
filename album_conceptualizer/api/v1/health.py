"""Health check endpoints."""

from datetime import datetime

from fastapi import APIRouter, Query, Request, Response
from pydantic import BaseModel, Field


router = APIRouter()


class HealthResponse(BaseModel):
    """Health check response model."""

    status: str
    timestamp: datetime
    version: str
    components: dict[str, str]


class ReadinessResponse(BaseModel):
    """Readiness check response model."""

    ready: bool
    checks: dict[str, bool]
    required_checks: dict[str, bool] = Field(default_factory=dict)
    optional_checks: dict[str, bool] = Field(default_factory=dict)
    strict_mode: bool = False


@router.get("/health", response_model=HealthResponse)
async def health_check(request: Request) -> HealthResponse:
    """
    Check API health status.

    Returns basic health information about the API.
    """
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow(),
        version=request.app.version,
        components={
            "api": "healthy",
            "database": "not_configured",
        },
    )


@router.get("/ready", response_model=ReadinessResponse)
async def readiness_check(
    request: Request,
    strict: bool = Query(
        default=False,
        description="When true, require optional dependencies (LLM and vector store) to be ready.",
    ),
) -> ReadinessResponse:
    """
    Check if the API is ready to serve requests.

    Performs deeper checks on dependencies.
    """
    required_checks = {
        "api": True,
        "production_guardrails": True,
    }
    optional_checks = {
        "vector_store": False,
        "llm": False,
    }

    # Check vector store
    if hasattr(request.app.state, "vector_store") and request.app.state.vector_store:
        optional_checks["vector_store"] = True

    # Check LLM configuration
    settings = getattr(request.app.state, "settings", None)
    if settings and (settings.anthropic_api_key or settings.openai_api_key):
        optional_checks["llm"] = True
    if settings:
        required_checks["production_guardrails"] = (
            not settings.strict_production or not settings.production_issues()
        )
    checks = {**required_checks, **optional_checks}
    ready = all(required_checks.values()) and (all(optional_checks.values()) if strict else True)

    return ReadinessResponse(
        ready=ready,
        checks=checks,
        required_checks=required_checks,
        optional_checks=optional_checks,
        strict_mode=strict,
    )


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
