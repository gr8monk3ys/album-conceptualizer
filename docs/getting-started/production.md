# Production Deployment

This guide covers the recommended production run modes for Album Conceptualizer.

## Prerequisites
- Python 3.11+
- `uv` or `pip` for installs
- Docker (optional, recommended for deployments)

## Configuration
- Start from `.env.example` and create a `.env` with API keys and settings:
  - `OPENAI_API_KEY=...`
  - `ANTHROPIC_API_KEY=...`
  - `ALBUM_CONCEPTUALIZER_API_KEYS=key1,key2` (recommended for API auth + key rotation)
  - `ALBUM_CONCEPTUALIZER_API_KEY=...` (legacy single-key fallback)
  - `ALBUM_CONCEPTUALIZER_SUBSCRIPTION_REQUIRED=true` (optional, enforce active subscriptions)
  - `ALBUM_CONCEPTUALIZER_CORS_ORIGINS=https://yourdomain.com` (required for strict production)
  - `ALBUM_CONCEPTUALIZER_RATE_LIMIT_ENABLED=true` (optional)
  - `ALBUM_CONCEPTUALIZER_RATE_LIMIT_PER_MINUTE=120` (optional)
  - `ALBUM_CONCEPTUALIZER_QUOTA_ENABLED=true` (optional)
  - `ALBUM_CONCEPTUALIZER_QUOTA_DAILY_LIMIT=1000` (optional)
  - `ALBUM_CONCEPTUALIZER_STORAGE_BACKEND=sqlite` (recommended)
  - `ALBUM_CONCEPTUALIZER_STRICT_PRODUCTION=true` (recommended, fail fast on insecure config)
  - `STRIPE_SECRET_KEY=...` (optional, required for checkout sessions)
  - `STRIPE_WEBHOOK_SECRET=...` (optional, required for Stripe webhooks)
  - `ALBUM_CONCEPTUALIZER_STRIPE_PRICE_ID_PRO=price_...` (required for PRO checkout)
  - `ALBUM_CONCEPTUALIZER_STRIPE_PRICE_ID_TEAM=price_...` (optional, required for TEAM checkout)
  - `ALBUM_CONCEPTUALIZER_BILLING_SUCCESS_URL=https://yourdomain.com/billing/success`
  - `ALBUM_CONCEPTUALIZER_BILLING_CANCEL_URL=https://yourdomain.com/billing/cancel`
  - `ALBUM_CONCEPTUALIZER_EMAIL_PROVIDER=smtp` (recommended for magic links/invites)
  - `ALBUM_CONCEPTUALIZER_EMAIL_FROM=noreply@yourdomain.com` (required for SMTP)
  - `ALBUM_CONCEPTUALIZER_SMTP_HOST=smtp.yourprovider.com` (required for SMTP)
  - `ALBUM_CONCEPTUALIZER_SMTP_PORT=587` (optional)
  - `ALBUM_CONCEPTUALIZER_SMTP_USERNAME=...` (optional)
  - `ALBUM_CONCEPTUALIZER_SMTP_PASSWORD=...` (optional)
  - `ALBUM_CONCEPTUALIZER_SMTP_USE_TLS=true` (optional)
  - `ALBUM_CONCEPTUALIZER_SMTP_USE_SSL=false` (optional)
  - `ALBUM_CONCEPTUALIZER_TELEMETRY=true` (optional, opt‑in)
  - `LOG_LEVEL=INFO` (optional)
- Project data is stored under `output/projects/` by default.

## Run With Docker (Recommended)
- UI only:
  - `docker compose up -d app`
- API only:
  - `docker compose up -d api`
- Full stack (includes ChromaDB):
  - `docker compose --profile full up -d`

### One‑Command Production Start
- `scripts/run-prod.sh` starts API + UI.
- `scripts/stop-prod.sh` stops containers.

