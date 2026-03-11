# Paid Launch Roadmap

This roadmap reflects the current state of the product after the recent production-readiness hardening work. It is now more useful to think in terms of a **paid alpha** than a broad public launch.

Related docs:

- [Pricing & Packaging Proposal](pricing-packaging.md)
- [10-User Paid Alpha Plan](paid-alpha-plan.md)

## Current Status

- Engineering quality: strong baseline (`ruff`, `mypy`, Python tests, API/UI E2E, web build, web Playwright)
- Product infrastructure: auth, workspaces, billing, exports, publish/discover/remix, and production health gating are in place
- Main gap: the product now needs activation proof, live staging validation, early customer learning, and stronger "wow" moments

## Priority Backlog

### P0: Must-Have For Paid Alpha

1. Guided onboarding
   - First-project flow that gets a user to a compelling album blueprint in under 5 minutes
   - Strong templates for concept, narrative arc, motifs, and references
2. Live staging proof
   - Validate auth, billing, webhooks, and export against deployed services
   - Add a repeatable smoke checklist for staging before recruiting users
3. Usage analytics
   - Instrument the funnel from landing -> signup -> album create -> export/publish -> upgrade
   - Track retention and project completion behavior
4. Example outputs
   - Publish `3-5` strong example albums
   - Give new users concrete references for what "good" looks like

### P1: Conversion And Retention Drivers

1. Coherence review upgrades
   - Give users more actionable feedback across tracks, motifs, and themes
2. Export polish
   - Make the export bundle feel more premium and easier to hand off
3. Feedback loops
   - Improve publish/discover/remix so public projects are worth browsing and reusing
4. Social proof
   - Capture testimonials, before/after stories, and usage wins from alpha users

### P2: Expansion Features

1. Better collaboration
   - Seat management, invites, and role templates
   - Eventually real-time co-editing
2. Audio-adjacent depth
   - Higher-quality previews, arrangement support, stems, or integrations
3. Broader workflow integrations
   - DAW/cloud handoff improvements
   - Stronger sharing and archive flows

## Recommended Sequence

### Phase 1: Make The Alpha Sellable

- tighten the homepage and onboarding around the "concept album workspace" wedge
- set up funnel instrumentation
- validate live staging flows
- create strong example projects

### Phase 2: Recruit The First 10 Paid Users

- recruit artists and producer-songwriters with active multi-song projects
- onboard them manually
- observe where they stall and fix the onboarding/product/message gaps fast

### Phase 3: Expand From Signal, Not Hope

- keep the acquisition channels that produce best-fit users
- sharpen the pricing story around Pro
- delay a broader launch until retention and export/publish behaviors are real

## Launch KPIs (Paid Alpha Targets)

- Activation: `>= 45%` of signups create a first album within 24 hours
- Engagement: `>= 60%` of activated users edit at least one song or album bible section
- Value moment: `>= 30%` of activated users export or publish within 7 days
- Conversion: `>= 10` paying alpha users
- Reliability: p95 API latency `< 500ms` and error rate `< 1%`
