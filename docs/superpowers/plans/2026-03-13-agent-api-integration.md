# Agent API Integration — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the three existing CrewAI agent workflows (ideation, song development, coherence review) via REST API endpoints with async job management.

**Architecture:** Fire-and-poll pattern. POST endpoints create a job, spawn a background thread to run the crew, and return a job ID immediately (202). Clients poll GET to retrieve status/result. All storage reads happen synchronously in the request handler; the background thread only runs the crew.

**Tech Stack:** FastAPI, CrewAI (existing), Pydantic, threading, uuid4

**Spec:** `docs/superpowers/specs/2026-03-13-agent-api-integration-design.md`

---

## Chunk 1: Job System

### Task 1: Job store module

**Files:**
- Create: `album_conceptualizer/api/jobs.py`
- Test: `tests/test_jobs.py`

- [ ] **Step 1: Write tests for Job and JobStore**

```python
# tests/test_jobs.py
"""Tests for the in-memory job store."""

import threading
import time

from album_conceptualizer.api.jobs import Job, JobStatus, JobStore


class TestJobStore:
    def test_create_job(self) -> None:
        store = JobStore()
        job = store.create("ideation")
        assert job.status == JobStatus.PENDING
        assert job.crew_type == "ideation"
        assert job.id

    def test_get_job(self) -> None:
        store = JobStore()
        job = store.create("ideation")
        fetched = store.get(job.id)
        assert fetched is not None
        assert fetched.id == job.id

    def test_get_missing_returns_none(self) -> None:
        store = JobStore()
        assert store.get("nonexistent") is None

    def test_update_job_status(self) -> None:
        store = JobStore()
        job = store.create("ideation")
        store.update(job.id, status=JobStatus.RUNNING)
        assert store.get(job.id).status == JobStatus.RUNNING

    def test_update_job_result(self) -> None:
        store = JobStore()
        job = store.create("ideation")
        store.update(job.id, status=JobStatus.COMPLETED, result={"output": "done"})
        fetched = store.get(job.id)
        assert fetched.status == JobStatus.COMPLETED
        assert fetched.result == {"output": "done"}

    def test_update_job_error(self) -> None:
        store = JobStore()
        job = store.create("ideation")
        store.update(job.id, status=JobStatus.FAILED, error="boom")
        fetched = store.get(job.id)
        assert fetched.status == JobStatus.FAILED
        assert fetched.error == "boom"

    def test_list_all_jobs(self) -> None:
        store = JobStore()
        store.create("ideation")
        store.create("song_development")
        assert len(store.list()) == 2

    def test_list_filtered_by_status(self) -> None:
        store = JobStore()
        j1 = store.create("ideation")
        store.create("song_development")
        store.update(j1.id, status=JobStatus.RUNNING)
        running = store.list(status=JobStatus.RUNNING)
        assert len(running) == 1
        assert running[0].id == j1.id

    def test_delete_job(self) -> None:
        store = JobStore()
        job = store.create("ideation")
        assert store.delete(job.id) is True
        assert store.get(job.id) is None

    def test_delete_missing_returns_false(self) -> None:
        store = JobStore()
        assert store.delete("ghost") is False

    def test_evict_stale_jobs(self) -> None:
        store = JobStore(ttl_seconds=0)
        job = store.create("ideation")
        store.update(job.id, status=JobStatus.COMPLETED)
        # Eviction runs on next access
        time.sleep(0.01)
        assert store.get(job.id) is None

    def test_thread_safety(self) -> None:
        store = JobStore()
        jobs = []

        def create_jobs():
            for _ in range(50):
                jobs.append(store.create("ideation"))

        threads = [threading.Thread(target=create_jobs) for _ in range(4)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        assert len(store.list()) == 200
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/test_jobs.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'album_conceptualizer.api.jobs'`

- [ ] **Step 3: Implement JobStore**

