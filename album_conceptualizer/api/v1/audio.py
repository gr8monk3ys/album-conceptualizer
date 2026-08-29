"""In-app music generation endpoints.

Async by necessity: hosted music models take tens of seconds to minutes, well
past any sensible HTTP timeout. Mirrors the agents router -- submit returns a
job id, the client polls -- so there is one job-shaped contract in this API
rather than two.
"""

from __future__ import annotations

import logging
import mimetypes
import os
import re
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeoutError
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from album_conceptualizer.api.jobs import Job, JobStatus, JobStore
from album_conceptualizer.audio.prompt import (
    GenerationBrief,
    build_generation_prompt,
    build_negative_prompt,
)
from album_conceptualizer.audio.providers import (
    GenerationRequest,
    ProviderNotConfiguredError,
    ProviderRequestError,
    get_provider,
)


logger = logging.getLogger(__name__)

GENERATION_TIMEOUT_SECONDS = int(os.environ.get("MUSIC_GENERATION_TIMEOUT", "420"))
MAX_ACTIVE_RENDERS = int(os.environ.get("MUSIC_MAX_ACTIVE_RENDERS", "3"))

# Where inline audio lands. Providers that return bytes (Hugging Face) have
# nothing hosting the file but us, so it is written here and served back.
RENDER_DIR = Path(os.environ.get("MUSIC_RENDER_DIR", "output/renders"))

# Render ids are generated, never user-supplied, so the served name is
# constrained to exactly the shape this module writes. Anything else is a
# 404 before it can reach the filesystem.
_RENDER_NAME = re.compile(r"^[0-9a-f]{32}\.[a-z0-9]{1,5}$")

# Explicit, because mimetypes is environment-dependent (see _persist_render).
# Covers what hosted music models actually return.
_AUDIO_EXTENSIONS: dict[str, str] = {
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/wave": ".wav",
    "audio/vnd.wave": ".wav",
    "audio/flac": ".flac",
    "audio/x-flac": ".flac",
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/ogg": ".ogg",
    "audio/opus": ".opus",
    "audio/webm": ".webm",
    "audio/mp4": ".m4a",
    "audio/aac": ".aac",
}

router = APIRouter(prefix="/audio")

# Renders are tracked in their own store. Sharing the agents' store would let
# a burst of text workflows consume the render concurrency budget and vice
# versa, and the two have very different runtimes.
_render_jobs = JobStore(ttl_seconds=3600)


class GenerateRequest(BaseModel):
    """The album fields the prompt is built from.

    Accepts a brief rather than an album id because the engine is stateless
    with respect to the web app's database -- the caller owns the album and
    sends what it wants rendered. That also keeps it obvious which fields
    leave the system for a third party.
    """

    song_title: str = Field(min_length=1, max_length=200)
    album_genre: str | None = Field(default=None, max_length=120)
    concept_summary: str | None = Field(default=None, max_length=2000)
    lead_voice: str | None = Field(default=None, max_length=200)
    sonic_palette: list[str] = Field(default_factory=list, max_length=24)
    emotional_targets: list[str] = Field(default_factory=list, max_length=24)
    avoid_list: list[str] = Field(default_factory=list, max_length=24)
    tempo: int | None = Field(default=None, ge=20, le=300)
    key: str | None = Field(default=None, max_length=40)
    mood_tags: list[str] = Field(default_factory=list, max_length=24)
    instrumentation: list[str] = Field(default_factory=list, max_length=24)
    narrative_summary: str | None = Field(default=None, max_length=2000)
    duration_seconds: int = Field(default=30, ge=5, le=300)
    instrumental: bool = True
    seed: int | None = Field(default=None, ge=0)

    def to_brief(self) -> GenerationBrief:
        return GenerationBrief(**self.model_dump(exclude={"seed"}))


class RenderJobResponse(BaseModel):
    job_id: str
    status: JobStatus
    created_at: float
    completed_at: float | None = None
    result: dict | None = None
    error: str | None = None


class PromptPreviewResponse(BaseModel):
    """What would be sent, without spending anything.

    Exists because a render costs real money and takes minutes; letting a
    caller see the exact prompt first turns "generate and hope" into an
    editable step, and makes the album-coherence claim inspectable.
    """

    prompt: str
    negative_prompt: str
    provider: str
    duration_seconds: int


def _owner_id(request: Request) -> str | None:
    return request.headers.get("x-owner-id")


def _job_to_response(job: Job) -> RenderJobResponse:
    return RenderJobResponse(
        job_id=job.id,
        status=job.status,
        created_at=job.created_at,
        completed_at=job.completed_at,
        result=job.result,
        error=job.error,
    )


def _persist_render(audio: bytes, content_type: str) -> str:
    """Write inline audio and return the path it is served from.

    The extension comes from the provider's content-type, not the model name:
    MusicGen returns WAV while others return FLAC or MP3, and a .wav holding
    FLAC is a file players refuse to open.
    """
    extension = _AUDIO_EXTENSIONS.get((content_type or "").lower())
    if extension is None:
        # Fall back to the platform table, then to .wav. mimetypes is only a
        # fallback because it reads OS mime databases and genuinely differs
        # between environments -- 'audio/flac' resolves to '.flac' under one
        # interpreter here and to None under another, which is precisely the
        # bug that passes locally and fails in CI.
        extension = mimetypes.guess_extension(content_type or "") or ".wav"
    if extension == ".wave":
        extension = ".wav"
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}{extension}"
    (RENDER_DIR / name).write_bytes(audio)
    return f"/api/v1/audio/renders/{name}"


