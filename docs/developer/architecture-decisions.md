# Architecture Decisions

This page captures the current architectural decisions that matter most when changing the repo.

These are short ADR-style notes, not full essays.

## ADR-001: The Web App Owns User-Facing Product State

### Status

Accepted

### Context

The repo has both a Next.js web app and a Python engine. Without a clear boundary, features drift and bugs show up as duplicated state or unclear ownership.

### Decision

The web app owns user-facing product state:

- users and workspaces
- albums and their collaboration state
- subscriptions and credits
- analytics
- the main user interface

The Python engine provides supporting capabilities:

- export
- theory and experience endpoints
- optional AI and RAG features
- the legacy Gradio surface

### Consequences

- new user-facing workflows should usually be implemented in the web app first
- Postgres is the source of truth for the web product
- cross-system integration quality matters most at the export boundary

## ADR-002: `Album.data` Is The Export Source Of Truth

### Status

Accepted

### Context

The UI needs normalized relational tables for queries and collaboration workflows, but the export engine needs the full album shape.

### Decision

Store the full album snapshot on `Album.data` and derive normalized `Song` and `Section` rows from it during create and save flows.

### Consequences

- a field change in album structure usually touches both Prisma and `AlbumJsonSchema`
- saving an album is effectively a full snapshot write, not a narrow row patch
- export regressions are likely if only normalized tables are updated

## ADR-003: Production Health Must Fail Closed

### Status

Accepted

### Context

A deployment that starts but cannot authenticate, bill, rate limit, or reach its engine is not actually healthy.

### Decision

Use strict production validation and expose it through the web health endpoint. Invalid production config should make `/api/health` fail.

Stripe webhooks must also fail closed: if persistence fails after signature verification, return non-`2xx` so Stripe retries.

### Consequences

- `/api/health` is a deployment gate, not just a liveness ping
- missing auth, billing, engine, or rate-limit config should block release
- webhook errors must be treated as state consistency risks

## ADR-004: Production Builds Use Webpack For Now

### Status

Accepted

### Context

The current Turbopack production path was unstable for this app's authenticated production-start audits and also cost the last point on Lighthouse.

### Decision

Use `next build --webpack` for production builds in the web app until the Turbopack production path is stable enough for:

- authenticated `next start`
- exact Lighthouse targets
- repeatable local and CI behavior

### Consequences

- `apps/web/package.json` intentionally uses Webpack for `npm run build`
- performance and stability verification should be measured against the Webpack build
- a future switch back to Turbopack should be an explicit re-evaluation, not an accidental change

## ADR-005: Production Rate Limiting And Backups Must Be Persistent

### Status

Accepted

### Context

Temporary or memory-only protection is not enough for a real deployed web product, and backup plans that ignore Postgres are incomplete.

### Decision

- production web rate limiting should rely on persistent Upstash or Redis configuration
- backup and restore procedures must include the web Postgres system of record

### Consequences

- strict production validation should reject missing or broken persistent rate limiting
- backup drills must include Postgres restore validation, not only archive creation
- deployment defaults that point at in-memory persistence are unsafe and should be avoided

## How To Use These Decisions

When making a change, ask:

1. does this belong in the web app or the Python engine?
2. does it change the `album.json` source of truth?
3. does it weaken production fail-closed behavior?
4. does it depend on build-system behavior that should remain explicit?
5. does it assume temporary persistence where production needs durable infrastructure?

If the answer to any of those is yes, update code and docs together.
