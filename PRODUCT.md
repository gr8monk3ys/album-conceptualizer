# Product

> Written without a live interview: the maintainer asked for the session to proceed on recommended answers. Facts come from the repo (`README.md`, `CONTEXT.md`, `docs/product/`, `.claude/product-marketing-context.md`, the shipped UI). Lines marked _(inferred)_ are hypotheses to confirm.

## Platform

web

## Users

- **Solo concept artists** turning a narrative idea into a finished multi-track record. They start strong and lose the thread by track 4 or 5.
- **Producer-songwriters** who need concept, structure and lyrics in one place before opening a DAW, and a clean export when they do.
- **Small bands or writing teams** that need one source of truth for the album. _(inferred: collaboration exists as comments, tasks and versions, but workspaces have a single member today)_

The usage scene is a laptop at a desk or studio, in long focused writing sessions, often at night, next to a DAW. _(inferred)_

## Product Purpose

Help creators finish a coherent concept album. The workspace turns one idea into an album blueprint: tracklist, narrative arc, Story bible (themes, motifs, characters) and Sound bible (how it should sound), lyrics and chord drafts per Section, and a coherence report, then hands it off to production as MIDI, ChordPro, MusicXML, JSON or a Handoff pack. Success means an album that feels intentional across every track, gets into a DAW and actually gets finished.

## Positioning

The album is the unit, not the song. Audio generators produce isolated moments and DAWs don't plan narrative; this product keeps narrative, lyrics, harmony and album-level continuity in one model and checks coherence across it. It does not generate finished audio. Its AI helps with scaffolding and consistency, not autopilot.

## Operating Context

- Flow: create (a guided wizard, optional AI ideation) → refine in the Studio (songs, sections, lyrics, chords) → Story bible and Sound bible → coherence report → export or Handoff pack → optionally publish to Discover, where others can Remix.
- Tools next to it: a DAW, audio generators (Suno and similar) fed by Handoff packs, voice memos (rough demos).
- Metered by Credits and gated by Plan (free / pro / team) through Stripe. Daily challenges earn credits.

## Capabilities and Constraints

- Web app (Next.js) with a Python Engine for exports and Agent workflows. Albums live in Postgres as an Album snapshot (JSON).
- AI workflows need an Anthropic key on the Engine; without one they fail gracefully.
- Workspaces have one member today; there is no invite flow.
- There is no finished-audio generation. MIDI and MP3 previews render chord progressions only.

## Brand Commitments

- Name: **Album Conceptualizer**.
- Voice: confident, creative, structured. Direct and craft-oriented, never hype.
- Words to use: coherent, concept album, Story bible, blueprint, finishable, narrative arc, motifs, export-ready, remix.
- Words to avoid: instant hit, one-click song, fully generated masterpiece, autopilot music, magic.

## Evidence on Hand

- No customer logos, testimonials, usage metrics or press. Do not fabricate any.
- Pricing draft in the app: Free $0 (5 projects), Pro $12/mo, Team $29/mo. Treat it as provisional.
- There are no real album artwork or audio assets; albums are text blueprints.

## Product Principles

1. **Album first.** Every screen should keep the whole record in view, and a song is always shown in the context of its album.
2. **Coherence is the product.** Surface how the pieces relate (themes across tracks, motifs, arc) instead of listing fields.
3. **The artist keeps authorship.** AI suggests and scaffolds; the user decides. Never present generated content as final.
4. **Finishable over feature-rich.** Make the next step obvious; unfinished albums are the failure mode.
5. **Hand off cleanly.** The work leaves for a DAW or generator without loss.

## Accessibility & Inclusion

WCAG 2.2 AA as the floor _(inferred: no stated requirement)_. Long writing sessions mean comfortable reading contrast and full keyboard use in the Studio.
