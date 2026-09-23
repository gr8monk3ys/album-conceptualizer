---
version: 1
slug: "apps-web-src"
primary_target: "apps/web/src"
related_targets: []
---

# Surface brief: Album Conceptualizer web app

Scope: the whole web UI (apps/web/src). Visitor mode: Operate for /app/**; Persuade for / and /sign-in.
Audience and job: concept artists and producer-songwriters, in long night sessions next to a DAW, planning a coherent multi-track record and handing it off to production.
Constraints: PRODUCT.md principles (album first, coherence is the product, the artist keeps authorship, finishable, clean handoff). WCAG 2.2 AA. No invented proof.
Memorable moment: the album sequence ("the spine") stays in view on every album screen, and each track shows how it carries the record's themes.
Unresolved: real album artwork (none exists; the design must not depend on imagery).
Roll: degraded (roll service unreachable, network policy); assigned candidate 7 of 7; no challengers. Pick not built: candidate 1 (studio track sheet), whose discipline is raised into the direction below.

## Direction contract

THESIS: A record label's house identity program applied to a working tool. Every album is presented the way a label presents a release: title, sequence and credits set with typographic authority on a quiet field. It refuses the category default of gradient-glow SaaS cards.

OWN-WORLD: Warm graphite ground (not blue-black), bone-white text, and one committed signal color, saffron. Saffron marks primary actions, current location and focus, and nothing else. One grotesk family with a width axis: expanded for album titles, condensed caps for catalog lines, normal for UI. Tabular figures. Square-shouldered 4px corners, hairline rules instead of nested cards, and no gradients or glows.

STORY: The artist sees the whole record at once, finds the weak track, fixes it in place, and exports without losing the thread.

FIRST VIEWPORT (album): Left column: the spine, a numbered tracklist in large tabular figures with per-track theme and lyric status. Top: the release header, an expanded album title with a condensed catalog line (artist · N tracks · status) and one primary action. Beneath it, album tabs with a saffron underline. Raised from candidate 1 (track sheet): the spine is a grid, with a column per coherence dimension, not a list.

FORM: label identity program, position 7 of 7 on the ordered list, seed key b713dae7.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
