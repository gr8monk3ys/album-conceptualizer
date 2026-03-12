# Runbooks

This page is the operational handoff for running Album Conceptualizer safely.

## Production Topology

The current intended topology is:

- Next.js web app deployed separately
- Postgres for the web system of record
- Upstash or Redis for web rate limiting
- Stripe for billing
- Python engine deployed as a separate service

The web app should be treated as the main user-facing control plane.

## Health Checks

### Web

Primary web health endpoint:

```text
GET /api/health
```

This should be used as the deployment gate because it includes config validation, not only process liveness.

### Python API

Primary API health endpoints:

```text
GET /api/v1/live
GET /api/v1/ready
GET /api/v1/ready?strict=true
```

### Metrics

The Python API exposes metrics at:

```text
GET /api/v1/metrics
```

## Before You Call A Deploy Healthy

Verify:

- web `/api/health` returns healthy
- auth providers are configured correctly
- Stripe secrets and price ids are set when billing is enabled
- Upstash or Redis is configured for production rate limiting
- the engine is reachable from the web app
- Prisma migrations were applied

## Staging Verification

### Web Surface

Run:

```bash
ALBUM_CONCEPTUALIZER_WEB_BASE_URL=https://staging.example.com \
bash scripts/web-staging-smoke.sh
```

Then follow:

- `docs/getting-started/web-staging-checklist.md`

### Python API

Run:

```bash
ALBUM_CONCEPTUALIZER_BASE_URL=https://api-staging.example.com \
ALBUM_CONCEPTUALIZER_API_KEY=... \
python scripts/staging-e2e.py
```

### Billing

Run:

```bash
ALBUM_CONCEPTUALIZER_BASE_URL=https://staging.example.com \
ALBUM_CONCEPTUALIZER_API_KEY=... \
STRIPE_PRICE_ID=... \
python scripts/stripe-billing-smoke.py --plan pro --simulate-webhook
```

## Backup And Restore

### Full Backup Archive

```bash
BACKUP_ROOT=./backups ./scripts/backup-data.sh
```

This now includes the web Postgres dump when `WEB_DATABASE_URL` or `DATABASE_URL` is configured.

### Dry Run Restore

```bash
DRY_RUN=true ./scripts/restore-backup.sh ./backups/<archive>.tar.gz
```

### Restore Into A Separate Folder First

```bash
RESTORE_ROOT=./restore-test ./scripts/restore-backup.sh ./backups/<archive>.tar.gz
```

### Web Database Only

Backup:

```bash
./scripts/web-db-backup.sh
```

Restore:

```bash
./scripts/web-db-restore.sh /path/to/web-postgres.dump
```

## Incident Guide

### Web Health Fails

Check:

- `NEXTAUTH_URL`
- `NEXT_PUBLIC_APP_URL`
- auth provider env
- Upstash or Redis env
- `ENGINE_API_URL`
- database reachability

The web app is designed to fail health when critical production config is missing. Treat that as a real blocker, not an annoyance.

### Export Fails

Check:

- the Python engine is reachable
- `ENGINE_API_KEY` matches on both sides
- the engine has the required export dependencies installed
- the web export route is still serializing album data correctly

### Billing State Looks Wrong

Check:

- Stripe webhook delivery logs
- web webhook response status
- `STRIPE_WEBHOOK_SECRET`
- price ids configured in the web app
- persistence errors in the webhook route

### Rate Limiting Is Not Active

Check:

- Upstash or Redis env is configured
- production config validation is enabled
- the app did not start in a permissive dev mode

## Useful Operational Scripts

| Script | Purpose |
| --- | --- |
| `scripts/run-prod.sh` | start API and UI production stack |
| `scripts/run-prod-compose.sh` | run compose-based production start with preflight |
| `scripts/stop-prod.sh` | stop production stack |
| `scripts/staging-e2e.py` | Python API staging smoke |
| `scripts/stripe-billing-smoke.py` | billing smoke and lifecycle simulation |
| `scripts/web-staging-smoke.sh` | deployed web smoke |
| `scripts/backup-data.sh` | full backup archive |
| `scripts/restore-backup.sh` | full restore |
| `scripts/web-db-backup.sh` | web Postgres dump |
| `scripts/web-db-restore.sh` | web Postgres restore |

## Operator Rules Of Thumb

- Treat Postgres as the source of truth for the web product
- Treat `/api/health` as a hard gate
- Do not mark billing healthy without webhook verification
- Do not call export healthy without hitting the deployed engine
- Test restore paths, not only backup creation
