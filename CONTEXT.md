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
One track of an Album, with a track number, a Role, a Story note, themes, Motifs and Sections.
_Avoid_: track (except for "track number")

**Story note**:
A Song's one- or two-sentence account of what happens in it (field `narrative_summary`). The same name everywhere: labels, headings, fix links, Coherence findings, handoff packs.
_Avoid_: narrative summary, song brief, story notes for the album's concept (that is the concept summary)

**Role**:
A Song's place in the album's arc, such as "Inciting incident" or "Resolution" (field `narrative_position`).
_Avoid_: narrative position, narrative role, story position (that is the story order)

**Motifs**:
The album's recurring images, sounds or phrases: the album-level motifs (`recurring_motifs`) plus the motif tags on each Song. The Album Bible, the Coherence report and the handoff packs all read this one merged list (`lib/motifs.ts`), so a motif named only for the album still counts.
_Avoid_: recurring motifs as a separate list, callbacks (a callback is a motif coming back on a second Song)

**Written**:
A Section's lyrics are written once anything is left after removing "[…]" placeholders (`lib/lyrics.ts`); its chords are written once they differ from the starter loop the setup writes (`lib/chords.ts`). Placeholders and the starter loop never count as done, anywhere a count is shown.

**Section**:
A part of a Song (verse, chorus, bridge…) carrying lyrics, chords and its narrative function.

**Album Bible**:
The album's reference for consistency: concept, themes, motifs, characters and style, derived from the Album snapshot.
_Avoid_: story bible, lore doc

**Style bible**:
The voice and sonic guidance inside the Album snapshot (lead voice, palette, arrangement rules, things to avoid). The one name on every surface: labels, headings, buttons, Help and the Sound page.
_Avoid_: style guide, "Voice / style bible", "Voice and style"

**Coherence report**:
The computed assessment of how well an Album's Songs hold together against its concept, themes and Motifs. Every dimension is capped by the share of Songs with written lyrics, and an Album with any unwritten Song is labelled "Unfinished" (with the count) whatever its score.

**Handoff pack**:
A Markdown brief for taking an Album into a specific downstream tool (a DAW, a generator, a collaborator).

**Remix**:
A new Album forked from a published or shared Album snapshot into the remixer's Workspace. It records where it came from (`remixed_from`: the original's id, title and artist), so the release header reads "Remix of <title> by <artist>" and links to the original on Discover while it is still published.
_Avoid_: copy, clone

**Discover**:
The public feed of published Albums, where others read them and Remix them. The one name for it everywhere, its page heading included; an Album is "on Discover" once published.
_Avoid_: Community albums, community projects, the feed, the gallery

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
An AI job run by the Engine for an Album: ideation, song development or coherence review. The artist sees each one as an **AI draft**, and that is the only name the UI uses for it and its cost ("AI draft · 5 credits").
_Avoid_: crew (that's the implementation), AI task; in the UI, "AI run", "agent workflow"

**Engine**:
The Python service that runs Agent workflows and exports. It is stateless toward the web app: it receives Album snapshots and keeps no copy.
_Avoid_: backend, API server
