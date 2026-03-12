# Testing And Quality

This repo has both Python and web quality gates. Use the right command for the layer you changed.

## Fast Mental Model

- Python correctness lives in `pytest`, `ruff`, and `mypy`
- web correctness lives in `eslint`, `next build`, and Playwright
- web quality and performance gates live in Lighthouse and React Doctor
- deployed safety lives in staging smoke scripts

## Python Quality Commands

### Lint

```bash
make lint
```

Runs Ruff against `album_conceptualizer/` and `tests/`.

### Type Check

```bash
make type-check
```

Runs `mypy` over the Python package.

### Test Coverage

```bash
make test-cov
```

This uses the repo's `uv`-based dependency set with the music extras that the current test surface expects.

## Web Quality Commands

### Lint

```bash
cd apps/web
npm run lint -- .
```

### Production Build

```bash
cd apps/web
npm run build
```

The web app now uses `next build --webpack` for production builds because that path is currently more stable for both authenticated audits and Lighthouse scoring.

### End-To-End Tests

```bash
cd apps/web
npm run test:e2e
```

This covers the core web user flows.

## Lighthouse

The repo has two hard Lighthouse audits.

### Public Routes

Checks:

- `/`
- `/sign-in`

Run:

```bash
bash scripts/web-lighthouse-public.sh
```

Reports:

- `output/lighthouse/public/`

### Authenticated Shell

Checks:

- `/app/settings`

Run:

```bash
bash scripts/web-lighthouse-auth.sh
```

Requirements:

- local Postgres
- dev login enabled

Reports:

- `output/lighthouse/auth/`

## React Doctor

Run from `apps/web`:

```bash
npx -y react-doctor@latest . -y --score
```

This is the repo's React health audit for:

- architecture
- hooks and effect usage
- dead code
- bundle hygiene
- Next.js anti-patterns

## Staging And Deployment Smoke

### Web Staging Smoke

```bash
ALBUM_CONCEPTUALIZER_WEB_BASE_URL=https://your-web-url \
bash scripts/web-staging-smoke.sh
```

Checks:

- `/api/health`
- `/api/auth/providers`
- unauthenticated Playwright production smoke

### Python API Staging Smoke

```bash
ALBUM_CONCEPTUALIZER_BASE_URL=https://your-api-url \
ALBUM_CONCEPTUALIZER_API_KEY=... \
python scripts/staging-e2e.py
```

### Stripe Billing Smoke

```bash
ALBUM_CONCEPTUALIZER_BASE_URL=https://your-web-url \
ALBUM_CONCEPTUALIZER_API_KEY=... \
STRIPE_PRICE_ID=... \
python scripts/stripe-billing-smoke.py --plan pro --simulate-webhook
```

## Legacy UI Smoke

If you still touch the Gradio surface:

```bash
make ui-e2e
```

## Recommended Pre-Merge Checklist

### If You Changed Python Only

Run:

- `make lint`
- `make type-check`
- `make test-cov`

### If You Changed Web UI Or Web Backend

Run:

- `cd apps/web && npm run lint -- .`
- `cd apps/web && npm run build`
- `cd apps/web && npm run test:e2e`
- `bash scripts/web-lighthouse-public.sh`

### If You Changed The App Shell, Auth, Or Shared Web Infrastructure

Also run:

- `bash scripts/web-lighthouse-auth.sh`
- `npx -y react-doctor@latest . -y --score`

### If You Changed Export, Billing, Or Deployment Logic

Also run the relevant smoke scripts:

- `scripts/staging-e2e.py`
- `scripts/stripe-billing-smoke.py`
- `scripts/web-staging-smoke.sh`

## CI Expectations

GitHub Actions currently enforces:

- Python lint
- Python tests
- Python type-check
- security audit
- optional stack smoke
- Playwright CLI UI E2E
- web Lighthouse

The web Lighthouse workflow now provisions Postgres, applies Prisma migrations, and runs both:

- public route audit
- authenticated shell audit

## What A Green Repo Means

A fully green local pass means:

- the Python package is healthy
- the web app builds
- the main web user flows work locally
- the public and protected web shells both hit the exact Lighthouse target
- React Doctor is healthy

It does not automatically mean live providers are verified. Real OAuth, real email delivery, real Stripe, and deployed export still need staging proof.
