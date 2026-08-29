# Paid Alpha Execution Plan

This is the operating document for the next `30` days.

It assumes the current product position is:

> The operating system for coherent concept albums.

Related docs:

- [Pricing & Packaging Proposal](pricing-packaging.md)
- [10-User Paid Alpha Plan](paid-alpha-plan.md)
- [Paid Launch Roadmap](paid-launch-roadmap.md)
- [Web Staging Checklist](web-staging-checklist.md)

## Goal

Validate that serious creators will pay for Album Conceptualizer because it helps them build a coherent multi-track project faster than a DAW-plus-notes workflow.

Success by day `30`:

- `10` paid alpha users
- `6` create a real album
- `4` return weekly for at least `2` weeks
- `3` export or publish
- live auth, billing, webhook, and export are validated on staging

## Positioning

### Core message

Album Conceptualizer helps artists and producer-songwriters turn one idea into a coherent album blueprint with narrative, track structure, lyrics/chords workflow, collaboration, and export-ready handoff.

### What to emphasize

- coherence across tracks
- album bible as source of truth
- finishability, not infinite ideation
- clean handoff into real production workflows

### What to avoid

- "one-click song generator"
- "make a hit instantly"
- direct Suno/Udio replacement framing

## Offer

### Public offer

- `Free`: evaluation lane
- `Pro`: `$12/mo`
- `Team`: manual pilot only

### Founder alpha offer

- `Pro` at `$12/mo`
- founder pricing protected for `12` months
- direct onboarding help
- direct feedback access

### Pricing logic

Use pricing to reinforce visible creative progress:

- Free gets users to first album momentum
- Pro unlocks full export and sustained project work
- Team is reserved for creator duos or small bands that need hands-on support

## Weekly Plan

### Week 1: Staging and launch surface

Objective: make the product safe to invite real users into.

- pass the full staging checklist
- validate real auth
- validate Stripe test checkout and webhook delivery
- validate export on deployed infrastructure
- confirm `/api/health` is green after the full pass
- tighten the homepage headline, proof, and CTA around the concept-album wedge
- prepare `3` example projects for demos and screenshots

Exit criteria:

- all staging checks pass
- one stable staging URL exists
- one export demo can be shown end to end

### Week 2: Activation and onboarding

Objective: get first-session users to visible momentum in under `5` minutes.

- refine the create flow around concept, arc, and tracklist
- make the first-project checklist impossible to miss
- improve example prompts and templates
- tighten upgrade prompts around export value, not generic credits
- review funnel data for:
  - sign in
  - album created
  - bible viewed
  - studio viewed
  - export requested
  - published

Exit criteria:

- first session reliably ends with a saved album
- at least one example album demonstrates a strong before/after story

### Week 3: Recruit first `5`

Objective: get the first real paid users into the product.

- recruit through direct outreach, small communities, and existing network
- onboard each user manually
- observe exactly where they stall
- capture objections in the same format for every user
- fix top `2-3` friction points immediately

Exit criteria:

- `5` paid users onboarded
- at least `3` created a real project
- top objections ranked by frequency

### Week 4: Recruit next `5` and sharpen proof

Objective: confirm the wedge with a larger sample and turn wins into proof.

- recruit the next `5` paid users
- publish `3-5` strong example albums in Discover
- collect screenshots, quotes, and workflow proof
- identify the product moments most correlated with retention
- turn repeated wins into homepage and sales copy

Exit criteria:

- `10` paid users total
- at least `3` exports or publishes
- `2-3` usable testimonials or proof snippets

## Messaging System

Use one message hierarchy everywhere.

### Headline options

- Make a concept album that actually holds together.
- Build the blueprint before the DAW buries the idea.
- Turn one album idea into a coherent multi-track project.

### Subhead options

- Plan narrative, motifs, lyrics, chords, and track arc in one workspace, then export a clean handoff pack for production.
- Keep the whole record pointed in one direction with an album bible, structured editing, collaboration, version history, and export-ready files.

### CTA options

- Start your first album blueprint
- Build your concept album
- See the workflow

