# Quickstart

This is the fastest path to a working local Album Conceptualizer stack.

By the end you will have:

- local Postgres and Redis running in Docker
- the Python engine running on port `8000`
- the Next.js app running on port `3002`
- a working dev sign-in flow

## Prerequisites

- Python `3.11`
- `uv`
- Node.js and `npm`
- Docker Desktop or Docker Engine

## 1. Clone And Install

From the repo root:

```bash
git clone https://github.com/gr8monk3ys/album-conceptualizer.git
cd album-conceptualizer

uv pip install --system -e ".[dev,music]"
cd apps/web
npm install
cd ..
```

Why `.[dev,music]`:

- `dev` gives you lint, test, and type-check tooling
- `music` gives you the export dependencies that many smoke paths require

## 2. Start Local Data Services

The web app expects Postgres on `5433` and Redis on `6379`.

```bash
docker compose -f apps/web/docker-compose.local.yml up -d
```

If you want to confirm the containers are up:

```bash
docker ps
```

## 3. Configure The Web App

Create the local env file:

```bash
cd apps/web
cp .env.example .env.local
```

The minimum local values are:

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

If your Python engine is protected, also set:

```bash
ENGINE_API_KEY=<same value as ALBUM_CONCEPTUALIZER_API_KEY>
```

## 4. Apply Prisma Migrations

From `apps/web`:

```bash
npm run prisma:migrate:deploy
```

If you are actively changing the Prisma schema, use `prisma:migrate:dev` instead.

## 5. Start The Python Engine

From the repo root:

```bash
make api-dev
```

That starts FastAPI on `http://127.0.0.1:8000`.

## 6. Start The Web App

In another terminal:

```bash
cd apps/web
npm run dev -- -p 3002
```

Open:

- `http://127.0.0.1:3002`
- `http://127.0.0.1:3002/sign-in`

Use Dev Login when `ENABLE_DEV_LOGIN=1`.

## 7. Verify The Stack

Minimum smoke checks:

```bash
curl http://127.0.0.1:3002/api/health
curl http://127.0.0.1:8000/api/v1/health
```

Recommended local checks:

```bash
cd apps/web
npm run test:e2e
cd ..

bash scripts/web-lighthouse-public.sh
bash scripts/web-lighthouse-auth.sh
```

## Optional: Run The Legacy Gradio UI

If you want the older UI surface:

```bash
make ui
```

## Common Local Gotchas

### Prisma Or Login Errors

Check:

- Postgres is actually running on `5433`
- `DATABASE_URL` points to `127.0.0.1`, not a stale container hostname
- Prisma migrations were applied

### Export Fails

Check:

- the Python engine is running
- `ENGINE_API_URL` points at `http://127.0.0.1:8000/api/v1`
- `ENGINE_API_KEY` matches the engine config when auth is enabled

### Playwright Uses The Wrong Port

Set:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3002
```

### Lighthouse Or Auth Audit Fails

Check:

- `ENABLE_DEV_LOGIN=1`
- `NEXT_PUBLIC_ENABLE_DEV_LOGIN=1`
- Postgres is reachable
- the web app can start from a production build

## Next Reading

- [What This Repo Does](../product/what-it-does.md)
- [Repo Map](../developer/repo-map.md)
- [Testing and Quality](../developer/testing-and-quality.md)
