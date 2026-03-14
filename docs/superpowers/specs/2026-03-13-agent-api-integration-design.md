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
POST /api/v1/agents/ideation         Start album ideation crew
POST /api/v1/agents/song-development Start song development crew
POST /api/v1/agents/coherence-review Start coherence review crew
GET  /api/v1/agents/jobs/{job_id}    Poll job status and result
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
    def update(self, job_id: str, **kwargs) -> None: ...
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
2. Fetches any required data from storage (album, bible)
3. Creates the appropriate crew
4. Creates a job in the job store
5. Spawns a background thread
6. Returns immediately with job ID (202 Accepted)

The GET endpoint returns current job status, result if completed, error if failed.

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
- Job TTL eviction
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
