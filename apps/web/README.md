## Album Conceptualizer Web Dashboard (Next.js)

This is the production web dashboard for Album Conceptualizer.

Tech stack:

- Next.js (App Router)
- NextAuth (GitHub OAuth; plus a DEV-only credentials provider for local E2E)
- Prisma (Neon Postgres in prod; local Postgres in Docker for dev)
- Stripe (subscriptions + billing portal)

This app persists album projects in Postgres and calls the Python engine for exports.

## Local Development

Prereqs:

- Node.js + npm
- Docker (for local Postgres/Redis)
- Python engine running from the repo root (FastAPI)

### 1) Start local Postgres (and Redis)

```bash
docker compose -f docker-compose.local.yml up -d
```

Local Postgres is exposed on `localhost:5433`.

### 2) Configure env vars

Copy the example file and edit as needed:

```bash
cp .env.example .env.local
```

Minimum for local E2E:

- `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/album_conceptualizer?schema=public`
- `PRISMA_ADAPTER=pg`
- `NEXTAUTH_SECRET=dev-secret`
- `NEXTAUTH_URL=http://localhost:3002`
- `NEXT_PUBLIC_APP_URL=http://localhost:3002`
- `ENABLE_DEV_LOGIN=1`
- `NEXT_PUBLIC_ENABLE_DEV_LOGIN=1`
- `ENGINE_API_URL=http://127.0.0.1:8000/api/v1`

### 3) Install deps + migrate DB

```bash
npm install
npm run prisma:migrate:dev
```

### 4) Run the Python engine (in repo root)

In another terminal:

```bash
make api-dev
```

### 5) Run the dashboard

```bash
npm run dev -- -p 3002
```

Then open:

- `http://localhost:3002` (marketing home)
- `http://localhost:3002/sign-in` (use Dev Login when enabled)

## Deploy (Vercel + Neon)

High level:

1. Create a Neon Postgres database and set `DATABASE_URL` in Vercel.
2. Configure NextAuth (GitHub OAuth) and set `GITHUB_ID`, `GITHUB_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`.
3. Configure Stripe and set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and price ids.
4. Deploy the Python engine somewhere reachable from Vercel (or move long-running tasks to a job system).