### Compose Production File
- `docker compose -f docker-compose.prod.yml up -d`
- `scripts/run-prod-compose.sh` runs a strict-production preflight and then starts the stack.
- By default `scripts/run-prod-compose.sh` rebuilds images (`docker compose ... up -d --build`).
  Set `ALBUM_CONCEPTUALIZER_BUILD_IMAGES=false` to skip rebuild and reuse existing images.
- The production compose profile requires:
  - `ALBUM_CONCEPTUALIZER_API_KEYS`
  - `ALBUM_CONCEPTUALIZER_CORS_ORIGINS`

Use `docker compose logs -f` to tail logs and `docker compose down` to stop.

## Run Natively (No Docker)
- Install dependencies:
  - `uv pip install --system -e ".[ui,ai,rag,music]"`
- Start the API:
  - `make api` (or `make api-dev` for reload)
- Launch the UI:
  - `make ui`

## Railway (API Only)
- `railway.json` and `Dockerfile.railway` are for the FastAPI service only.
- The image now defaults to strict production validation and persistent `/data` paths.
- Attach a Railway volume at `/data`, or explicitly override:
  - `ALBUM_CONCEPTUALIZER_STORAGE_BACKEND=sqlite`
  - `ALBUM_CONCEPTUALIZER_STORAGE_DB=/data/album_conceptualizer.db`
  - `DATA_DIR=/data`
  - `OUTPUT_DIR=/data/output`
  - `CACHE_DIR=/data/cache`
- Railway health checks should target `/ready`, not `/api/v1/health`.

## Reverse Proxy (TLS + Single Domain)
This repo includes a `Caddyfile` to terminate TLS and route both the API and UI.
- Set a domain:
  - `export ALBUM_CONCEPTUALIZER_DOMAIN=yourdomain.com`
- Run Caddy:
  - `caddy run --config Caddyfile`
- Ensure the API and UI are running locally on ports `8000` and `7860`.
- Update CORS to match the domain:
  - `ALBUM_CONCEPTUALIZER_CORS_ORIGINS=https://yourdomain.com`

Routes:
- `https://yourdomain.com/api/*` → API
- `https://yourdomain.com/docs` → API docs
- `https://yourdomain.com/` → UI

### Docker Compose (Caddy)
- `docker compose -f docker-compose.prod.yml up -d caddy`
- Set `ALBUM_CONCEPTUALIZER_DOMAIN` in your `.env` to enable TLS.
- Ports `80` and `443` must be open for certificate issuance.

### Docker Compose (Redis)
- `docker compose -f docker-compose.prod.yml up -d redis`
- Set:
  - `ALBUM_CONCEPTUALIZER_RATE_LIMIT_BACKEND=redis`
  - `ALBUM_CONCEPTUALIZER_QUOTA_BACKEND=redis`
  - `ALBUM_CONCEPTUALIZER_REDIS_URL=redis://redis:6379/0`

## Health Checks
- API readiness:
  - `GET /api/v1/ready`
  - `GET /api/v1/ready?strict=true` (also requires optional LLM/vector dependencies)
- API liveness:
  - `GET /api/v1/live`
- API metrics:
  - `GET /api/v1/metrics`

## Authentication
- If `ALBUM_CONCEPTUALIZER_API_KEYS` or `ALBUM_CONCEPTUALIZER_API_KEY` is set, pass a configured key on requests:
  - Header `X-API-Key: <your-key>`
  - Or `Authorization: Bearer <your-key>`
- For rotation, set multiple keys:
  - `ALBUM_CONCEPTUALIZER_API_KEYS=key1,key2,key3`

## Billing and Subscriptions
- Enable subscription enforcement:
  - `ALBUM_CONCEPTUALIZER_SUBSCRIPTION_REQUIRED=true`
- Use billing endpoints:
  - `GET /api/v1/billing/subscription`
  - `POST /api/v1/billing/checkout-session`
  - `POST /api/v1/billing/webhook`
