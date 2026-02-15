"""FastAPI application factory and configuration."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from album_conceptualizer.api.metrics import MetricsRegistry
from album_conceptualizer.api.middleware import MetricsMiddleware, RequestLoggingMiddleware
from album_conceptualizer.api.quota import InMemoryQuota, QuotaConfig, RedisQuota
from album_conceptualizer.api.rate_limit import (
    InMemoryRateLimiter,
    RateLimitConfig,
    RedisRateLimiter,
)
from album_conceptualizer.api.v1 import router as v1_router
from album_conceptualizer.api.v1.health import health_check as v1_health_check
from album_conceptualizer.api.v1.health import liveness_check as v1_liveness_check
from album_conceptualizer.api.v1.health import readiness_check as v1_readiness_check
from album_conceptualizer.config import get_settings
from album_conceptualizer.emailing import create_email_sender
from album_conceptualizer.experience_state import (
    FileExperienceStateStore,
    InMemoryExperienceStateStore,
    SQLiteExperienceStateStore,
)
from album_conceptualizer.identity_state import (
    FileIdentityStateStore,
    InMemoryIdentityStateStore,
    SQLiteIdentityStateStore,
)
from album_conceptualizer.logging import configure_logging
from album_conceptualizer.storage import (
    FileAlbumStore,
    FileBibleStore,
    FileSubscriptionStore,
    InMemoryAlbumStore,
    InMemoryBibleStore,
    InMemorySubscriptionStore,
    SQLiteAlbumStore,
    SQLiteBibleStore,
    SQLiteSubscriptionStore,
)


def _validate_strict_production(settings) -> None:
    if not settings.strict_production:
        return
    issues = settings.production_issues()
    if not issues:
        return
    bullet_list = "\n".join(f"- {issue}" for issue in issues)
    raise RuntimeError(f"Strict production validation failed:\n{bullet_list}")


def _initialize_state(app: FastAPI) -> None:
    settings = get_settings()
    app.state.settings = settings
    app.state.metrics = MetricsRegistry()
    app.state.email_sender = create_email_sender(settings)
    if settings.storage_backend == "file":
        app.state.album_store = FileAlbumStore(settings.output_dir / "api_albums")
        app.state.bible_store = FileBibleStore(settings.output_dir / "api_bibles")
        app.state.subscription_store = FileSubscriptionStore(
            settings.output_dir / "api_subscriptions"
        )
        app.state.experience_store = FileExperienceStateStore(
            settings.output_dir / "api_experience"
        )
        app.state.identity_store = FileIdentityStateStore(settings.output_dir / "api_identity")
    elif settings.storage_backend == "sqlite":
        app.state.album_store = SQLiteAlbumStore(settings.storage_db_path)
        app.state.bible_store = SQLiteBibleStore(settings.storage_db_path)
        app.state.subscription_store = SQLiteSubscriptionStore(settings.storage_db_path)
        app.state.experience_store = SQLiteExperienceStateStore(settings.storage_db_path)
        app.state.identity_store = SQLiteIdentityStateStore(settings.storage_db_path)
    else:
        app.state.album_store = InMemoryAlbumStore()
        app.state.bible_store = InMemoryBibleStore()
        app.state.subscription_store = InMemorySubscriptionStore()
        app.state.experience_store = InMemoryExperienceStateStore()
        app.state.identity_store = InMemoryIdentityStateStore()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager for startup/shutdown events."""
    # Startup
    _initialize_state(app)
    settings = app.state.settings

    # Initialize RAG system if configured
    if settings.chroma_persist_directory:
        try:
            from album_conceptualizer.rag.embeddings import get_embedding_model
            from album_conceptualizer.rag.vector_store import ChromaVectorStore

            embedding_model = get_embedding_model(
                model_type="sentence_transformer",
                model_name=settings.rag.embedding_model,
            )
            app.state.vector_store = ChromaVectorStore(
                collection_name="album_conceptualizer",
                embedding_model=embedding_model,
                persist_directory=settings.chroma_persist_directory,
            )
        except Exception:
            app.state.vector_store = None

    yield

    # Shutdown
    # Cleanup resources if needed


