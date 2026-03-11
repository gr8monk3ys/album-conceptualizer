# Web Staging Checklist

Use this before inviting paid alpha users or calling the web product production-ready.

This checklist is intentionally split into:

- automated smoke checks you should run on every staging deploy
- manual live-provider checks that still require a real browser, real auth, and real Stripe

## Required Inputs

- staging web URL, for example `https://staging.yourdomain.com`
- staging engine URL reachable from the web app
- staging Postgres database
- staging Upstash Redis credentials
- staging auth provider configuration
  - GitHub OAuth and/or email magic link delivery
- staging Stripe test-mode credentials
  - secret key
  - webhook secret
  - plan price ids

## Automated Checks

Run all three before manual QA.

### 1. Web Smoke

Validates:

- `/api/health`
- `/api/auth/providers`
- unauthenticated browser smoke via Playwright

Run:

```bash
ALBUM_CONCEPTUALIZER_WEB_BASE_URL=https://staging.yourdomain.com \
bash scripts/web-staging-smoke.sh
```

### 2. API Smoke

Validates the Python API surface, export path, collaboration endpoints, and related launch-critical API flows.

Run:

```bash
ALBUM_CONCEPTUALIZER_BASE_URL=https://staging.yourdomain.com \
ALBUM_CONCEPTUALIZER_API_KEY=<staging-api-key> \
python scripts/staging-e2e.py
```

### 3. Billing Smoke

Validates checkout session creation and Stripe webhook handling.

Run:

```bash
ALBUM_CONCEPTUALIZER_BASE_URL=https://staging.yourdomain.com \
ALBUM_CONCEPTUALIZER_API_KEY=<staging-api-key> \
STRIPE_PRICE_ID=<staging-price-id> \
STRIPE_WEBHOOK_SECRET=<staging-webhook-secret> \
python scripts/stripe-billing-smoke.py --plan pro --simulate-webhook
```

## Manual Web Validation

Record pass/fail and capture screenshots or short clips for each step.

### Auth

- Verify `GET /api/health` returns `200` and `checks.config=true`, `checks.db=true`, `checks.engine=true`.
- GitHub OAuth:
  - click `Sign in with GitHub`
  - complete auth in test mode
  - confirm redirect back to `/app`
  - confirm the session persists after a refresh
- Email auth, if enabled:
  - request a magic link
  - confirm the email arrives from the correct sender
  - confirm the link lands in `/app`
  - confirm the session persists after a refresh

### Core Product Flow

- Create a new album from `/app/create`.
- Confirm the onboarding wizard saves successfully and lands on the album detail page.
- Confirm the first-project checklist is visible on first open.
- Open the Bible page and verify the album narrative, themes, and graph render.
- Open Studio, edit lyrics or chords, save, and confirm the saved state persists after refresh.
- Export a zip bundle and verify it contains the expected deliverables.
  - minimum: JSON, MIDI, ChordPro
- Publish the album.
- Confirm it appears in Discover.
- Fork or remix the published album and confirm the new copy is editable.

### Billing

- Open `/app/settings/billing`.
- Start a Stripe checkout session for the intended plan.
- Complete checkout in Stripe test mode.
- Confirm the app returns to the correct success URL.
- Confirm the workspace plan/state updates in the app.
- Open the billing portal and confirm it loads.
- Trigger at least one subscription lifecycle event in Stripe test mode.
  - minimum: `checkout.session.completed`
  - recommended: `customer.subscription.updated`, `customer.subscription.deleted`
- Confirm webhook deliveries are `2xx` in Stripe and the app state matches the event.

### Operational Gates

- Confirm rate-limited routes are not failing open in staging config.
- Confirm the engine URL configured in the web app is the intended staging engine.
- Confirm backups are enabled for the web Postgres database.
- Confirm logs/alerts are wired for auth failures, Stripe webhook failures, and export failures.

## Release Criteria

Do not recruit alpha users until all of the following are true:

- web smoke passes
- API smoke passes
- billing smoke passes
- at least one real auth flow passes
- create -> bible -> studio -> export -> publish -> remix passes manually
- Stripe webhook deliveries are green in test mode
- `/api/health` is green after the full smoke pass

## Evidence To Save

- `/api/health` response payload
- output from `scripts/web-staging-smoke.sh`
- output from `scripts/staging-e2e.py`
- output from `scripts/stripe-billing-smoke.py`
- screenshots or short recordings for:
  - sign-in success
  - successful export
  - successful publish/discover/remix
  - Stripe checkout success
  - Stripe webhook delivery history