- Stripe requires:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`

## Identity Email Delivery
- Magic-link and invite flows send through the configured email provider.
- Providers:
  - `ALBUM_CONCEPTUALIZER_EMAIL_PROVIDER=outbox` writes to `output/identity_outbox.log`
  - `ALBUM_CONCEPTUALIZER_EMAIL_PROVIDER=noop` logs send attempts only
  - `ALBUM_CONCEPTUALIZER_EMAIL_PROVIDER=smtp` sends via SMTP
- A concrete Resend SMTP profile is provided in `.env.production.example`.
- For local testing where you need tokens in API responses:
  - `ALBUM_CONCEPTUALIZER_IDENTITY_DEBUG_TOKENS=true`
- Preflight email verification:
```bash
ALBUM_CONCEPTUALIZER_SMOKE_TO=you@example.com python scripts/email-smoke.py
```

### Stripe Staging Smoke Test
- Use `scripts/stripe-billing-smoke.py` to validate checkout + subscription sync.
- Required env vars:
  - `ALBUM_CONCEPTUALIZER_BASE_URL=https://staging.yourdomain.com`
  - `ALBUM_CONCEPTUALIZER_API_KEY=<staging-api-key>`
  - `STRIPE_PRICE_ID=<price id for selected plan>`
- Optional webhook simulation:
  - `STRIPE_WEBHOOK_SECRET=<webhook signing secret>`
- Run:
```bash
python scripts/stripe-billing-smoke.py --plan pro --simulate-webhook
```
- For webhook-only validation in a non-billable environment:
```bash
python scripts/stripe-billing-smoke.py --simulate-webhook --skip-checkout
```
- For full lifecycle validation (active -> past_due -> canceled):
```bash
python scripts/stripe-billing-smoke.py --simulate-lifecycle --skip-checkout
```

## Full Staging E2E Smoke
- Use `scripts/staging-e2e.py` for a full API path:
  - health
  - album/song/bible CRUD
  - experience toolkit endpoints
  - collab room, challenge mode, template apply, release campaign, and audio preview endpoints
  - export endpoint
  - billing subscription status
- Required env vars:
  - `ALBUM_CONCEPTUALIZER_BASE_URL=https://staging.yourdomain.com`
  - `ALBUM_CONCEPTUALIZER_API_KEY=<staging-api-key>`
- Run:
```bash
python scripts/staging-e2e.py
```

## Browser UI Smoke (Playwright CLI)
- Use `scripts/ui-playwright-smoke.sh` to validate the UI loads and is snapshot-capable.
- Requires `npx` on PATH.
- Optional env var:
  - `ALBUM_CONCEPTUALIZER_UI_BASE_URL=https://staging.yourdomain.com`
- Run:
```bash
bash scripts/ui-playwright-smoke.sh
```

## Browser UI E2E Assertions (Playwright CLI)
- Use `scripts/ui-e2e-playwright.sh` for asserted UI flows:
  - create album
  - edit song content
  - preview/export
  - experience tab actions
  - API docs experience endpoint visibility
- Artifacts are saved to `output/playwright/` (logs + screenshots).
- Run:
```bash
bash scripts/ui-e2e-playwright.sh
```

## Web Staging Smoke
- Use `scripts/web-staging-smoke.sh` for the deployed Next.js surface.
- It verifies:
  - `/api/health`
  - `/api/auth/providers`
  - Playwright unauthenticated prod smoke against the deployed web URL
- Required env var:
  - `ALBUM_CONCEPTUALIZER_WEB_BASE_URL=https://staging.yourdomain.com`
- Optional env var:
  - `ALBUM_CONCEPTUALIZER_INSECURE=true` for self-signed staging TLS
- Run:
```bash
ALBUM_CONCEPTUALIZER_WEB_BASE_URL=https://staging.yourdomain.com \
bash scripts/web-staging-smoke.sh
```
- For the full human validation sequence, use:
  - [`docs/getting-started/web-staging-checklist.md`](web-staging-checklist.md)

