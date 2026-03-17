"""Agent workflow API endpoints."""

from __future__ import annotations

import threading
import time
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from album_conceptualizer.api.jobs import Job, JobStatus, JobStore
from album_conceptualizer.config import get_settings


try:
    from album_conceptualizer.agents.crew import (
        create_album_ideation_crew,
        create_coherence_review_crew,
        create_song_development_crew,
    )

except ImportError:  # crewai not installed ([ai] extra)
    create_album_ideation_crew = None  # type: ignore[assignment]
    create_song_development_crew = None  # type: ignore[assignment]
    create_coherence_review_crew = None  # type: ignore[assignment]

router = APIRouter(prefix="/agents")


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------


class IdeationRequest(BaseModel):
    concept: str
    references: str = ""
    themes: str = ""
    track_count: int = Field(default=10, ge=3, le=25)


class SongDevelopmentRequest(BaseModel):
    album_id: str
    song_title: str
    track_number: int = Field(ge=1)
    mood: str | None = None
    style_reference: str | None = None
    song_structure: str | None = None


class CoherenceReviewRequest(BaseModel):
    album_id: str


class JobResponse(BaseModel):
    job_id: str
    status: JobStatus
    created_at: float
    completed_at: float | None = None
    result: dict | None = None
    error: str | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _require_anthropic_key() -> None:
    settings = get_settings()
    if not settings.anthropic_api_key:
        raise HTTPException(
            status_code=503,
            detail="ANTHROPIC_API_KEY is not configured. Agent workflows require an LLM API key.",
        )


def _require_crew_function(fn: Any) -> None:
    if fn is None:
        raise HTTPException(
            status_code=503,
            detail="Agent workflows require the [ai] extra. "
            "Install with: pip install album-conceptualizer[ai]",
        )


def _run_crew_in_thread(job_store: JobStore, job_id: str, crew: Any) -> None:
    """Execute a CrewAI crew in a background thread."""
    job_store.update(job_id, status=JobStatus.RUNNING)
    try:
        result = crew.kickoff()
        job_store.update(
            job_id,
            status=JobStatus.COMPLETED,
            result={"output": str(result)},
            completed_at=time.time(),
        )
    except Exception as exc:
        job_store.update(
            job_id,
            status=JobStatus.FAILED,
            error=str(exc),
            completed_at=time.time(),
        )


def _job_to_response(job: Job) -> JobResponse:
    return JobResponse(
        job_id=job.id,
        status=job.status,
        created_at=job.created_at,
        completed_at=job.completed_at,
        result=job.result,
        error=job.error,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/ideation", status_code=202)
def start_ideation(req: IdeationRequest, request: Request) -> JobResponse:
    _require_anthropic_key()
    _require_crew_function(create_album_ideation_crew)

    crew = create_album_ideation_crew(
        concept=req.concept,
        references=req.references,
        themes=req.themes,
        track_count=req.track_count,
    )

    job_store: JobStore = request.app.state.job_store
    job = job_store.create("ideation")
    response = _job_to_response(job)
    thread = threading.Thread(
        target=_run_crew_in_thread,
        args=(job_store, job.id, crew),
        daemon=True,
    )
    thread.start()
    return response


@router.post("/song-development", status_code=202)
def start_song_development(req: SongDevelopmentRequest, request: Request) -> JobResponse:
    _require_anthropic_key()

    album = request.app.state.album_store.get(req.album_id)
    if album is None:
        raise HTTPException(status_code=404, detail="Album not found")

    bible = request.app.state.bible_store.get(req.album_id)
    if bible is None:
        raise HTTPException(
            status_code=404,
            detail="Album bible not found. Create one before running song development.",
        )

    _require_crew_function(create_song_development_crew)

    kwargs: dict = {}
    if req.mood is not None:
        kwargs["mood"] = req.mood
    if req.style_reference is not None:
        kwargs["style_reference"] = req.style_reference
    if req.song_structure is not None:
        kwargs["song_structure"] = req.song_structure

    crew = create_song_development_crew(
        song_title=req.song_title,
        track_number=req.track_number,
        album_bible=bible,
        **kwargs,
    )

    job_store: JobStore = request.app.state.job_store
    job = job_store.create("song_development")
    response = _job_to_response(job)
    thread = threading.Thread(
        target=_run_crew_in_thread,
        args=(job_store, job.id, crew),
        daemon=True,
    )
    thread.start()
    return response


@router.post("/coherence-review", status_code=202)
def start_coherence_review(req: CoherenceReviewRequest, request: Request) -> JobResponse:
    _require_anthropic_key()

    album = request.app.state.album_store.get(req.album_id)
    if album is None:
        raise HTTPException(status_code=404, detail="Album not found")

    bible = request.app.state.bible_store.get(req.album_id)
    if bible is None:
        raise HTTPException(
            status_code=404,
            detail="Album bible not found. Create one before running coherence review.",
        )

    # Assemble album content from stored songs
    album_content = "\n\n".join(
        f"Track {song.track_number}: {song.title}\n"
        + "\n".join(
            f"[{s.section_type}] {s.lyrics or ''}" for s in (song.sections or [])
        )
        for song in album.songs
    )

    _require_crew_function(create_coherence_review_crew)

    crew = create_coherence_review_crew(
        album_bible=bible,
        album_content=album_content or "(no song content yet)",
    )

    job_store: JobStore = request.app.state.job_store
    job = job_store.create("coherence_review")
    response = _job_to_response(job)
    thread = threading.Thread(
        target=_run_crew_in_thread,
        args=(job_store, job.id, crew),
        daemon=True,
    )
    thread.start()
    return response


@router.get("/jobs", status_code=200)
def list_jobs(
    request: Request,
    status: JobStatus | None = Query(None, description="Filter by job status"),  # noqa: B008
) -> list[JobResponse]:
    job_store: JobStore = request.app.state.job_store
    return [_job_to_response(j) for j in job_store.list(status=status)]


@router.get("/jobs/{job_id}", status_code=200)
def get_job(job_id: str, request: Request) -> JobResponse:
    job_store: JobStore = request.app.state.job_store
    job = job_store.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_to_response(job)


@router.delete("/jobs/{job_id}", status_code=204)
def delete_job(job_id: str, request: Request) -> None:
    job_store: JobStore = request.app.state.job_store
    if not job_store.delete(job_id):
        raise HTTPException(status_code=404, detail="Job not found")