def _run_generation(job_id: str, payload: GenerateRequest) -> None:
    _render_jobs.update(job_id, status=JobStatus.RUNNING)
    brief = payload.to_brief()
    prompt = build_generation_prompt(brief)
    generation = GenerationRequest(
        prompt=prompt,
        duration_seconds=payload.duration_seconds,
        negative_prompt=build_negative_prompt(brief),
        seed=payload.seed,
    )

    def _call() -> dict:
        result = get_provider().generate(generation)
        audio_url = result.audio_url
        if result.audio_bytes is not None:
            # Persist BEFORE reporting success. Nothing else hosts these
            # bytes, so a job that returns without writing them has produced
            # a result that points at nothing.
            audio_url = _persist_render(result.audio_bytes, result.content_type)
        return {
            "audio_url": audio_url,
            "provider": result.provider,
            "model": result.model,
            "duration_seconds": result.duration_seconds,
            "prompt": result.prompt,
            "seed": result.seed,
        }

    # The provider already bounds its own polling, but a hung socket inside
    # httpx would otherwise pin a job in RUNNING until TTL eviction, which
    # reads to the caller as "still working" forever.
    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(_call)
        try:
            _render_jobs.update(
                job_id,
                status=JobStatus.COMPLETED,
                result=future.result(timeout=GENERATION_TIMEOUT_SECONDS),
                completed_at=time.time(),
            )
        except FutureTimeoutError:
            future.cancel()
            _render_jobs.update(
                job_id,
                status=JobStatus.FAILED,
                error=f"Generation timed out after {GENERATION_TIMEOUT_SECONDS}s.",
                completed_at=time.time(),
            )
            logger.warning("music_generation_timeout", extra={"job_id": job_id})
        except (ProviderNotConfiguredError, ProviderRequestError) as exc:
            # Provider errors are the expected failure mode and are already
            # written for a human; pass them through verbatim rather than
            # flattening them into "generation failed".
            _render_jobs.update(
                job_id, status=JobStatus.FAILED, error=str(exc), completed_at=time.time()
            )
            logger.warning("music_generation_failed", extra={"job_id": job_id, "error": str(exc)})
        except Exception as exc:  # a job must never die silently
            _render_jobs.update(
                job_id, status=JobStatus.FAILED, error=str(exc), completed_at=time.time()
            )
            logger.exception("music_generation_error", exc_info=exc, extra={"job_id": job_id})


@router.post("/prompt-preview", response_model=PromptPreviewResponse)
async def preview_prompt(payload: GenerateRequest) -> PromptPreviewResponse:
    """Show the exact prompt a render would use. Costs nothing, spends nothing."""
    brief = payload.to_brief()
    return PromptPreviewResponse(
        prompt=build_generation_prompt(brief),
        negative_prompt=build_negative_prompt(brief),
        provider=get_provider().name,
        duration_seconds=payload.duration_seconds,
    )


@router.post("/generate", response_model=RenderJobResponse, status_code=202)
async def generate(
    payload: GenerateRequest, request: Request, background_tasks: BackgroundTasks
) -> RenderJobResponse:
    provider = get_provider()
    if provider.name == "unconfigured":
        # Fail before creating a job: a job that can only ever fail is worse
        # than a straight answer, and 503 tells the caller it is the server's
        # configuration at fault, not their request.
        raise HTTPException(
            status_code=503,
            detail=(
                "In-app rendering is not enabled. Set MUSIC_PROVIDER and "
                "REPLICATE_API_TOKEN in the engine environment."
            ),
        )

    owner = _owner_id(request)
    active = _render_jobs.count_active(owner_id=owner)
    if active >= MAX_ACTIVE_RENDERS:
        raise HTTPException(
            status_code=429,
            detail=(
                f"You already have {active} render(s) in flight. "
                "Wait for one to finish before starting another."
            ),
            headers={"retry-after": "30"},
        )

    job = _render_jobs.create("music_generation", owner_id=owner)
    background_tasks.add_task(_run_generation, job.id, payload)
    return _job_to_response(job)


@router.get("/generate/{job_id}", response_model=RenderJobResponse)
async def get_render_job(job_id: str, request: Request) -> RenderJobResponse:
    job = _render_jobs.get(job_id)
    # Scope by owner so one tenant cannot read another's render, and return
    # 404 rather than 403 so job ids are not enumerable.
    owner = _owner_id(request)
    if job is None or (job.owner_id is not None and job.owner_id != owner):
        raise HTTPException(status_code=404, detail="Render job not found.")
    return _job_to_response(job)


@router.get("/renders/{name}")
async def get_render(name: str) -> FileResponse:
    """Serve a persisted render.

    Names are validated against the exact generated shape rather than
    sanitised: a rejected name never becomes a path, so traversal has nothing
    to work with. Resolve-and-compare is kept as a second gate in case the
    pattern is ever loosened.
    """
    if not _RENDER_NAME.match(name):
        raise HTTPException(status_code=404, detail="Render not found.")
    path = (RENDER_DIR / name).resolve()
    if not str(path).startswith(str(RENDER_DIR.resolve())) or not path.is_file():
        raise HTTPException(status_code=404, detail="Render not found.")
    return FileResponse(path)
