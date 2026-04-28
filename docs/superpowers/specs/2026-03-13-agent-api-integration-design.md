# Agent API Integration Design

Wire the existing CrewAI agent workflows (ideation, song development, coherence review) to REST API endpoints so the product actually conceptualizes albums.

## Problem

The Album Conceptualizer has 5 fully-built AI agents and 3 crew workflows but they are only accessible via a Gradio UI. The REST API and Next.js frontend cannot trigger any AI-powered conceptualization. The core product promise is undelivered.

## Scope

- Expose all 3 crew workflows via REST API endpoints
- Add a lightweight in-memory job system for async execution
- API only — no frontend changes in this pass
- No RAG setup required (agents degrade gracefully without it)

## Architecture

### Job System

Lightweight in-memory job store. No external dependencies (no Redis, no Celery).

Job lifecycle: `pending` -> `running` -> `completed` | `failed`

Jobs run in background threads (`threading.Thread`) because CrewAI's `crew.kickoff()` is synchronous. Results stored in-memory, evicted after 1 hour via a sweep on each access.

### Endpoints

All under `/api/v1/agents/`, behind `subscription_router` (API key + active subscription required).

```
POST   /api/v1/agents/ideation         Start album ideation crew
POST   /api/v1/agents/song-development Start song development crew
POST   /api/v1/agents/coherence-review Start coherence review crew
GET    /api/v1/agents/jobs             List jobs (optional ?status= filter)
GET    /api/v1/agents/jobs/{job_id}    Poll job status and result
DELETE /api/v1/agents/jobs/{job_id}    Remove completed/failed job
```

### Request Models

```python
class IdeationRequest(BaseModel):
    concept: str                    # Album concept/story
    references: str = ""            # Reference artists/albums
    themes: str = ""                # Key themes
    track_count: int = Field(default=10, ge=3, le=25)

class SongDevelopmentRequest(BaseModel):
    album_id: str                   # Fetch album + bible from storage
    song_title: str
    track_number: int = Field(ge=1)
    mood: str | None = None
    style_reference: str | None = None
    song_structure: str | None = None

class CoherenceReviewRequest(BaseModel):
    album_id: str                   # Fetch album + bible from storage
```

### Response Model

```python
class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"

class JobResponse(BaseModel):
    job_id: str
    status: JobStatus
    created_at: datetime
    completed_at: datetime | None = None
    result: dict | None = None
    error: str | None = None
```

### Job Store

```python
@dataclass
class Job:
    id: str
    status: JobStatus
    crew_type: str               # "ideation" | "song_development" | "coherence_review"
    created_at: datetime
    completed_at: datetime | None = None
    result: dict | None = None
    error: str | None = None

class JobStore:
    """In-memory job store with TTL eviction."""

    def __init__(self, ttl_seconds: int = 3600) -> None:
        self._jobs: dict[str, Job] = {}
        self._ttl = ttl_seconds
        self._lock = threading.Lock()

    def create(self, crew_type: str) -> Job: ...
    def get(self, job_id: str) -> Job | None: ...
    def list(self, status: JobStatus | None = None) -> list[Job]: ...
    def update(self, job_id: str, **kwargs) -> None: ...
    def delete(self, job_id: str) -> bool: ...
    def _evict_stale(self) -> None: ...
```

### Thread Runner

```python
def _run_crew_in_thread(job_store: JobStore, job_id: str, crew: Crew) -> None:
    """Execute a CrewAI crew in a background thread."""
    job_store.update(job_id, status=JobStatus.RUNNING)
    try:
        result = crew.kickoff()
        job_store.update(
            job_id,
            status=JobStatus.COMPLETED,
            result={"output": str(result)},
            completed_at=datetime.now(UTC),
        )
    except Exception as exc:
        job_store.update(
            job_id,
            status=JobStatus.FAILED,
            error=str(exc),
            completed_at=datetime.now(UTC),
        )
```

### Route Handlers

Each POST endpoint:
1. Validates the request
2. Checks `ANTHROPIC_API_KEY` is configured — returns 503 with clear message if missing
3. Fetches required data from storage **synchronously in the request handler** (not in the thread) — returns 404 if album/bible not found
4. Creates the appropriate crew, passing fetched data
5. Creates a job in the job store
6. Spawns a background thread with the crew (no storage access in thread)
7. Returns immediately with job ID (202 Accepted)

This pattern ensures storage reads happen on the main thread (avoiding thread-safety issues with in-memory stores) and validation errors are returned synchronously.

#### Crew parameter mapping

**Ideation:**
```python
crew = create_album_ideation_crew(
    concept=req.concept,
    references=req.references,
    themes=req.themes,
    track_count=req.track_count,
)
```

**Song development:**
```python
bible = bible_store.get(req.album_id)  # 404 if None
album = album_store.get(req.album_id)  # 404 if None
crew = create_song_development_crew(
    song_title=req.song_title,
    track_number=req.track_number,
    album_bible=bible,
    mood=req.mood,
    style_reference=req.style_reference,
    song_structure=req.song_structure,
)
```
Note: An `AlbumBible` must exist for the album before song development can run. The ideation workflow produces a vision document; the user must save it as an `AlbumBible` via the existing bible CRUD endpoints before developing songs.

**Coherence review:**
```python
album = album_store.get(req.album_id)  # 404 if None
bible = bible_store.get(req.album_id)  # 404 if None

# Assemble album_content from stored songs
album_content = "\n\n".join(
    f"Track {song.track_number}: {song.title}\n"
    + "\n".join(
        f"[{s.section_type.value}] {s.lyrics or ''}"
        for s in (song.sections or [])
    )
    for song in album.songs
)

crew = create_coherence_review_crew(
    album_bible=bible,
    album_content=album_content,
)
```

The GET endpoint returns current job status, result if completed, error if failed.
The DELETE endpoint removes a completed or failed job from the store (cleanup).

### App State Integration

The `JobStore` is attached to `app.state.job_store` during `_initialize_state()` in `app.py`, following the same pattern as `album_store`, `bible_store`, etc.

## New Files

| File | Purpose |
|------|---------|
| `album_conceptualizer/api/jobs.py` | Job dataclass, JobStore, thread runner |
| `album_conceptualizer/api/v1/agents.py` | Route handlers |
| `tests/test_agents_api.py` | Tests with mocked crews (no real LLM calls) |

## Modified Files

| File | Change |
|------|--------|
| `album_conceptualizer/api/v1/__init__.py` | Add agents router to subscription_router |
| `album_conceptualizer/api/app.py` | Initialize JobStore in `_initialize_state()` |

## Testing Strategy

All tests mock the crew execution (no real LLM calls). Test:
- Job creation and polling lifecycle (pending -> running -> completed)
- Job failure handling (pending -> running -> failed)
- Request validation (missing fields, invalid album_id)
- 404 when album or bible not found for song-development/coherence-review
- 503 when ANTHROPIC_API_KEY is not configured
- Job TTL eviction
- Job list and delete endpoints
- 404 for unknown job IDs
- Auth gating (requires API key + subscription)

## Out of Scope

- Frontend integration (separate effort)
- RAG/ChromaDB setup (agents work without it)
- Persistent job storage (in-memory matches existing patterns)
- SSE/WebSocket streaming (can layer on later)
- Job cancellation (CrewAI doesn't support it cleanly)

## Dependencies

- `crewai` — already in `[ai]` extra
- `ANTHROPIC_API_KEY` — required at runtime for LLM calls
- No new packages needed
