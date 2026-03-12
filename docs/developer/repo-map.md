# Repo Map

This page is for engineers who need to find the right place to work quickly.

## Top-Level Layout

| Path | Purpose |
| --- | --- |
| `apps/web/` | Primary Next.js product surface |
| `album_conceptualizer/` | Python package, FastAPI engine, exports, models, legacy UI |
| `tests/` | Python pytest suite |
| `docs/` | MkDocs source |
| `scripts/` | smoke tests, runbooks, backup, restore, and ops helpers |
| `ops/` | infrastructure and monitoring assets |
| `data/` | datasets and local supporting files |
| `output/` | generated exports, test artifacts, and runtime outputs |

## Web App Layout

Inside `apps/web/`:

| Path | Purpose |
| --- | --- |
| `src/app/` | App Router pages and route handlers |
| `src/app/api/` | Next.js backend routes |
| `src/components/` | React UI components |
| `src/server/` | server-side domain logic used by routes and pages |
| `prisma/` | Prisma schema and migrations |
| `e2e/` | Playwright tests |
| `scripts/` | web-specific audit helpers |
| `README.md` | web setup and deployment notes |

### High-Value Web Entry Points

Start here for common tasks:

| Task | Place To Start |
| --- | --- |
| marketing and public pages | `apps/web/src/app/page.tsx`, `apps/web/src/app/sign-in/page.tsx` |
| protected app shell | `apps/web/src/app/app/layout.tsx`, `apps/web/src/components/sidebar.tsx`, `apps/web/src/components/topbar.tsx` |
| create flow | `apps/web/src/app/app/create/page.tsx`, `apps/web/src/components/quickstart-composer.tsx` |
| album detail | `apps/web/src/app/app/albums/[albumId]/page.tsx` |
| studio | `apps/web/src/app/app/albums/[albumId]/studio/page.tsx`, `apps/web/src/components/album-studio.tsx` |
| bible | `apps/web/src/app/app/albums/[albumId]/bible/page.tsx` |
| export | `apps/web/src/app/app/albums/[albumId]/export/page.tsx`, `apps/web/src/app/api/albums/[albumId]/export/route.ts` |
| discover and remix | `apps/web/src/app/app/discover/`, `apps/web/src/app/api/albums/[albumId]/fork/route.ts` |
| auth | `apps/web/src/server/auth.ts`, `apps/web/src/app/api/auth/[...nextauth]/route.ts`, `apps/web/middleware.ts` |
| billing | `apps/web/src/app/api/stripe/`, `apps/web/src/server/stripe.ts` |
| health and production checks | `apps/web/src/server/production.ts`, `apps/web/src/app/api/health/route.ts` |
| analytics | `apps/web/src/server/analytics.ts`, `apps/web/src/app/app/settings/analytics/page.tsx` |

## Python Package Layout

Inside `album_conceptualizer/`:

| Path | Purpose |
| --- | --- |
| `api/` | FastAPI application and versioned routers |
| `agents/` | optional AI agent orchestration |
| `export/` | format exporters and preview helpers |
| `integrations/` | external service integrations |
| `models/` | core domain models |
| `rag/` | optional retrieval and embeddings support |
| `ui/` | legacy Gradio application |

### High-Value Python Entry Points

| Task | Place To Start |
| --- | --- |
| start the API | `album_conceptualizer/api/app.py` |
| inspect API routes | `album_conceptualizer/api/v1/` |
| work on export formats | `album_conceptualizer/export/` |
| inspect storage and config | `album_conceptualizer/config.py` |
| work on the Gradio UI | `album_conceptualizer/ui/app.py` |

## Tests And Scripts

### Python Tests

`tests/` covers:

- API behavior
- models
- export
- identity
- billing
- rate limiting and quota
- storage backends
- legacy UI smoke

### Web Tests

`apps/web/e2e/` covers:

- auth
- create flow
- studio flow
- album management
- production smoke

### Scripts

Top-level `scripts/` includes:

- backup and restore
- staging smoke
- Stripe billing smoke
- UI smoke and UI E2E
- Lighthouse audits
- production start and stop helpers

## Where To Make Common Changes

### Add A New Web Feature

Usually touches:

1. `apps/web/src/app/...` page
2. `apps/web/src/components/...`
3. `apps/web/src/server/...`
4. `apps/web/src/app/api/...` if persistence or side effects are needed
5. `apps/web/e2e/...` for verification

### Add Or Change Persisted Web Data

Usually touches:

1. `apps/web/prisma/schema.prisma`
2. `apps/web/prisma/migrations/...`
3. `apps/web/src/server/...`
4. pages or routes that read or write the data

### Add A Python API Capability

Usually touches:

1. `album_conceptualizer/api/v1/...`
2. `album_conceptualizer/models/...`
3. optional helper module in `export/`, `integrations/`, or `rag/`
4. `tests/`

## First Files To Read On Day One

If you want the fastest orientation:

1. `README.md`
2. `apps/web/README.md`
3. `docs/product/what-it-does.md`
4. `apps/web/src/app/app/layout.tsx`
5. `apps/web/src/server/auth.ts`
6. `apps/web/prisma/schema.prisma`
7. `album_conceptualizer/api/app.py`
8. `album_conceptualizer/api/v1/__init__.py`
