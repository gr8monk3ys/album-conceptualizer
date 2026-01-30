"""FastAPI application factory and configuration."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from album_conceptualizer.api.v1 import router as v1_router
from album_conceptualizer.config import get_settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager for startup/shutdown events."""
    # Startup
    settings = get_settings()
    app.state.settings = settings

    # Initialize RAG system if configured
    if settings.chroma_persist_directory:
        try:
            from album_conceptualizer.rag.vector_store import ChromaVectorStore

            app.state.vector_store = ChromaVectorStore(
                persist_directory=settings.chroma_persist_directory,
            )
        except ImportError:
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

        ## Authentication

        Currently, the API does not require authentication. For production use,
        implement OAuth2 or API key authentication.
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
            {"name": "agents", "description": "AI agent workflows"},
            {"name": "health", "description": "Health check endpoints"},
        ],
    )

    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Configure appropriately for production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
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

    # Global exception handler
    @app.exception_handler(Exception)
    async def global_exception_handler(request, exc):
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