```python
# album_conceptualizer/api/jobs.py
"""In-memory job store for async agent workflows."""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from enum import StrEnum
from uuid import uuid4


class JobStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class Job:
    id: str
    crew_type: str
    status: JobStatus = JobStatus.PENDING
    created_at: float = field(default_factory=time.time)
    completed_at: float | None = None
    result: dict | None = None
    error: str | None = None


class JobStore:
    """Thread-safe in-memory job store with TTL eviction."""

    def __init__(self, ttl_seconds: int = 3600) -> None:
        self._jobs: dict[str, Job] = {}
        self._ttl = ttl_seconds
        self._lock = threading.Lock()

    def create(self, crew_type: str) -> Job:
        job = Job(id=uuid4().hex, crew_type=crew_type)
        with self._lock:
            self._jobs[job.id] = job
        return job

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            self._evict_stale()
            return self._jobs.get(job_id)

    def list(self, status: JobStatus | None = None) -> list[Job]:
        with self._lock:
            self._evict_stale()
            jobs = list(self._jobs.values())
        if status is not None:
            jobs = [j for j in jobs if j.status == status]
        return jobs

    def update(self, job_id: str, **kwargs: object) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            for key, value in kwargs.items():
                setattr(job, key, value)

    def delete(self, job_id: str) -> bool:
        with self._lock:
            return self._jobs.pop(job_id, None) is not None

    def _evict_stale(self) -> None:
        """Remove completed/failed jobs older than TTL. Caller holds lock."""
        now = time.time()
        stale = [
            jid
            for jid, job in self._jobs.items()
            if job.completed_at is not None and (now - job.completed_at) > self._ttl
        ]
        for jid in stale:
            del self._jobs[jid]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/test_jobs.py -v`
Expected: All PASS

- [ ] **Step 5: Lint**

Run: `uv run ruff check album_conceptualizer/api/jobs.py tests/test_jobs.py`
Expected: Clean

- [ ] **Step 6: Commit**

```bash
git add album_conceptualizer/api/jobs.py tests/test_jobs.py
git commit -m "feat(api): add in-memory job store for agent workflows"
```

---

## Chunk 2: Agent Route Handlers

### Task 2: Agent API routes

**Files:**
- Create: `album_conceptualizer/api/v1/agents.py`
- Modify: `album_conceptualizer/api/v1/__init__.py:33-38` — add agents router
- Modify: `album_conceptualizer/api/app.py:64-90` — add JobStore to `_initialize_state`
- Test: `tests/test_agents_api.py`

- [ ] **Step 1: Write tests for agent endpoints**

These tests mock the crew creation functions so no LLM calls are made. The mock crews return instantly with a canned result.

