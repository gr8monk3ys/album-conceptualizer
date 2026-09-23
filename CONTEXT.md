# Album Conceptualizer

A workspace for planning coherent concept albums: from a one-paragraph idea to a structured record with narrative, themes, songs and a DAW-ready handoff.

## Language

### Albums

**Album**:
A concept album project in a Workspace: its title, concept, tracklist and everything written for it.
_Avoid_: project (in code), record

**Album snapshot**:
The album's full JSON document, the source of truth for an Album. Every other representation (list columns, song rows, exports) is derived from it.
_Avoid_: album data blob, payload

**Song**:
One track of an Album, with a track number, narrative role, themes and Sections.
_Avoid_: track (except for "track number")

**Section**:
A part of a Song (verse, chorus, bridge…) carrying lyrics, chords and its narrative function.

**Album Bible**:
The album's reference for consistency: concept, themes, motifs, characters and style, derived from the Album snapshot.
_Avoid_: story bible, lore doc

**Style bible**:
The voice and sonic guidance inside the Album snapshot (lead voice, palette, arrangement rules, things to avoid).
_Avoid_: style guide

**Coherence report**:
The computed assessment of how well an Album's Songs hold together against its concept, themes and motifs.

**Handoff pack**:
A Markdown brief for taking an Album into a specific downstream tool (a DAW, a generator, a collaborator).

**Remix**:
A new Album forked from a published or shared Album snapshot into the remixer's Workspace.
_Avoid_: copy, clone

### Workspace and billing

**Workspace**:
The owner of Albums, credits and a subscription. Every signed-in user acts in exactly one Workspace; today a Workspace has a single member, its owner.
_Avoid_: team, org, account

**Plan**:
The Workspace's effective tier (free, pro or team). A paid Plan counts only while its subscription is active, trialing or past due; otherwise the Workspace is on free.

**Credits**:
The Workspace's balance for metered actions (creating, remixing, exporting, running agents). Each Plan grants its monthly credits once per calendar month; challenges add more.
_Avoid_: tokens, points

**Agent workflow**:
An AI job run by the Engine for an Album: ideation, song development or coherence review.
_Avoid_: crew (that's the implementation), AI task

**Engine**:
The Python service that runs Agent workflows and exports. It is stateless toward the web app: it receives Album snapshots and keeps no copy.
_Avoid_: backend, API server
