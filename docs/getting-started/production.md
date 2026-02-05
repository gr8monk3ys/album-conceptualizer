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
  - `ALBUM_CONCEPTUALIZER_API_KEY=...` (optional, enables API auth)
  - `ALBUM_CONCEPTUALIZER_CORS_ORIGINS=https://yourdomain.com` (optional)
  - `ALBUM_CONCEPTUALIZER_RATE_LIMIT_ENABLED=true` (optional)
  - `ALBUM_CONCEPTUALIZER_RATE_LIMIT_PER_MINUTE=120` (optional)
  - `ALBUM_CONCEPTUALIZER_QUOTA_ENABLED=true` (optional)
  - `ALBUM_CONCEPTUALIZER_QUOTA_DAILY_LIMIT=1000` (optional)
  - `ALBUM_CONCEPTUALIZER_STORAGE_BACKEND=file` (optional)
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
- `scripts/run-prod-compose.sh` runs the same command.

Use `docker compose logs -f` to tail logs and `docker compose down` to stop.

## Run Natively (No Docker)
- Install dependencies:
  - `uv pip install --system -e ".[ui,ai,rag,music]"`
- Start the API:
  - `make api` (or `make api-dev` for reload)
- Launch the UI:
  - `make ui`

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
- API liveness:
  - `GET /api/v1/live`
- API metrics:
  - `GET /api/v1/metrics`

## Authentication
- If `ALBUM_CONCEPTUALIZER_API_KEY` is set, pass it on requests:
  - Header `X-API-Key: <your-key>`
  - Or `Authorization: Bearer <your-key>`
- For rotation, set multiple keys:
  - `ALBUM_CONCEPTUALIZER_API_KEYS=key1,key2,key3`

## Rate Limiting
- Enable with `ALBUM_CONCEPTUALIZER_RATE_LIMIT_ENABLED=true`.
- Configure throughput with `ALBUM_CONCEPTUALIZER_RATE_LIMIT_PER_MINUTE`.
- Set `ALBUM_CONCEPTUALIZER_RATE_LIMIT_BACKEND=redis` and `ALBUM_CONCEPTUALIZER_REDIS_URL` for persistence.

## Quotas
- Enable daily usage caps with `ALBUM_CONCEPTUALIZER_QUOTA_ENABLED=true`.
- Configure daily limit with `ALBUM_CONCEPTUALIZER_QUOTA_DAILY_LIMIT`.
- Set `ALBUM_CONCEPTUALIZER_QUOTA_BACKEND=redis` and `ALBUM_CONCEPTUALIZER_REDIS_URL` for persistence.

## Storage Backend
- Default API storage is in‑memory (ephemeral).
- Set `ALBUM_CONCEPTUALIZER_STORAGE_BACKEND=file` to persist albums/bibles to disk under `output/api_*`.
- Set `ALBUM_CONCEPTUALIZER_STORAGE_BACKEND=sqlite` for a single SQLite database.
- Configure the SQLite path with `ALBUM_CONCEPTUALIZER_STORAGE_DB` (default `./data/album_conceptualizer.db`).

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
- `scripts/backup-data.sh` creates a timestamped archive of `output/` and `data/`.
- Set a custom destination with `BACKUP_ROOT=/path/to/backups`.

Example:
```bash
BACKUP_ROOT=./backups ./scripts/backup-data.sh
```

## Restore Drill
- Restore into a staging directory and validate the UI/API before swapping.
- Use `DRY_RUN=true` to list archive contents.

Example:
```bash
DRY_RUN=true ./scripts/restore-backup.sh ./backups/album-conceptualizer-YYYYMMDD-HHMMSS.tar.gz
RESTORE_ROOT=./restore-test ./scripts/restore-backup.sh ./backups/album-conceptualizer-YYYYMMDD-HHMMSS.tar.gz
```

Quick verification checklist:
- Start API/UI against `./restore-test`.
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