```python
# tests/test_agents_api.py
"""Tests for agent API endpoints."""

import time
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from album_conceptualizer.api.app import create_app
from album_conceptualizer.api.jobs import JobStatus
from album_conceptualizer.config import reset_settings
from album_conceptualizer.models.album import Section, SectionType, Song


@pytest.fixture
def agent_client(monkeypatch):
    """Client with no auth and ANTHROPIC_API_KEY set."""
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_STORAGE_BACKEND", "memory")
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEY", raising=False)
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEYS", raising=False)
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_STRICT_PRODUCTION", raising=False)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    reset_settings()
    app = create_app()
    with TestClient(app) as tc:
        yield tc
    reset_settings()


def _mock_crew():
    """Return a mock Crew whose kickoff() returns a canned result."""
    crew = MagicMock()
    crew.kickoff.return_value = "Album vision: a concept album about time travel"
    return crew


def _seed_album(client: TestClient) -> str:
    """Create an album and return its ID."""
    resp = client.post(
        "/api/v1/albums",
        json={"title": "Test Album", "artist": "Artist"},
    )
    return resp.json()["id"]


def _seed_bible(client: TestClient, album_id: str) -> None:
    """Create an album bible."""
    client.put(
        f"/api/v1/albums/{album_id}/bible",
        json={
            "album_title": "Test Album",
            "logline": "A test album.",
            "synopsis": "Synopsis.",
            "themes": [{"name": "Test", "description": "A test theme"}],
        },
    )


class TestIdeation:
    @patch("album_conceptualizer.api.v1.agents.create_album_ideation_crew")
    def test_start_ideation_returns_202(self, mock_create, agent_client):
        mock_create.return_value = _mock_crew()
        resp = agent_client.post(
            "/api/v1/agents/ideation",
            json={"concept": "Time travel love story"},
        )
        assert resp.status_code == 202
        data = resp.json()
        assert "job_id" in data
        assert data["status"] == "pending"

    @patch("album_conceptualizer.api.v1.agents.create_album_ideation_crew")
    def test_ideation_job_completes(self, mock_create, agent_client):
        mock_create.return_value = _mock_crew()
        resp = agent_client.post(
            "/api/v1/agents/ideation",
            json={"concept": "Time travel love story"},
        )
        job_id = resp.json()["job_id"]
        # Poll until complete (mock is instant)
        for _ in range(20):
            poll = agent_client.get(f"/api/v1/agents/jobs/{job_id}")
            if poll.json()["status"] in ("completed", "failed"):
                break
            time.sleep(0.1)
        assert poll.json()["status"] == "completed"
        assert poll.json()["result"]["output"]

    def test_ideation_missing_concept_returns_422(self, agent_client):
        resp = agent_client.post("/api/v1/agents/ideation", json={})
        assert resp.status_code == 422


class TestSongDevelopment:
    @patch("album_conceptualizer.api.v1.agents.create_song_development_crew")
    def test_start_song_dev_returns_202(self, mock_create, agent_client):
        mock_create.return_value = _mock_crew()
        album_id = _seed_album(agent_client)
        _seed_bible(agent_client, album_id)
        resp = agent_client.post(
            "/api/v1/agents/song-development",
            json={
                "album_id": album_id,
                "song_title": "Track 1",
                "track_number": 1,
            },
        )
        assert resp.status_code == 202

    @patch("album_conceptualizer.api.v1.agents.create_song_development_crew")
    def test_song_dev_album_not_found(self, mock_create, agent_client):
        resp = agent_client.post(
            "/api/v1/agents/song-development",
            json={
                "album_id": "nonexistent",
                "song_title": "Track 1",
                "track_number": 1,
            },
        )
        assert resp.status_code == 404

    @patch("album_conceptualizer.api.v1.agents.create_song_development_crew")
    def test_song_dev_bible_not_found(self, mock_create, agent_client):
        album_id = _seed_album(agent_client)
        # No bible created
        resp = agent_client.post(
            "/api/v1/agents/song-development",
            json={
                "album_id": album_id,
                "song_title": "Track 1",
                "track_number": 1,
            },
        )
        assert resp.status_code == 404
        assert "bible" in resp.json()["detail"].lower()


class TestCoherenceReview:
    @patch("album_conceptualizer.api.v1.agents.create_coherence_review_crew")
    def test_start_coherence_review_returns_202(self, mock_create, agent_client):
        mock_create.return_value = _mock_crew()
        album_id = _seed_album(agent_client)
        _seed_bible(agent_client, album_id)
        resp = agent_client.post(
            "/api/v1/agents/coherence-review",
            json={"album_id": album_id},
        )
        assert resp.status_code == 202

    @patch("album_conceptualizer.api.v1.agents.create_coherence_review_crew")
    def test_coherence_with_songs_assembles_content(self, mock_create, agent_client):
        """Verify album_content is assembled from songs and sections."""
        mock_create.return_value = _mock_crew()
        album_id = _seed_album(agent_client)
        _seed_bible(agent_client, album_id)
        # Add a song with sections
        agent_client.post(
            f"/api/v1/albums/{album_id}/songs",
            json={
                "title": "Opening",
                "track_number": 1,
                "sections": [
                    {"section_type": "verse", "order": 1, "lyrics": "Hello world"},
                    {"section_type": "chorus", "order": 2, "lyrics": "La la la"},
                ],
            },
        )
        resp = agent_client.post(
            "/api/v1/agents/coherence-review",
            json={"album_id": album_id},
        )
        assert resp.status_code == 202
        # Verify the crew was called with assembled content
        call_kwargs = mock_create.call_args
        album_content = call_kwargs.kwargs.get("album_content") or call_kwargs[1].get(
            "album_content", call_kwargs[0][1] if len(call_kwargs[0]) > 1 else ""
        )
        assert "Opening" in album_content
        assert "Hello world" in album_content

    @patch("album_conceptualizer.api.v1.agents.create_coherence_review_crew")
    def test_coherence_album_not_found(self, mock_create, agent_client):
        resp = agent_client.post(
            "/api/v1/agents/coherence-review",
            json={"album_id": "nonexistent"},
        )
        assert resp.status_code == 404


class TestJobEndpoints:
    @patch("album_conceptualizer.api.v1.agents.create_album_ideation_crew")
    def test_list_jobs(self, mock_create, agent_client):
        mock_create.return_value = _mock_crew()
        agent_client.post(
            "/api/v1/agents/ideation",
            json={"concept": "Album 1"},
        )
        agent_client.post(
            "/api/v1/agents/ideation",
            json={"concept": "Album 2"},
        )
        resp = agent_client.get("/api/v1/agents/jobs")
        assert resp.status_code == 200
        assert len(resp.json()) >= 2

    @patch("album_conceptualizer.api.v1.agents.create_album_ideation_crew")
    def test_list_jobs_filtered_by_status(self, mock_create, agent_client):
        mock_create.return_value = _mock_crew()
        agent_client.post(
            "/api/v1/agents/ideation",
            json={"concept": "Album"},
        )
        # Wait for completion
        time.sleep(0.3)
        resp = agent_client.get("/api/v1/agents/jobs?status=completed")
        assert resp.status_code == 200
        for job in resp.json():
            assert job["status"] == "completed"

    def test_get_job_not_found(self, agent_client):
        resp = agent_client.get("/api/v1/agents/jobs/nonexistent")
        assert resp.status_code == 404

    @patch("album_conceptualizer.api.v1.agents.create_album_ideation_crew")
    def test_delete_completed_job(self, mock_create, agent_client):
        mock_create.return_value = _mock_crew()
        resp = agent_client.post(
            "/api/v1/agents/ideation",
            json={"concept": "Throwaway"},
        )
        job_id = resp.json()["job_id"]
        # Wait for completion
        for _ in range(20):
            poll = agent_client.get(f"/api/v1/agents/jobs/{job_id}")
            if poll.json()["status"] in ("completed", "failed"):
                break
            time.sleep(0.1)
        delete = agent_client.delete(f"/api/v1/agents/jobs/{job_id}")
        assert delete.status_code == 204
        assert agent_client.get(f"/api/v1/agents/jobs/{job_id}").status_code == 404

    def test_delete_nonexistent_job(self, agent_client):
        resp = agent_client.delete("/api/v1/agents/jobs/ghost")
        assert resp.status_code == 404


class TestNoApiKey:
    @patch("album_conceptualizer.api.v1.agents.create_album_ideation_crew")
    def test_ideation_without_anthropic_key(self, mock_create, monkeypatch):
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_STORAGE_BACKEND", "memory")
        monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEY", raising=False)
        monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEYS", raising=False)
        monkeypatch.delenv("ALBUM_CONCEPTUALIZER_STRICT_PRODUCTION", raising=False)
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        reset_settings()
        app = create_app()
        with TestClient(app) as tc:
            resp = tc.post(
                "/api/v1/agents/ideation",
                json={"concept": "Test"},
            )
            assert resp.status_code == 503
            assert "ANTHROPIC_API_KEY" in resp.json()["detail"]
        reset_settings()


class TestCrewFailure:
    @patch("album_conceptualizer.api.v1.agents.create_album_ideation_crew")
    def test_crew_failure_sets_job_failed(self, mock_create, agent_client):
        crew = MagicMock()
        crew.kickoff.side_effect = RuntimeError("LLM error")
        mock_create.return_value = crew
        resp = agent_client.post(
            "/api/v1/agents/ideation",
            json={"concept": "Doomed album"},
        )
        job_id = resp.json()["job_id"]
        for _ in range(20):
            poll = agent_client.get(f"/api/v1/agents/jobs/{job_id}")
            if poll.json()["status"] in ("completed", "failed"):
                break
            time.sleep(0.1)
        data = poll.json()
        assert data["status"] == "failed"
        assert "LLM error" in data["error"]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/test_agents_api.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'album_conceptualizer.api.v1.agents'`

