# Paid Launch Roadmap

This backlog prioritizes work needed to convert the current product from strong alpha to a paid, retention-capable release.

## Current Status
- Engineering quality: solid baseline (`ruff`, `mypy`, tests, API/UI E2E scripts).
- Product readiness: not yet at full paid-market expectations.

## Priority Backlog

### P0: Must-Have Before Paid Launch
1. Real user identity and workspace model
   - Add account auth (OAuth/email magic link) and workspace ownership.
   - Map subscriptions to accounts/workspaces (not API keys).
2. Durable collaboration
   - Real-time co-editing with conflict handling.
   - Presence, typing indicators, and room-level permission controls.
3. Billing hardening
   - Stripe customer portal integration.
   - Invoice history, retry UX for past_due cards, cancellation/reactivation.
4. Reliability SLO guardrails
   - Error budgets, API latency SLO, alert playbooks with owner rotation.
   - Recovery drills and rollback automation.
5. Data safety
   - Per-workspace backup/restore, audit logs, and soft-delete retention.

### P1: Strong Conversion/Retention Drivers
1. “Wow output” upgrades
   - Higher-fidelity audio previews, arrangement variants, quick stem exports.
2. Distribution loops
   - Shareable public pages, feedback links, and remix/challenge invites.
3. Guided onboarding
   - First-project wizard, template recommendation, quality score targets.
4. Usage analytics
   - Funnel instrumentation for activation, engagement, and conversion.

### P2: Expansion Features
1. Mobile-friendly composer workflows
2. Integration layer (DAW handoff, cloud drive exports)
3. Team seat management + role templates

## Suggested 2-Week Execution Plan
1. Week 1
   - Ship account/workspace identity backbone.
   - Add subscription-to-account mapping and portal links.
   - Implement workspace-level persistence and audit logging.
2. Week 2
   - Ship onboarding + share pages + feedback loop.
   - Improve audio preview quality path.
   - Add growth analytics dashboard and launch KPI tracking.

## Launch KPIs (Minimum Targets)
- Activation: >= 45% of signups create first album within 24h.
- Conversion: >= 7% free-to-paid in first 14 days.
- Retention: >= 30% day-30 paid retention.
- Reliability: p95 API latency < 500ms and error rate < 1%.
