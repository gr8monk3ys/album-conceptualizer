# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All Python commands use `uv run` (the project uses [uv](https://docs.astral.sh/uv/) throughout):

```bash
# Install dev dependencies
uv pip install --system -e ".[dev]"

# Run all tests
uv run pytest tests/

# Run a single test / class / file
uv run pytest tests/test_api.py::TestAlbums::test_create_album

# Run tests with branch coverage (enforced at 85% in CI)
uv run pytest tests/ --cov=album_conceptualizer --cov-report=term-missing

# Lint and format (ruff, line-length 100)
uv run ruff check album_conceptualizer/ tests/
uv run ruff format album_conceptualizer/ tests/

# Type-check
uv run mypy album_conceptualizer/ --ignore-missing-imports

# Start API server (hot reload)
uvicorn album_conceptualizer.api.app:app --host 0.0.0.0 --port 8000 --reload
```

For the Next.js frontend (`apps/web/`):

```bash
npm run dev        # development server
npm run build      # production build
npm run lint       # eslint
npm run test:e2e   # Playwright end-to-end tests
npx prisma generate         # regenerate Prisma client after schema changes
npx prisma migrate dev      # apply migrations (dev)
npx prisma migrate deploy   # apply migrations (production)
```

## Architecture

### Monorepo layout

```
album_conceptualizer/   Python backend (FastAPI)
apps/web/               Next.js 16 / React 19 frontend
tests/                  pytest test suite
scripts/                smoke-test helpers
```

### Python backend

**Entry point**: `album_conceptualizer/api/app.py` — `create_app()` is the FastAPI factory; the module-level `app` object is used by uvicorn. All routes mount under `/api/v1` via the aggregating router in `album_conceptualizer/api/v1/__init__.py`.

**Route organisation** (`api/v1/__init__.py`):

| Router | Auth required | Endpoints |
|--------|---------------|-----------|
| `health_router` | none | `/health`, `/ready`, `/live`, `/metrics` |
| `identity_router` | none | accounts, workspaces, sessions |
| `billing_public_router` | none | public plan info |
| `api_key_router` | API key | billing protected |
| `subscription_router` | API key + active subscription | albums, songs, bible, theory, export, experience |

Root-level compat endpoints (`/health`, `/ready`, `/live`) are thin wrappers that delegate to the v1 health handlers.

**Auth** (`api/deps.py`): `require_api_key` accepts both `X-API-Key` header and `Authorization: Bearer <token>`. A workspace session token (from identity) is also valid. `require_active_subscription` gates routes behind a Stripe subscription when `ALBUM_CONCEPTUALIZER_SUBSCRIPTION_REQUIRED=true`. API key comparison uses `secrets.compare_digest` (constant-time).

**Storage layer** (`storage.py`): Three concrete backends share abstract base classes (`AlbumStore`, `BibleStore`, `SubscriptionStore`):

- `InMemory*` — no persistence, used in all tests
- `SQLite*` — default in production (`ALBUM_CONCEPTUALIZER_STORAGE_BACKEND=sqlite`), stored at `data/album_conceptualizer.db`
- `File*` — JSON files on disk

The active stores are attached to `app.state` (`album_store`, `bible_store`, `subscription_store`, `experience_store`, `identity_store`) during `_initialize_state()` at startup. Route handlers receive them via `request.app.state.*`.

**Settings** (`config.py`): Pydantic-Settings `Settings` class, env prefix `ALBUM_CONCEPTUALIZER_`. Singleton via `get_settings()`, resettable with `reset_settings()` (used in tests to re-read env after monkeypatching). Key production settings: `ALBUM_CONCEPTUALIZER_API_KEY`, `ALBUM_CONCEPTUALIZER_CORS_ORIGINS`, `ALBUM_CONCEPTUALIZER_STORAGE_BACKEND`. `settings.production_issues()` returns a list of misconfiguration warnings.

**Experience layer** (`api/v1/experience.py`, ~3 800 lines): All experience endpoints are pure data computation — zero Anthropic/LLM API calls. They operate on albums, songs, and in-memory collab room / remix battle state stored via `ExperienceStateStore`.

**Optional extras**: AI agents (`agents/`, requires `[ai]`), RAG with ChromaDB (`rag/`, requires `[rag]`), MIDI/MusicXML export (`export/`, requires `[music]`). These modules are excluded from coverage measurement in CI because they need runtime extras not installed with `[dev]`.

### Test suite

`tests/conftest.py` provides:
- `_default_memory_storage` (autouse) — forces `STORAGE_BACKEND=memory` for every test, preventing writes to the shared SQLite file
- `client` / `auth_client` — unauthenticated and API-key clients
- `sqlite_client` — real SQLite DB in a `tmp_path`, for persistence tests

Coverage is measured with branch coverage (`branch = true`) and must stay ≥ 85%.

### Next.js frontend (`apps/web/`)

Next.js 16, React 19, Tailwind CSS 4. Auth via `next-auth` with Prisma adapter (PostgreSQL/Neon). Payments via Stripe. Tone.js for in-browser MIDI preview. `@tonejs/midi` for MIDI parsing. Rate limiting via `@upstash/ratelimit` + `@upstash/redis`.

Prisma schema lives in `apps/web/prisma/schema.prisma`. Always run `npx prisma generate` after schema changes.

## Key env vars

| Variable | Default | Notes |
|----------|---------|-------|
| `ALBUM_CONCEPTUALIZER_STORAGE_BACKEND` | `sqlite` | `memory` / `sqlite` / `file` |
| `ALBUM_CONCEPTUALIZER_API_KEY` | — | Single static API key |
| `ALBUM_CONCEPTUALIZER_API_KEYS` | — | JSON array of keys |
| `ALBUM_CONCEPTUALIZER_CORS_ORIGINS` | `["*"]` | JSON array |
| `ALBUM_CONCEPTUALIZER_SUBSCRIPTION_REQUIRED` | `false` | Requires Stripe Price IDs in `api/v1/billing.py` |
| `ANTHROPIC_API_KEY` | — | Required for AI agent workflows |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | — | Required when subscription gating is on |
