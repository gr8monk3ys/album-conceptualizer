"""Agent workflow API endpoints."""

from __future__ import annotations

import logging
import os
from typing import Any, cast

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field, model_validator

from album_conceptualizer.api.jobs import Job, JobStatus, JobStore
from album_conceptualizer.api.metrics import MetricsRegistry
from album_conceptualizer.config import get_settings
from album_conceptualizer.models.album import Album
from album_conceptualizer.models.album_bible import AlbumBible
from album_conceptualizer.models.snapshot import (
    InvalidSnapshotError,
    album_from_snapshot,
    bible_from_album,
)


logger = logging.getLogger(__name__)

CREW_TIMEOUT_SECONDS = int(os.environ.get("ALBUM_CONCEPTUALIZER_CREW_TIMEOUT", "180"))
MAX_ACTIVE_JOBS = int(os.environ.get("ALBUM_CONCEPTUALIZER_MAX_ACTIVE_JOBS", "5"))


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


class AlbumTarget(BaseModel):
    """Identifies the album an agent works on.

    Callers that own the album (the web app) send ``album``, a snapshot of the album JSON,
    and the engine derives the Album Bible from it. ``album_id`` looks the album and its
    bible up in the engine's own stores instead.
    """

    album: dict[str, Any] | None = Field(
        default=None, description="Album JSON snapshot, as accepted by /export/album/zip."
    )
    album_id: str | None = None

    @model_validator(mode="after")
    def _require_album(self) -> AlbumTarget:
        if self.album is None and not self.album_id:
            raise ValueError("Provide either 'album' (a snapshot) or 'album_id'.")
        return self


class SongDevelopmentRequest(AlbumTarget):
    song_title: str
    track_number: int = Field(ge=1)
    mood: str | None = None
    style_reference: str | None = None
    song_structure: str | None = None


class CoherenceReviewRequest(AlbumTarget):
    pass


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


def _check_concurrency_limit(job_store: JobStore) -> None:
    """Reject if the global active-job limit is reached."""
    active = job_store.count_active()
    if active >= MAX_ACTIVE_JOBS:
        raise HTTPException(
            status_code=429,
            detail=f"Too many active agent jobs ({active}). "
            f"Wait for running jobs to complete before starting another.",
            headers={"retry-after": "30"},
        )


def _get_metrics(request: Request) -> MetricsRegistry | None:
    return getattr(request.app.state, "metrics", None)


def _get_owner_id(request: Request) -> str | None:
    """Extract owner ID from X-Owner-Id header (set by the Next.js proxy)."""
    return request.headers.get("x-owner-id")


def _resolve_album(
    target: AlbumTarget, request: Request, workflow: str
) -> tuple[Album, AlbumBible]:
    """Return the album and bible an agent should work on, or raise 400/404."""
    if target.album is not None:
        try:
            album = album_from_snapshot(target.album)
        except InvalidSnapshotError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        style_bible = target.album.get("style_bible")
        return album, bible_from_album(
            album, style_bible if isinstance(style_bible, dict) else None
        )

    album_id = cast("str", target.album_id)
    stored = request.app.state.album_store.get(album_id)
    if stored is None:
        raise HTTPException(status_code=404, detail="Album not found")
    bible = request.app.state.bible_store.get(album_id)
    if bible is None:
        raise HTTPException(
            status_code=404,
            detail=f"Album bible not found. Create one before running {workflow}.",
        )
    return stored, bible


def _launch(request: Request, workflow: str, crew: Any) -> JobResponse:
    """Run ``crew`` as a supervised job owned by the caller."""
    job_store: JobStore = request.app.state.job_store
    metrics = _get_metrics(request)
    if metrics:
        metrics.record_agent_start(workflow)

    def on_finish(outcome: str) -> None:
        if not metrics:
            return
        if outcome == "completed":
            metrics.record_agent_complete(workflow)
        else:
            metrics.record_agent_failure(
                workflow, "timeout" if outcome == "timeout" else "crew_error"
            )

    job = job_store.submit(
        workflow,
        lambda: {"output": str(crew.kickoff())},
        owner_id=_get_owner_id(request),
        timeout_seconds=CREW_TIMEOUT_SECONDS,
        timeout_message=f"Timed out after {CREW_TIMEOUT_SECONDS}s.",
        on_finish=on_finish,
    )
    return _job_to_response(job)


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
    _check_concurrency_limit(request.app.state.job_store)

    crew = create_album_ideation_crew(
        concept=req.concept,
        references=req.references,
        themes=req.themes,
        track_count=req.track_count,
    )
    return _launch(request, "ideation", crew)


@router.post("/song-development", status_code=202)
def start_song_development(req: SongDevelopmentRequest, request: Request) -> JobResponse:
    _album, bible = _resolve_album(req, request, "song development")
    _require_anthropic_key()
    _require_crew_function(create_song_development_crew)
    _check_concurrency_limit(request.app.state.job_store)

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
    return _launch(request, "song_development", crew)


@router.post("/coherence-review", status_code=202)
def start_coherence_review(req: CoherenceReviewRequest, request: Request) -> JobResponse:
    album, bible = _resolve_album(req, request, "coherence review")
    _require_anthropic_key()
    _require_crew_function(create_coherence_review_crew)
    _check_concurrency_limit(request.app.state.job_store)

    album_content = "\n\n".join(
        f"Track {song.track_number}: {song.title}\n"
        + "\n".join(f"[{s.section_type}] {s.lyrics or ''}" for s in (song.sections or []))
        for song in album.songs
    )

    crew = create_coherence_review_crew(
        album_bible=bible,
        album_content=album_content or "(no song content yet)",
    )
    return _launch(request, "coherence_review", crew)


@router.get("/jobs", status_code=200)
def list_jobs(
    request: Request,
    status: JobStatus | None = Query(None, description="Filter by job status"),  # noqa: B008
) -> list[JobResponse]:
    job_store: JobStore = request.app.state.job_store
    return [_job_to_response(j) for j in job_store.list_for(_get_owner_id(request), status=status)]


@router.get("/jobs/{job_id}", status_code=200)
def get_job(job_id: str, request: Request) -> JobResponse:
    job_store: JobStore = request.app.state.job_store
    job = job_store.get_for(job_id, _get_owner_id(request))
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_to_response(job)


@router.delete("/jobs/{job_id}", status_code=204)
def delete_job(job_id: str, request: Request) -> None:
    job_store: JobStore = request.app.state.job_store
    if job_store.get_for(job_id, _get_owner_id(request)) is None or not job_store.delete(job_id):
        raise HTTPException(status_code=404, detail="Job not found")