### Pricing copy

#### Free

Start your first concept album and see if the workflow clicks.

#### Pro

Build full album blueprints, keep the project coherent, and export clean handoff packs.

#### Team

Shared concept development for small creative teams, available as a pilot.

### Short pitch

Album Conceptualizer is the workspace for building concept albums that actually hold together. It helps artists and producer-songwriters turn a rough idea into a structured album blueprint with narrative, lyrics, chords, versions, collaboration, and export-ready handoff.

### Why-now proof bullets

- album-first workflow instead of song-by-song chaos
- collaboration, versioning, and publish/remix built into the same project model
- exports that move the project into real production tools

## Outreach Playbook

### Best-fit targets

- indie artists actively building an EP or album
- producer-songwriters with a multi-song release in progress
- bands with one strong creative lead
- soundtrack or theater-adjacent creators working across multiple pieces

### Avoid

- users who only want instant finished audio
- large teams expecting mature admin workflows
- generic AI-tool tourists

### Channel order

1. personal network
2. warm introductions
3. niche Discord servers
4. artist/producer DMs
5. Reddit and small songwriting communities

### Cold DM

> I’m working on a tool for artists and producer-songwriters who want to build concept albums that actually hold together. It helps with album bibles, track planning, lyrics/chords structure, versions, and export-ready handoff. I’m onboarding 10 paid alpha users right now. If you’re actively building a multi-song project, I’d be happy to show it to you.

### Warmer follow-up

> The product is strongest for people who already have an album idea but keep losing the thread across tracks. If that sounds familiar, I can walk you through the workflow and get you to a real project scaffold quickly.

### Short email

Subject: Paid alpha for concept album workflow

> I’m opening a small paid alpha for Album Conceptualizer. It’s built for artists and producer-songwriters who need help turning one idea into a coherent album blueprint before production gets messy. The current product covers album bible, track planning, lyrics/chords workflow, versions, comments/tasks, publish/remix, and export handoff. If you’re actively working on a multi-song project, I’d like to onboard 10 users directly at a founder price of `$12/mo`.

### Qualification questions

- Are you actively working on an EP or album right now?
- Do you care about coherence across tracks, not just single-song ideation?
- Are you willing to pay for the product during alpha?
- Are you willing to provide direct feedback after use?

## Onboarding Script

Use the same guided first session every time.

1. Get the user to describe the album in one paragraph.
2. Turn that into a saved project with a tracklist.
3. Open the Bible and make the concept feel more concrete.
4. Open Studio and edit at least one section.
5. Show export or publish, depending on the user’s immediate goal.

First-session success means the user leaves with something they would regret losing.

## Metrics

Track these every week:

- landing -> signup
- signup -> first album
- first album -> bible viewed
- first album -> studio viewed
- first album -> export requested
- first album -> published
- free -> paid
- week-1 retention
- week-2 retention

If time is tight, prioritize:

- album created
- export requested
- published
- paid conversion

## Decision Rules

### Keep pushing if

- users describe the product as helping them stay coherent
- first-session users reach a visible artifact quickly
- exports and publish/remix increase perceived value
- at least `4/10` paid users come back on their own

### Slow down if

- users keep asking for finished-audio generation first
- onboarding requires too much manual explanation
- users fail to reach export or publish value moments
- the product is interesting but not important enough to pay for

## Recommended Working Rhythm

Monday:

- review funnel numbers
- review user notes
- choose `1-2` product fixes and `1` messaging fix

Tuesday to Thursday:

- recruit
- onboard
- ship small improvements immediately

Friday:

- summarize wins, objections, and retention risk
- update homepage copy, sales copy, and outreach scripts from real user language

## Deliverables To Prepare This Week

- live staging evidence packet
- `3` example albums
- one `2-3` minute demo walkthrough
- one short landing-page copy set
- one DM template
- one email template
- one alpha onboarding checklist

## Final Recommendation

Run this like a founder-led paid alpha, not a public launch.

The product already has enough surface area to create real value. The next job is to prove that value with serious creators, simplify the story, and build evidence around the moments that make them stay.