- [ ] **Step 3: Implement agent route handlers**

```python
# album_conceptualizer/api/v1/agents.py
"""Agent workflow API endpoints."""

from __future__ import annotations

import threading
import time

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from album_conceptualizer.api.jobs import JobStatus, JobStore
from album_conceptualizer.config import get_settings

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


def _run_crew_in_thread(job_store: JobStore, job_id: str, crew: object) -> None:
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


def _job_to_response(job) -> JobResponse:
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
    from album_conceptualizer.agents.crew import create_album_ideation_crew

    crew = create_album_ideation_crew(
        concept=req.concept,
        references=req.references,
        themes=req.themes,
        track_count=req.track_count,
    )

    job_store: JobStore = request.app.state.job_store
    job = job_store.create("ideation")
    thread = threading.Thread(
        target=_run_crew_in_thread,
        args=(job_store, job.id, crew),
        daemon=True,
    )
    thread.start()
    return _job_to_response(job)


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

    from album_conceptualizer.agents.crew import create_song_development_crew

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
    thread = threading.Thread(
        target=_run_crew_in_thread,
        args=(job_store, job.id, crew),
        daemon=True,
    )
    thread.start()
    return _job_to_response(job)


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

    from album_conceptualizer.agents.crew import create_coherence_review_crew

    crew = create_coherence_review_crew(
        album_bible=bible,
        album_content=album_content or "(no song content yet)",
    )

    job_store: JobStore = request.app.state.job_store
    job = job_store.create("coherence_review")
    thread = threading.Thread(
        target=_run_crew_in_thread,
        args=(job_store, job.id, crew),
        daemon=True,
    )
    thread.start()
    return _job_to_response(job)


@router.get("/jobs", status_code=200)
def list_jobs(
    request: Request,
    status: JobStatus | None = Query(default=None),
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
```