## Rate Limiting
- Enable with `ALBUM_CONCEPTUALIZER_RATE_LIMIT_ENABLED=true`.
- Configure throughput with `ALBUM_CONCEPTUALIZER_RATE_LIMIT_PER_MINUTE`.
- Set `ALBUM_CONCEPTUALIZER_RATE_LIMIT_BACKEND=redis` and `ALBUM_CONCEPTUALIZER_REDIS_URL` for persistence.

## Quotas
- Enable daily usage caps with `ALBUM_CONCEPTUALIZER_QUOTA_ENABLED=true`.
- Configure daily limit with `ALBUM_CONCEPTUALIZER_QUOTA_DAILY_LIMIT`.
- Set `ALBUM_CONCEPTUALIZER_QUOTA_BACKEND=redis` and `ALBUM_CONCEPTUALIZER_REDIS_URL` for persistence.

## Storage Backend
- Default API storage is SQLite (`./data/album_conceptualizer.db`).
- Set `ALBUM_CONCEPTUALIZER_STORAGE_BACKEND=file` to persist albums/bibles to disk under `output/api_*`.
- Set `ALBUM_CONCEPTUALIZER_STORAGE_BACKEND=sqlite` for a single SQLite database.
- Configure the SQLite path with `ALBUM_CONCEPTUALIZER_STORAGE_DB` (default `./data/album_conceptualizer.db`).
- Experience toolkit state (collab rooms and challenge profiles) is persisted by the selected storage backend.

## Strict Production Guardrails
- Enable `ALBUM_CONCEPTUALIZER_STRICT_PRODUCTION=true` to fail startup when unsafe defaults are detected.
- Current strict checks:
  - CORS cannot include `*`
  - API auth must be configured (`ALBUM_CONCEPTUALIZER_API_KEY` or `ALBUM_CONCEPTUALIZER_API_KEYS`)
  - storage backend cannot be `memory`
  - when `ALBUM_CONCEPTUALIZER_RATE_LIMIT_ENABLED=true` and `ALBUM_CONCEPTUALIZER_RATE_LIMIT_BACKEND=redis`, `ALBUM_CONCEPTUALIZER_REDIS_URL` must be set
  - when `ALBUM_CONCEPTUALIZER_QUOTA_ENABLED=true` and `ALBUM_CONCEPTUALIZER_QUOTA_BACKEND=redis`, `ALBUM_CONCEPTUALIZER_REDIS_URL` must be set
  - if `ALBUM_CONCEPTUALIZER_SUBSCRIPTION_REQUIRED=true`, Stripe secrets must be configured
  - if subscription gating + Stripe is enabled, `ALBUM_CONCEPTUALIZER_STRIPE_PRICE_ID_PRO` (or `STRIPE_PRICE_ID`) must be configured
  - `ALBUM_CONCEPTUALIZER_IDENTITY_DEBUG_TOKENS` must be `false`
  - when `ALBUM_CONCEPTUALIZER_EMAIL_PROVIDER=smtp`, SMTP host/from and TLS/SSL config must be valid

## Externalized Persistence (Scale Option)
- For multi‑instance deployments, prefer a shared database or object store.
- SQLite works for single‑node or shared‑volume setups.
- If you need multi‑node, plan to add Postgres + Redis.

## Operational Checklist
- Confirm `.env` is present and API keys load.
- Ensure `output/projects/` is writable.
- Validate export paths under `output/projects/<album>/exports/`.
- Run a smoke test: create album → export → open ZIP.
- Monitor logs for `ERROR_OCCURRED` telemetry events.
 - Set `LOG_LEVEL` to `INFO` or `DEBUG` while validating production behavior.

## Ops Checklist (After Launch)
- Backups:
  - Snapshot `output/` and `data/` on a schedule.
  - Store backups off-host (S3, rsync, or your platform’s snapshot tooling).
