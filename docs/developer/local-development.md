# Local Development

This page describes the normal engineering workflow for working on Album Conceptualizer locally.

## Choose The Surface First

Before you run anything, decide which part of the product you are touching:

- web app only
- Python API only
- full stack, including export
- legacy Gradio UI

For most feature work, you want the full stack.

## Full-Stack Local Workflow

### 1. Install Dependencies

From the repo root:

```bash
uv pip install --system -e ".[dev,music]"

cd apps/web
npm install
cd ..
```

### 2. Start Local Services

```bash
docker compose -f apps/web/docker-compose.local.yml up -d
```

Expected local services:

- Postgres on `5433`
- Redis on `6379`

### 3. Configure The Web App

Create `apps/web/.env.local` from the example and ensure these values exist:

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/album_conceptualizer?schema=album_conceptualizer
PRISMA_ADAPTER=pg
NEXTAUTH_SECRET=dev-secret
AUTH_SECRET=dev-secret
NEXTAUTH_URL=http://127.0.0.1:3002
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3002
ENABLE_DEV_LOGIN=1
NEXT_PUBLIC_ENABLE_DEV_LOGIN=1
ENGINE_API_URL=http://127.0.0.1:8000/api/v1
```

### 4. Apply Database Migrations

```bash
cd apps/web
npm run prisma:migrate:deploy
cd ..
```

Use `npm run prisma:migrate:dev` only when you are actively changing the schema.

### 5. Start The Runtimes

Terminal 1:

```bash
make api-dev
```

Terminal 2:

```bash
cd apps/web
npm run dev -- -p 3002
```

## Common Development Loops

### Web UI Or Route Work

Typical loop:

1. edit `apps/web/src/app`, `apps/web/src/components`, or `apps/web/src/server`
2. run `npm run lint -- .`
3. run `npm run build`
4. run `npm run test:e2e` if the change affects user flows

### Prisma Schema Work

Typical loop:

1. edit `apps/web/prisma/schema.prisma`
2. run `npm run prisma:migrate:dev`
3. run `npm run prisma:generate`
4. update any affected server logic, pages, or E2E tests

### Python API Work

Typical loop:

1. edit `album_conceptualizer/...`
2. run `make lint`
3. run `make type-check`
4. run `make test-cov`

### Export Work

For anything that touches export:

1. run the Python API
2. verify the web export route still works
3. run API and web smoke paths, not only unit tests

## Useful Local Commands

### Python

```bash
make lint
make type-check
make test-cov
make api-dev
make ui
```

### Web

```bash
cd apps/web
npm run lint -- .
npm run build
npm run test:e2e
```

### Quality Gates

From the repo root:

```bash
bash scripts/web-lighthouse-public.sh
bash scripts/web-lighthouse-auth.sh
```

React Doctor:

```bash
cd apps/web
npx -y react-doctor@latest . -y --score
```

## Ports You Will See Often

| Service | Port |
| --- | --- |
| web dev | `3002` |
| web prod audit default | `3300` / `3301` |
| Python API | `8000` |
| local Postgres | `5433` |
| local Redis | `6379` |

## Common Gotchas

### Dev Login Is Missing

Set both:

- `ENABLE_DEV_LOGIN=1`
- `NEXT_PUBLIC_ENABLE_DEV_LOGIN=1`

### Engine Calls Fail

Check:

- the Python API is running
- `ENGINE_API_URL` is correct
- `ENGINE_API_KEY` matches when engine auth is enabled

### Playwright Hits The Wrong App URL

Export:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3002
```

### Prisma Or Auth Errors Appear In Production Build Audits

Check:

- Postgres is up
- migrations were applied
- `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` match the runtime URL

## What To Read When You Are Lost

- [Repo Map](repo-map.md)
- [Architecture](architecture.md)
- [Testing and Quality](testing-and-quality.md)
- `apps/web/README.md`
