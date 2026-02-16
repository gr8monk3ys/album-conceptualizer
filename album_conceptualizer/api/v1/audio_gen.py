"""Audio generation API endpoints.

Exposes AI-powered audio generation via Replicate (MusicGen / Stable Audio)
through two endpoints:

* ``POST /generate`` -- generate audio from a free-form text prompt.
* ``POST /generate-from-song`` -- generate audio from structured song metadata
  (genre, mood, instrumentation, etc.) which is assembled into a prompt
  automatically.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from album_conceptualizer.config import get_settings

logger = logging.getLogger("album_conceptualizer.api.v1.audio_gen")

router = APIRouter()


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------


class GenerateRequest(BaseModel):
    """Direct text-prompt generation request."""

    prompt: str = Field(min_length=1, max_length=1000)
    duration_seconds: int = Field(default=30, ge=5, le=120)
    model_id: str = Field(default="musicgen")


class GenerateFromSongRequest(BaseModel):
    """Generate audio from structured song metadata."""

    song_title: str
    genre_tags: list[str] = Field(default_factory=list)
    mood_tags: list[str] = Field(default_factory=list)
    instrumentation: list[str] = Field(default_factory=list)
    tempo: int | None = None
    key: str | None = None
    concept_summary: str | None = None
    duration_seconds: int = Field(default=30, ge=5, le=120)
    model_id: str = Field(default="musicgen")


class GenerateResponse(BaseModel):
    """Shared response for both generation endpoints."""

    status: str
    audio_url: str | None = None
    error: str | None = None
    model_id: str = ""


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/generate", response_model=GenerateResponse)
async def generate_audio(body: GenerateRequest) -> GenerateResponse:
    """Generate audio from a text prompt."""
    from album_conceptualizer.integrations.audio_gen import (
        AudioGenRequest,
        ReplicateProvider,
    )

    settings = get_settings()
    provider = ReplicateProvider(api_token=settings.replicate_api_token)

    if not provider.is_available():
        raise HTTPException(
            status_code=503,
            detail="Audio generation not configured. Set REPLICATE_API_TOKEN.",
        )

    request = AudioGenRequest(
        prompt=body.prompt,
        duration_seconds=body.duration_seconds,
        model_id=body.model_id,
    )
    result = await provider.generate(request)

    return GenerateResponse(
        status=result.status.value,
        audio_url=result.audio_url,
        error=result.error,
        model_id=result.model_id,
    )


@router.post("/generate-from-song", response_model=GenerateResponse)
async def generate_from_song(body: GenerateFromSongRequest) -> GenerateResponse:
    """Generate audio from song metadata (builds prompt automatically)."""
    from album_conceptualizer.integrations.audio_gen import (
        AudioGenRequest,
        ReplicateProvider,
        build_song_prompt,
    )

    settings = get_settings()
    provider = ReplicateProvider(api_token=settings.replicate_api_token)

    if not provider.is_available():
        raise HTTPException(
            status_code=503,
            detail="Audio generation not configured. Set REPLICATE_API_TOKEN.",
        )

    prompt = build_song_prompt(
        song_title=body.song_title,
        genre_tags=body.genre_tags,
        mood_tags=body.mood_tags,
        instrumentation=body.instrumentation,
        tempo=body.tempo,
        key=body.key,
        concept_summary=body.concept_summary,
    )

    request = AudioGenRequest(
        prompt=prompt,
        duration_seconds=body.duration_seconds,
        model_id=body.model_id,
    )
    result = await provider.generate(request)

    return GenerateResponse(
        status=result.status.value,
        audio_url=result.audio_url,
        error=result.error,
        model_id=result.model_id,
    )