- [ ] **Step 4: Wire the router and JobStore into the app**

In `album_conceptualizer/api/v1/__init__.py`, add the agents router import and include it on `subscription_router`:

```python
# Add import
from album_conceptualizer.api.v1.agents import router as agents_router

# Add to subscription_router (after the experience_router line)
subscription_router.include_router(agents_router, tags=["agents"])
```

In `album_conceptualizer/api/app.py`, add JobStore initialization at the end of `_initialize_state()`:

```python
# Add import at top
from album_conceptualizer.api.jobs import JobStore

# Add at end of _initialize_state()
app.state.job_store = JobStore()
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `uv run pytest tests/test_agents_api.py -v`
Expected: All PASS

- [ ] **Step 6: Run the full test suite**

Run: `uv run pytest tests/ --ignore=tests/test_midi_musicxml_export.py --ignore=tests/test_export_progression_api.py -x -q`
Expected: All existing tests still pass (no regressions)

- [ ] **Step 7: Lint**

Run: `uv run ruff check album_conceptualizer/api/jobs.py album_conceptualizer/api/v1/agents.py tests/test_agents_api.py album_conceptualizer/api/v1/__init__.py album_conceptualizer/api/app.py`
Expected: Clean

- [ ] **Step 8: Commit**

```bash
git add album_conceptualizer/api/v1/agents.py album_conceptualizer/api/v1/__init__.py album_conceptualizer/api/app.py tests/test_agents_api.py
git commit -m "feat(api): add agent workflow endpoints (ideation, song-dev, coherence)"
```

---

## Chunk 3: Verify and Ship

### Task 3: Final verification

- [ ] **Step 1: Run full test suite with coverage**

Run: `uv run pytest tests/ --ignore=tests/test_midi_musicxml_export.py --ignore=tests/test_export_progression_api.py --cov=album_conceptualizer --cov-report=term-missing -q`
Expected: All pass, coverage >= 85%

- [ ] **Step 2: Type check**

Run: `uv run mypy album_conceptualizer/api/jobs.py album_conceptualizer/api/v1/agents.py --ignore-missing-imports`
Expected: Clean

- [ ] **Step 3: Format**

Run: `uv run ruff format album_conceptualizer/api/jobs.py album_conceptualizer/api/v1/agents.py tests/test_jobs.py tests/test_agents_api.py`

- [ ] **Step 4: Commit any formatting fixes**

Only if ruff format changed anything.

- [ ] **Step 5: Verify endpoints manually (smoke test)**

Run the dev server and hit the endpoints:

```bash
# Terminal 1: start server
ANTHROPIC_API_KEY=test uvicorn album_conceptualizer.api.app:app --port 8000

# Terminal 2: test (expect 202 — will fail the actual crew without a real key, but proves routing works)
curl -s -X POST http://localhost:8000/api/v1/agents/ideation \
  -H 'Content-Type: application/json' \
  -d '{"concept": "test"}' | python -m json.tool

curl -s http://localhost:8000/api/v1/agents/jobs | python -m json.tool
```
