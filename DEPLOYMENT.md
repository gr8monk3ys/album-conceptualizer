# Deployment Guide

## Architecture

| Component | Platform | Directory |
|-----------|----------|-----------|
| Next.js frontend | Vercel | `apps/web/` |
| Python API | Railway | Root (`/`) |

Deployments trigger automatically when CI passes on `main` (see `.github/workflows/deploy.yml`).
You can also trigger manually via `workflow_dispatch`.

## GitHub Secrets

Set these in **Settings > Secrets and variables > Actions**:

| Secret | Source |
|--------|--------|
| `VERCEL_TOKEN` | [Vercel Tokens](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | `.vercel/project.json` after `vercel link` |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` after `vercel link` |
| `RAILWAY_TOKEN` | [Railway Dashboard](https://railway.app/account/tokens) |

## Railway Environment Variables

Set these in the Railway service dashboard:

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |
| `REPLICATE_API_TOKEN` | Replicate API token for image generation |
| `ALBUM_CONCEPTUALIZER_*` | Any app-specific config (DB URL, etc.) |
| `SENTRY_DSN` | Sentry error tracking DSN |

## Vercel Environment Variables

Set these in the Vercel project dashboard under **Settings > Environment Variables**:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Random secret for NextAuth.js sessions |
| `NEXTAUTH_URL` | Production URL (e.g. `https://your-app.vercel.app`) |
| `SENTRY_DSN` | Sentry error tracking DSN |
| `GITHUB_ID` | GitHub OAuth app client ID |
| `GITHUB_SECRET` | GitHub OAuth app client secret |

## One-Time Setup

### Vercel

```bash
cd apps/web
npx vercel link          # links project, creates .vercel/project.json
npx prisma migrate deploy   # run migrations against production DB
```

### Railway

```bash
npm install -g @railway/cli
railway login
railway link               # link to your Railway project
```

## Local Development

```bash
# Start all services (API + DB + web)
docker-compose up -d

# Or run individually:
# API
pip install -e ".[dev]"
uvicorn album_conceptualizer.api:app --reload --port 8000

# Web
cd apps/web
npm install
npx prisma migrate dev
npm run dev
```

## Manual Deployment

```bash
# Deploy API to Railway
railway up --service album-api

# Deploy web to Vercel
cd apps/web
vercel --prod
```

## Rollback

- **Vercel**: Use the Vercel dashboard to promote a previous deployment.
- **Railway**: Use `railway rollback` or redeploy a previous commit from the dashboard.
