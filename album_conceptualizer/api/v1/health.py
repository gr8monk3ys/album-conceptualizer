"""Health check endpoints."""

from datetime import datetime

from fastapi import APIRouter, Request
from pydantic import BaseModel


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
async def readiness_check(request: Request) -> ReadinessResponse:
    """
    Check if the API is ready to serve requests.

    Performs deeper checks on dependencies.
    """
    checks = {
        "api": True,
        "vector_store": False,
        "llm": False,
    }

    # Check vector store
    if hasattr(request.app.state, "vector_store") and request.app.state.vector_store:
        checks["vector_store"] = True

    # Check LLM configuration
    settings = getattr(request.app.state, "settings", None)
    if settings and (settings.anthropic_api_key or settings.openai_api_key):
        checks["llm"] = True

    return ReadinessResponse(
        ready=all(checks.values()),
        checks=checks,
    )


@router.get("/live")
async def liveness_check() -> dict:
    """Simple liveness probe for container orchestration."""
    return {"status": "alive"}
