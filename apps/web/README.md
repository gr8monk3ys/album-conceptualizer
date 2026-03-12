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

- `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/album_conceptualizer?schema=album_conceptualizer`
- `PRISMA_ADAPTER=pg`
- `NEXTAUTH_SECRET=dev-secret`
- `NEXTAUTH_URL=http://localhost:3002`
- `NEXT_PUBLIC_APP_URL=http://localhost:3002`
- `ENABLE_DEV_LOGIN=1`
- `NEXT_PUBLIC_ENABLE_DEV_LOGIN=1`
- `ENGINE_API_URL=http://127.0.0.1:8000/api/v1`
- `ENGINE_API_KEY=<same key as ALBUM_CONCEPTUALIZER_API_KEY>` when the Python engine is protected

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

## E2E Tests (Playwright)

The repo includes a Playwright smoke test that exercises:

- Sign in (dev credentials provider)
- Create project
- Edit in Studio
- Export zip (requires Python engine)
- Publish + Discover + Remix

Run:

```bash
npx playwright install chromium
npm run test:e2e
```

## Local E2E Backstop

If preview/staging is down or you want a single backup path that does not depend on external
services, run the repo-level backstop from the repo root:

```bash
make web-e2e-backstop
```

It will:

- start local Postgres and Redis
- apply Prisma migrations
- start the Python API on a free local port
- start the production Next.js app on a free local port
- run the Python API smoke flow
- run the web smoke flow
- run the full Playwright web suite

Logs are written to `output/web-e2e-backstop/`.

## Lighthouse Quality Gate

Public-entry Lighthouse is enforced against the production build for:

- `/`
- `/sign-in`

The wrapper starts a fresh production server on a free local port automatically.

Run the end-to-end local audit from the repo root:

```bash
bash scripts/web-lighthouse-public.sh
```

Reports are written to `output/lighthouse/public/`.

There is also an authenticated Lighthouse audit for the protected shell:

- `/app/settings`

It uses the local DEV login provider, so it requires Postgres plus:

- `ENABLE_DEV_LOGIN=1`
- `NEXT_PUBLIC_ENABLE_DEV_LOGIN=1`

This authenticated audit uses Lighthouse's desktop preset because the protected workspace is a
desktop-first interface.

Run it from the repo root:

```bash
bash scripts/web-lighthouse-auth.sh
```

Reports are written to `output/lighthouse/auth/`.

## Deploy (Vercel + Neon)

High level:

1. Create a Neon Postgres database and set `DATABASE_URL` in Vercel.
2. Configure auth:
   - GitHub OAuth: `GITHUB_ID`, `GITHUB_SECRET`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET` (or `AUTH_SECRET`), or
   - Email magic links: `EMAIL_SERVER` + `EMAIL_FROM` (or `RESEND_API_KEY` + `RESEND_FROM`), plus `NEXTAUTH_SECRET` (or `AUTH_SECRET`).
3. Configure Stripe and set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and price ids.
4. Configure Upstash Redis and set `UPSTASH_REDIS_REST_URL` plus `UPSTASH_REDIS_REST_TOKEN`.
5. Deploy the Python engine somewhere reachable from Vercel and set:
   - `ENGINE_API_URL=https://<engine-host>/api/v1`
   - `ENGINE_API_KEY=<shared-api-key>` (recommended)
6. Verify the deployment gate:
   - `GET /api/health` should return `200` with `checks.config=true`
   - `npm run test:e2e:prod-smoke` against the deployed base URL
   - `ALBUM_CONCEPTUALIZER_WEB_BASE_URL=https://yourdomain.com bash ../../scripts/web-staging-smoke.sh`
   - follow `../../docs/getting-started/web-staging-checklist.md` for live auth, billing, and export validation
