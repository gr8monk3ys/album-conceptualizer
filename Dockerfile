# syntax=docker/dockerfile:1

# Build stage
FROM python:3.11-slim AS builder

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Set environment variables
ENV UV_SYSTEM_PYTHON=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

WORKDIR /app

# Copy dependency files and package source
COPY pyproject.toml README.md LICENSE ./
COPY album_conceptualizer/ ./album_conceptualizer/

# Install dependencies (core + ai + music extras)
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install --system -e ".[ai,music]" 2>/dev/null || \
    uv pip install --system -e "."

# Production stage
FROM python:3.11-slim AS production

# System deps for audio rendering (fluidsynth, ffmpeg)
RUN apt-get update && apt-get install -y --no-install-recommends \
    fluidsynth ffmpeg fluid-soundfont-gm \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd --create-home --shell /bin/bash appuser

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    AC_SOUNDFONT_PATH=/usr/share/sounds/sf2/FluidR3_GM.sf2 \
    ALBUM_CONCEPTUALIZER_STORAGE_BACKEND=sqlite \
    ALBUM_CONCEPTUALIZER_STORAGE_DB=/app/data/album_conceptualizer.db

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY --chown=appuser:appuser album_conceptualizer/ ./album_conceptualizer/
COPY --chown=appuser:appuser pyproject.toml README.md LICENSE ./

# Create data directories
RUN mkdir -p /app/data /app/output && chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose ports for Gradio UI and FastAPI
EXPOSE 7860 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/api/v1/health').status==200 else 1)" || python -c "import album_conceptualizer" || exit 1

# Default command - FastAPI server
CMD ["uvicorn", "album_conceptualizer.api.app:app", "--host", "0.0.0.0", "--port", "8000"]

# API stage (optimized for FastAPI only)
FROM production AS api

# Only expose API port
EXPOSE 8000

# API-specific health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/api/v1/live').status==200 else 1)" || exit 1

CMD ["uvicorn", "album_conceptualizer.api.app:app", "--host", "0.0.0.0", "--port", "8000"]

# UI stage (Gradio)
FROM production AS ui

EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import album_conceptualizer; print('healthy')" || exit 1

CMD ["python", "-m", "album_conceptualizer.cli", "ui", "--host", "0.0.0.0"]

# Development stage
FROM production AS development

USER root

# Install uv for development
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Install development dependencies
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install --system -e ".[dev]"

# Copy tests
COPY --chown=appuser:appuser tests/ ./tests/

USER appuser

CMD ["pytest", "-v"]