- Logs:
  - Ensure log rotation is configured (container or host).
  - Watch for repeated 429s from rate limits or quota.
- Metrics:
  - Scrape `/api/v1/metrics` and wire alerts for error spikes.
- Security:
  - Restrict CORS to your domain.
  - Set `ALBUM_CONCEPTUALIZER_API_KEY(S)` for API access.

## Backup Script
- `scripts/backup-data.sh` creates a timestamped archive of `output/`, `data/`, and, when `WEB_DATABASE_URL` or `DATABASE_URL` is set, a `web-postgres.dump` for the Next.js app.
- Set a custom destination with `BACKUP_ROOT=/path/to/backups`.
- Set `INCLUDE_WEB_DB_BACKUP=required` to fail the backup if the web database dump is missing.

Example:
```bash
BACKUP_ROOT=./backups INCLUDE_WEB_DB_BACKUP=required WEB_DATABASE_URL="$DATABASE_URL" ./scripts/backup-data.sh
```

## Restore Drill
- Restore into a staging directory and validate the UI/API before swapping.
- Use `DRY_RUN=true` to list archive contents.
- To restore the web Postgres dump, set `RESTORE_WEB_DB=true`, point `WEB_DATABASE_URL` at the target DB, and confirm with `CONFIRM_WEB_DB_RESTORE=1`.

Example:
```bash
DRY_RUN=true ./scripts/restore-backup.sh ./backups/album-conceptualizer-YYYYMMDD-HHMMSS.tar.gz
RESTORE_ROOT=./restore-test ./scripts/restore-backup.sh ./backups/album-conceptualizer-YYYYMMDD-HHMMSS.tar.gz
RESTORE_ROOT=./restore-test RESTORE_WEB_DB=true CONFIRM_WEB_DB_RESTORE=1 WEB_DATABASE_URL="$DATABASE_URL" ./scripts/restore-backup.sh ./backups/album-conceptualizer-YYYYMMDD-HHMMSS.tar.gz
```

Quick verification checklist:
- Start API/UI against `./restore-test`.
- Validate the restored web DB dump on a staging Postgres instance before pointing production at it.
- Create a new album and verify it persists.
- Export a sample album and download ZIP.
- Confirm `/api/v1/health` and `/api/v1/metrics` respond.

## Monitoring Example (Prometheus)
Add a scrape job for the API metrics endpoint with the Prometheus text format.

Example:
```yaml
scrape_configs:
  - job_name: album-conceptualizer
    metrics_path: /api/v1/metrics
    params:
      format: [prometheus]
    static_configs:
      - targets: ["api:8000"]
```

Alert rules and a minimal Prometheus config are in `ops/prometheus/`.

## Rollback Playbook
Use this rollback path for failed deploys or severe incident responses.

1. Stop traffic to the affected release (reverse proxy route flip or container stop).
2. Restore the previous known-good image/commit:
   - Compose: `docker compose down && git checkout <known-good-tag> && docker compose up -d`
3. Restore data snapshot when needed:
   - `RESTORE_ROOT=./restore-test ./scripts/restore-backup.sh ./backups/<archive>.tar.gz`
4. Verify:
   - `GET /api/v1/health`, `GET /api/v1/ready`, `GET /api/v1/metrics?format=prometheus`
   - `python scripts/staging-e2e.py --base-url <url> --api-key <key>`
   - `python scripts/stripe-billing-smoke.py --base-url <url> --api-key <key> --simulate-lifecycle --skip-checkout`
5. Resume traffic only after smoke + metrics checks pass.

## Alert Threshold Suggestions
- Error budget:
  - Trigger page on `increase(album_conceptualizer_errors_total[5m]) > 10`
- Traffic anomaly:
  - Trigger warning on `increase(album_conceptualizer_requests_total[15m]) == 0` during expected active windows
- Latency anomaly:
  - Track p95/p99 request duration from logs and alert if >2x baseline for 10m