def create_app(
    title: str = "Album Conceptualizer API",
    version: str = "1.0.0",
    debug: bool = False,
) -> FastAPI:
    """
    Create and configure the FastAPI application.

    Args:
        title: API title
        version: API version
        debug: Enable debug mode

    Returns:
        Configured FastAPI application
    """
    settings = get_settings()
    _validate_strict_production(settings)
    configure_logging(settings.log_level)
    app = FastAPI(
        title=title,
        description="""
        REST API for the Album Conceptualizer - a RAG-powered concept album ideation system.

        ## Features

        - **Albums**: Create, read, update, and delete concept albums
        - **Songs**: Manage songs within albums
        - **Album Bible**: Track themes, characters, motifs, and narrative structure
        - **Music Theory**: Chord progressions, scales, and harmonic analysis
        - **Export**: Generate MIDI, ChordPro, and MusicXML files
        - **AI Agents**: Run multi-agent workflows for ideation

        ## Authentication and Billing

        API-key authentication is supported and can be enforced with
        `ALBUM_CONCEPTUALIZER_API_KEY` or `ALBUM_CONCEPTUALIZER_API_KEYS`.
        Subscription gating can be enabled with
        `ALBUM_CONCEPTUALIZER_SUBSCRIPTION_REQUIRED=true`.
        """,
        version=version,
        debug=debug,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        openapi_tags=[
            {"name": "albums", "description": "Album management operations"},
            {"name": "songs", "description": "Song management within albums"},
            {"name": "bible", "description": "Album Bible management"},
            {"name": "theory", "description": "Music theory utilities"},
            {"name": "export", "description": "Export to various formats"},
            {"name": "identity", "description": "Accounts, workspaces, and workspace tokens"},
            {"name": "experience", "description": "Creative workflow and launch readiness tools"},
            {"name": "agents", "description": "AI agent workflows"},
            {"name": "health", "description": "Health check endpoints"},
        ],
    )
    _initialize_state(app)

    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(MetricsMiddleware)

    # Apply quota middleware.
    quota_config = QuotaConfig(daily_limit=settings.quota_daily_limit)
    if settings.quota_backend == "redis":
        app.add_middleware(
            RedisQuota,
            config=quota_config,
            redis_url=settings.redis_url,
        )
    else:
        app.add_middleware(
            InMemoryQuota,
            config=quota_config,
        )

    # Rate limiting (optional)
    rate_limit_config = RateLimitConfig(max_per_minute=settings.rate_limit_per_minute)
    if settings.rate_limit_backend == "redis":
        app.add_middleware(
            RedisRateLimiter,
            config=rate_limit_config,
            redis_url=settings.redis_url,
        )
    else:
        app.add_middleware(
            InMemoryRateLimiter,
            config=rate_limit_config,
        )

    # Include API routers
    app.include_router(v1_router, prefix="/api/v1")

    # Root endpoint
    @app.get("/", include_in_schema=False)
    async def root():
        return {
            "name": "Album Conceptualizer API",
            "version": version,
            "docs": "/docs",
            "health": "/api/v1/health",
        }

    # Compatibility endpoints: many load balancers probe /health by default.
    @app.get("/health", include_in_schema=False)
    async def health_root(request: Request):
        return await v1_health_check(request)

    @app.get("/ready", include_in_schema=False)
    async def ready_root(request: Request):
        return await v1_readiness_check(request)

    @app.get("/live", include_in_schema=False)
    async def live_root():
        return await v1_liveness_check()

    # Global exception handler
    @app.exception_handler(Exception)
    async def global_exception_handler(request, exc):
        metrics: MetricsRegistry | None = getattr(request.app.state, "metrics", None)
        if metrics:
            metrics.record_error()
        return JSONResponse(
            status_code=500,
            content={
                "detail": "Internal server error",
                "type": type(exc).__name__,
            },
        )

    return app


# Default app instance for running with uvicorn
app = create_app()
