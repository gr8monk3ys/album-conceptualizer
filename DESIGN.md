---
name: Album Conceptualizer
description: Plan concept albums that hold together, set like a label presents a release.
colors:
  ground: "#151412"
  raised: "#1d1c19"
  sunken: "#100f0d"
  hover: "#26241f"
  selected: "#2e2b24"
  ink: "#efede7"
  ink-2: "#bdb8ad"
  ink-3: "#9b968b"
  line: "#34322d"
  line-strong: "#57534b"
  line-control: "#77726a"
  accent: "#f5c542"
  accent-hover: "#ffd666"
  accent-ink: "#1a1400"
  danger: "#ff8a7a"
  danger-soft: "#2c1b18"
  ok: "#86d6a0"
  warn: "#f39a5c"
typography:
  display-xl:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(max(1rem, min(2rem, 11cqi)), min(1.1rem + 3.9vw, 11cqi), 3.5rem)"
    fontWeight: 760
    lineHeight: 1.02
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 125"
  display-release:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(max(1rem, min(2.25rem, 13cqi)), min(1.35rem + 2.6vw, 13cqi), 3.75rem)"
    fontWeight: 760
    lineHeight: 1.02
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 125"
  display-lg:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.625rem, 0.9rem + 4.4vw, 3rem)"
    fontWeight: 760
    lineHeight: 1.02
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 125"
  display-md:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(max(1.5rem, min(1.75rem, 12cqi)), min(1.2rem + 2.4vw, 12cqi), 2.75rem)"
    fontWeight: 760
    lineHeight: 1.02
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 125"
  headline:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.333
  page-title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
  title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.556
  body-lead:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.625
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.429
  field-label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.429
  hint:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.625
  catalog:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.333
    letterSpacing: "0.06em"
    fontVariation: "'wdth' 75"
  figure-track:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
    fontFeature: "'tnum' 1"
rounded:
  sm: "4px"
  full: "9999px"
spacing:
  hair: "2px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "40px"
  target: "44px"
  gutter: "16px"
  gutter-md: "32px"
  header: "4.3125rem"
  header-offset: "4.3125rem from 31.3125em of window height (501px at default text), 0 below"
  sidebar: "min(16rem, 33vw)"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.hover}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
    height: "44px"
  button-ghost-hover:
    backgroundColor: "{colors.hover}"
    textColor: "{colors.ink}"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.danger}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
    height: "44px"
  button-danger-hover:
    backgroundColor: "{colors.danger-soft}"
  icon-button:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sm}"
    width: "44px"
    height: "44px"
  input:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "44px"
  chip:
    backgroundColor: "{colors.hover}"
    textColor: "{colors.ink-2}"
    typography: "{typography.hint}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  panel:
    backgroundColor: "{colors.raised}"
    rounded: "{rounded.sm}"
    padding: "16px"
  nav-item:
    textColor: "{colors.ink-2}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "44px"
  nav-item-active:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
  album-tab:
    textColor: "{colors.ink-2}"
    typography: "{typography.body}"
    padding: "0 12px"
    height: "44px"
  album-tab-active:
    textColor: "{colors.ink}"
    typography: "{typography.label}"
  release-title:
    textColor: "{colors.ink}"
    typography: "{typography.display-release}"
  spine-row:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    height: "44px"
  spine-row-hover:
    backgroundColor: "{colors.hover}"
---

# Design System: Album Conceptualizer

## Overview

**Creative North Star: "The Label Identity Program"**

Every album is presented the way a record label presents a release: the title set large in an expanded cut, a condensed catalog line beneath it (artist · tracks · status), and the sequence laid out as a numbered track sheet. The tool around it behaves like a label's house style applied to working screens: a quiet warm-graphite field, bone-white type, hairline rules, and one committed signal color, saffron, that appears only where the artist needs to act, where they are, or where the keyboard is.

The system is dense but calm, built for long night sessions next to a DAW. Structure comes from typography and rules, not from boxes: sections are separated by a hairline and whitespace, lists are rows divided by hairlines, and a contained surface exists only for a form or a self-contained tool. There is no imagery to lean on (albums are text blueprints), so the type has to carry authority on its own. The product rejects the category default of gradient-glow SaaS cards: no gradients, no glows, no pills, no nested cards.

Components are plain, typographic, and exact. A button is a 4px-shouldered rectangle with a verb in it; a figure is tabular; a status is a sentence.

**Key Characteristics:**
- Warm graphite ground with bone ink; every neutral carries a faint warm hue, never blue-black.
- One signal color (saffron) for the primary action, the current location, and focus. Nothing else.
- One family, Archivo, used across its width axis: expanded for titles, condensed caps for catalog lines, normal for UI.
- Tabular figures for track numbers, counts, credits and scores.
- Square-shouldered 4px corners, hairline rules, flat surfaces.
- The album's sequence (the spine) stays in view on album screens.

## Colors

A near-monochrome warm palette in which a single saffron is the only saturated voice; semantic state colors are soft and appear as text and borders, rarely as fills.

### Primary
- **Saffron** (`accent`, #f5c542): the one primary action per screen (filled button), the current location (the 2px underline of the album tab, the marker bar and icon of the current sidebar item, the active wizard step, the current track number in the Studio track list), the focus ring, text selection and the input caret. A playhead is not a location: the preview player's seek position is Bone Ink, like any other slider or meter.
- **Bright Saffron** (`accent-hover`, #ffd666): hover state of the primary button only.
- **Saffron Ink** (`accent-ink`, #1a1400): text on saffron (primary button label, skip link, selection). 11.3:1 on Saffron.

### Neutral
- **Warm Graphite Ground** (`ground`, #151412): the page field, the sticky app header, the mobile navigation sheet, sticky table heads.
- **Raised Graphite** (`raised`, #1d1c19): a Panel (one contained form or tool), chips being edited, the bottom-pinned leave prompt.
- **Sunken Graphite** (`sunken`, #100f0d): the well of every text field, select and textarea; the dialog backdrop (at 80%).
- **Hover Graphite** (`hover`, #26241f): hover and focus-within wash on rows, ghost and secondary buttons, icon buttons.
- **Selected Graphite** (`selected`, #2e2b24): the current sidebar item and the selected row of the Studio track list.
- **Bone Ink** (`ink`, #efede7): titles, body copy of primary importance, labels, current-location text. 12:1 or better on every surface.
- **Stone Ink** (`ink-2`, #bdb8ad): catalog lines, descriptions, secondary text, idle navigation, links in running copy.
- **Ash Ink** (`ink-3`, #9b968b): hints, column headings, track numbers at rest, placeholders, idle icons. 4.8:1 even on Selected Graphite.
- **Hairline** (`line`, #34322d): section rules, row dividers, the tab strip baseline, header and sidebar edges.
- **Strong Rule** (`line-strong`, #57534b): secondary button and editable chip borders, the underline of inline links, empty-state dashed border, the "not carried" dot.
- **Control Edge** (`line-control`, #77726a): the boundary of form controls, 3:1 or better against the surfaces they sit on.

### Semantic
- **Coral** (`danger`, #ff8a7a) with **Coral Wash** (`danger-soft`, #2c1b18): destructive buttons (coral text, coral border at 60%, wash on hover), errors, the sign-in error block. Every NextAuth failure returns to /sign-in (`pages.signIn` and `pages.error`); the page renders the code's plain message from `@/lib/sign-in-errors` (what happened, then the next step; never the code) on the server, in that block (`role="alert"`) above the methods, and focus moves to it on load.
- **Sage** (`ok`, #86d6a0): success text and the "Done" check.
- **Ember** (`warn`, #f39a5c): warning text and warning chips.

### Named Rules
**The One Signal Rule.** Saffron marks the primary action, the current location and focus, and nothing else: not headings, not the wordmark, not hovers, not links, not checkboxes, not chips, not sliders or meters (the player's seek position included), not decoration, never in a gradient. A screen has at most one saffron button. `Chip` has no saffron tone, so a chip can't borrow the signal.

**The Links Are Ink Rule.** Inline links are Bone or Stone Ink with a Strong Rule underline offset 4px; on hover the underline turns to ink. Form checks and radios use ink as their accent color.

**The Warm Neutral Rule.** Every neutral sits at a warm hue (about 85–92 in OKLCH) with near-zero chroma. Never substitute a cool or blue-black gray.

**The Forced Colors Rule.** In forced-colors (Windows High Contrast) mode the washes and the saffron are replaced by system colors, so every signal also has a shape the system can draw: the current sidebar row gets a Highlight outline and its bar turns Highlight; the current album tab's underline turns Highlight while idle tabs drop theirs; every button carries a 1px border (transparent by design, drawn by the system); theme marks switch to CanvasText and GrayText. Chromium doesn't force SVG colours, so every SVG mark names system colours itself (`forced-colors:stroke-[CanvasText]`, `forced-colors:fill-[CanvasText]`). The Bible's character and motif map draws only its lines in SVG; its labels and markers are HTML rows 2.75rem tall, clamped to two lines, so they grow with the reader's text and never overlap.

The printed Story bible (`server/bible-pdf.ts`) uses its own `PRINT` palette of near-black inks for white paper, not the UI tokens.

## Typography

**Display Font:** Archivo at width 125 (with ui-sans-serif, system-ui)
**Body Font:** Archivo at width 100 (with ui-sans-serif, system-ui)
**Label/Mono Font:** Archivo at width 75 for catalog lines; ui-monospace only for code

**Character:** One variable grotesk, self-hosted, stretched between 62% and 125%. The expanded cut gives album titles the weight of a sleeve; the condensed caps read like the small print on a catalog spine; the normal width does the working UI.

**Loading:** Archivo swaps in (`font-display: swap`) over local fallback faces sized to each cut (`app/font-fallbacks.css`): the display cut (stretch 125%, 760) is a quarter wider than Arial, so a single Arial-sized fallback re-wrapped every title when the font arrived. Each cut has its own face in three families, Arial and its metric twins (Helvetica, Liberation Sans), Roboto (Android) and DejaVu Sans (Linux), matched by `font-stretch` and weight, with `size-adjust` set so the average advance equals Archivo's at that cut and the ascent and descent overrides keep the baseline. Measures that must not move when the font swaps are set in em, not ch (a fallback's "0" is narrower than Archivo's tabular one): the release title's 24ch is 18.75em, the landing's 48ch and 62ch are 27.5em and 35.5em.

### Hierarchy
- **Display** (760, fluid: `display-xl` 2–3.5rem for the landing headline and the album title on a public share page, also held under 11% of a narrow container so the landing's hero column keeps "concept album" on one line; its floor steps down with the container like the release title's (2rem, never over 11% of the container, never under 1rem), so at 320px with 200% text the headline sets at 28px and "concept" stays whole instead of breaking as "conce / pt" under a 64px floor; `display-lg` 1.625–3rem for sign-in, error and not-found; `display-md` 1.75–2.75rem for a page h1 whose title is a work or a public page (Discover, an album on Discover, plans), via the page header; line-height 1.02, tracking -0.02em, balanced wrap): one h1 per page, titles only. The page header is a size container, and `display-md` never exceeds 12% of it (with a 1.5rem floor that still grows with the reader's text size), so at 320px with 200% text a title sets at 48px instead of 56px and keeps whole words; at normal text size the container never binds.
- **Page title** (`page-title`: 600, 1.5rem, 1.25, the normal cut): the h1 of the app's own screens, which name a place, not a work: Home, Library, Search, Notifications, Settings (and Album progress), Help, and Challenges and Billing. `PageHeader size="page"`. The display face is spent on titles that are the artist's (album titles) and on the landing; a screen called "Home" in a 44px expanded cut was shouting its own name.
- **Release title** (`display-release`: 760, fluid from 2.25rem on a phone to 3.75rem on a wide screen, 1.02, max 18.75em, which is 24ch of the display cut): the album title in the release header on every album screen, set with `text-display-release`. Long titles break and hyphenate rather than overflow. On the Studio the release header compacts: the title steps down to at most 1.875rem (capped at 13% of the header too, floor 1rem, so the compact size never breaks "Lighthouse" at 320px with 200% text as a flat `text-3xl` did) with the catalog line beside it on its baseline. The release header is a size container and the title stays under 13% of it, with a floor of 1rem (which scales with text): at 320px with 200% text the header is 256px wide and the title sets at 33px, so a nine- or ten-letter word ("Lighthouse") fits whole; the old 1.5rem floor held it at 48px and broke such words mid-word. From 320px at normal text size nothing changes (36px). A written sentence set in the display cut (the landing headline) is grouped into its phrases (`inline-block` spans, each balanced), because balancing a whole sentence can leave one word alone on a middle line.
- **Display, small** (760, 1.125–2.25rem): album titles in catalog rows and Discover, plan names, the example album on the landing page, the "How it works" heading.
- **Headline** (600, 1.5rem, 1.333): the current track's title in the Studio, set after its two-digit number at 1.875rem in Ash Ink.
- **Title** (600, 1.125rem, 1.556): every section h2 and list-level h3.
- **Body** (400, 0.875rem, 1.625): descriptions, row text, hints of note. Keep to 65ch on the text element itself; the landing lede and step bodies run 48–62ch.
- **Body lead** (400, 1rem, 1.625): the landing lede and empty-state titles (semibold).
- **Label** (600, 0.875rem): button text and the current nav item; field labels are 500.
- **Hint** (400, 0.75rem, 1.625, Ash Ink): field hints and small explanations. 12px is the floor for any text.
- **Catalog** (600, 0.75rem, width 75, 0.06em tracking, uppercase): the catalog line under a title, table column headings, figure labels in a definition row, the wordmark. In the sidebar and the mobile sheet the wordmark is capped at 11% of its column (`Wordmark fit`) so enlarged text wraps it between its two words, never inside "Conceptualizer", and it never sets smaller than at 100% text (14px): enlarged text can stop it growing, never shrink it. In the mobile sheet, when the header row is under 15rem, the close button keeps the top corner and the wordmark and workspace name take the full row beneath it, so neither is squeezed beside the button.
- **Figure** (tabular numerals): track numbers (zero-padded to two digits), counts, credits, bpm, coverage fractions ("1/2", "0/2", "2/2", never "½"). Track numbers run 0.875rem in the spine and 1.25rem in the Studio list, weight 600.

### Named Rules
**The One Family Rule.** Archivo is the only typeface. Hierarchy comes from the width axis, weight and size, never from a second family.

**The Catalog-Below Rule.** Condensed caps sit under a title, head a table column, or label a figure. They never float above a heading as a kicker or eyebrow.

**The Tabular Figures Stay Tabular Rule.** Any number that could line up with another number is set in tabular figures; track numbers are real data and are always two digits. Fractions are written with a slash in tabular figures ("1/2", "0/2", "2/2", "Lyrics written 3/8") everywhere, the spine and the Studio track list included: never a vulgar-fraction glyph ("½"), which sets narrower than "2/2" and breaks the column.

## Layout

The app shell is a fixed sidebar and a single content column. From 768px the sidebar is sticky at full height with a hairline right edge, its width `--sidebar-w` (`min(16rem, 33vw)`, 0 below 768px; `w-sidebar`, `left-sidebar`), which is also the left edge of anything fixed to the content column, such as the docked preview player; below 768px it becomes a modal sheet (20rem or 88vw) opened from a 44px menu button. Sidebar and sheet scroll as one column when they are taller than the window (a landscape phone, 200% text): nothing inside them shrinks, so the navigation never collapses, and the credits meter and account block sit at the bottom when there is room. While they overflow, the edge with more of the column past it fades out (`FadeScroll`, the same transparency mask as the tables, 2rem deep), so a column that scrolls says so; the scroller sits inside the sidebar so the fade leaves its hairline edge whole. The top bar is 4.3125rem tall (`--header-h`), on Warm Graphite with a hairline bottom edge, and sticky only where the window is at least 31.3125em tall (501px at the default text size; the Studio's save bar uses the same breakpoint): the breakpoint exists for text size, so it is in em, which in a media query follows the reader's default font size, and a phone at 200% text (where px breakpoints left the stuck layers covering 39–56% of the window) or held sideways gets a header that scrolls away with the page. `--header-offset` is what the header covers while it sticks (its height, or 0 on a short screen), and everything that sits below it reads that, never `--header-h`: the spine's sticky top (`top-header-offset`) and the page's scroll padding. Page scroll padding is `--sticky-offset` plus 1rem, where the Studio sets `--sticky-offset` to its measured header and save bar (each counted only while it sticks) while it is mounted and every other screen falls back to `--header-offset`; a field reached by Tab or a deep link therefore lands clear of everything sticky, and on a short screen gets no phantom header gap. This `scroll-padding-top` on `html` is the only sticky offset: no element adds a `scroll-margin` of its own, which would count the header twice. The top bar's contents are sized by the room the bar has (a size container): below 22rem (a narrow phone, or 200% text) the search field and New album collapse to 44px icon squares with their accessible names kept ("Open search", "New album") and the gaps tighten, and the bar's side padding gives way to 5vw on a narrow phone, so the menu, search and New album always fit at 320px with 200% text and New album is never pushed off the edge. Content padding is 16px, 32px from 768px, with 24px (32px) vertical padding.

Album screens share one frame: the release header (title, catalog line, the one next-step action to the right), the album tab bar, then the album body. When the body's own container is at least 56rem wide it splits into the spine (sticky under the header, scrolling on its own) and the content, 40px apart. The spine column is 22rem from 56rem, the narrowest, and widens by the number of album themes so they can be headed by name (15rem plus 3rem a theme, 1rem more for a scrollbar): from 64rem, 25rem for three themes and 28rem for four or more; from 72rem, 24rem for up to two, 31rem for five and 34rem for six, so the content keeps at least 33.5rem; with less room, from a sidebar or enlarged text, the spine folds into a "Sequence" disclosure above the content, open by default on the Overview so a phone shows the whole sequence there. Its summary ("Sequence · 10 tracks") wraps inside a narrow column, the separator ending "Sequence". The Studio replaces the spine with its editable track list, whose column widens from 16rem to 32rem as theme and position columns appear at 1280px and 1536px.

Vertical rhythm steps on a 4px grid: 8px and 12px inside groups, 16px between a heading and its content, 24px between sections (a hairline and 24px top padding), 40px between major columns. The public pages sit in a 1200px column; the landing hero splits 5:7 from 1024px. Grid tracks use `minmax(0, 1fr)`, text-holding flex children can shrink, and wide tables scroll inside their own region, so nothing scrolls the page sideways at 320px or 1440px.

### Named Rules
**The Spine Stays Rule.** On every album screen the sequence is in view or one disclosure away; it is never dropped for lack of room.

**The 44px Rule.** Every interactive element, including rows that are links and chip remove buttons, is at least 44 by 44px. Row links stretch over the whole row.

**The 65ch Rule.** Body copy, hints and descriptions carry their own max width of 65ch at their own size.

**The Whole Album on a Phone Rule.** A phone gets the whole sequence: no nested scroll box for a tracklist, 7 to 12 rows visible in the page's own scroll. Keyboard hints hide on coarse pointers (`pointer-coarse:hidden`).

**The 200% Table Rule.** Tables survive 200% text. No `table-fixed` with rem-sized columns that can starve the title: the title column keeps at least 8rem, numeric and mark columns stay narrow, and when the row still can't fit, the table scrolls sideways inside its own region instead of squeezing the title.

**The Table Scroller Rule.** Every table that may scroll sideways sits in `TableScroller` (`<TableScroller label="…">`, components/ui.tsx, a client component Server Components render like any primitive): `relative min-w-0 overflow-x-auto`, a labelled region that takes focus so the keyboard can scroll it. The `relative` is the point: screen-reader-only text inside the table is absolutely positioned, and without a positioned ancestor it escapes the scroller and widens the page. When the table is wider than the region, the region shows its scroll cue: the edge with more of the table past it fades out over 1.5rem (a transparency mask from `@/lib/edge-fade`, updated on scroll and on any resize of the region or the table), both edges when there is more on each side, none when it fits. A mask takes no space, so nothing shifts when the cue comes or goes, and the server renders no fade. While the region itself has keyboard focus the mask steps aside, because it would also clip the focus ring. When focus moves to something inside the table (a title link at the far edge), the region scrolls it fully into view and at least the fade's width (1.5rem) clear of each edge (`@/lib/scroll-clear`, plus `scroll-px-6` so the browser's own focus scrolling keeps the same margin), so a focused cell is never half under the fade; at the very start or end of the table, where there is no fade, no margin is kept. The Help page's tables (costs, plans, shortcuts) are in one too. Help reads `getAgentAvailability()` like Billing and Challenges: when AI drafts can't run, the "Get an AI draft" row's cost reads "Not available on this server right now" and Billing's line follows the table.

**The Story Beats Rule.** Until any track has a Story note, the Story bible's beats are one empty state ("0 of 9 tracks have a story note", one action "Start with 01 · Track 1" to that track's Story note, `focus=story`), never nine blank rows; after that, written beats are rows and the rest share one line of 44px track-number links ("Still without a story note: 03 · 05 · 06").

**The 320/200 Rule.** Nothing sticks out at 320px with 200% text. Every row that pairs text with a trailing action or badge lets the text keep at least 12rem or stacks the action below it (the catalog row drops its status chip and chevron under the catalog line in a container under 20rem); header actions collapse to 44px icons with their names kept; display titles step down in a narrow container instead of breaking inside words; every separator ends the item before it (a word joiner) and never starts a line; every table is in a TableScroller with its scroll cue; and nothing outside a scroller is wider than the column.

## Elevation & Depth

The system is flat. There are no shadows anywhere. Depth is told by tonal steps of the same warm graphite, from Sunken (field wells) through Ground (the page) to Raised (a panel or a pinned prompt), Hover and Selected, and by hairline rules. Overlays (the mobile navigation sheet, the leave prompt) are distinguished by a border and a Sunken backdrop at 80%, not by lift. The sticky header is opaque Ground with a hairline, never translucent or blurred.

### Named Rules
**The Flat Field Rule.** No box-shadow, glow, blur or gradient fill. If something needs to stand apart, give it a tonal step or a rule.

## Shapes

Square-shouldered. One radius, 4px, on buttons, fields, chips, panels, empty states, nav items, dialogs and focusable links. Full rounding is reserved for marks of 10px or less: the 2px current-location bar in the sidebar, the credits meter track and fill, and the small "not carried" dot in the spine. Borders are 1px hairlines; the current album tab uses a 2px saffron underline that overlaps the strip's hairline. Empty states are drawn with a dashed Strong Rule border, the only dashed line besides suggestion chips.

### Named Rules
**The Square Shoulder Rule.** Corners are 4px. Nothing a person clicks or reads inside is a pill.

## Components

### Buttons
Plain rectangles with a verb; the label says what spends credits ("Download zip · 2 credits").
- **Shape:** gently squared corners (4px), at least 44px tall, 16px side padding, 8px icon gap, 600 weight at 0.875rem, and a 1px border on every tone (transparent on primary and ghost, so forced-colors mode still draws the button's edge).
- **Primary:** Saffron fill, Saffron Ink label. One per screen. Hover brightens to Bright Saffron.
- **Secondary:** transparent with a Strong Rule border and Bone Ink label; hover lifts the border to Ash Ink and adds the Hover wash.
- **Ghost:** Stone Ink label, no border; hover adds the Hover wash and turns the label Bone Ink. Used for "Add track", "Sign in" in the public header, low-stakes toggles.
- **Danger:** transparent, Coral label and a Coral border at 60%; Coral Wash on hover. Kept apart from the primary action.
- **Disabled:** 50% opacity and a not-allowed cursor, except the primary: a disabled or aria-disabled (busy) primary takes the Raised surface, a Strong Rule border and an Ash Ink label at full opacity, never faded saffron. In forced colours every unavailable button, aria-disabled included, is GrayText. A disabled priced action drops its price (nothing can be spent, so the label is only the action) and one plain line near it says why, such as AI drafting not being available on this server. `disabled` is only for a control that is unavailable for a reason shown on screen.
- **Busy:** `<Button busy>` for a control whose own work is running (Save now, Preview, a confirm while it spends): it looks disabled (50%, not-allowed), announces itself with `aria-disabled` and `aria-busy`, ignores presses, and keeps keyboard focus, where the native `disabled` would drop focus to the page. It never wraps `onClick` when it isn't busy, so Server Components can render it.
- **Icon button:** a 44px square, Stone Ink icon, Hover wash on hover; always carries an accessible name.
- **Focus:** the global saffron ring, 2px, offset 2px. No per-component focus styles, with one exception: rows and tabs inside a scroller or a tight list (sidebar rows, album tabs) draw the ring inset (`focus-visible:-outline-offset-2`) so it is never clipped or painted over by the next row. Every element carries the ring's color before it is focused, so the ring appears at once instead of fading in from the text color under `transition-colors`. The global element styles live in the base layer, beneath the utilities, so these adjustments apply.

### Chips
- **Style:** a 4px-cornered flat tag, 0.75rem at 500, 2px by 8px padding, no border, no shadow and the default cursor. Neutral chips are Stone Ink on the Hover wash; state chips (ok, warn, danger) use the state color for text on a 10% tint of it (Coral on `danger-soft`). There is no saffron chip.
- **Chips that aren't buttons don't look like buttons.** An outline in Strong Rule is what a secondary button wears, so a static tag never has one; only interactive chips (the editable chips and suggestion chips below) carry a border, a 44px target and a hover.
- **Editable chips:** in chip-list editors each value is a 44px-tall Raised chip with its own labelled 44px remove button; suggestions are dashed-border chips with a plus.

### Cards / Containers
- **Section:** not a box. A hairline top rule, 24px top padding, the h2 with an optional description and actions, content 16px below.
- **Panel:** Raised Graphite, a Hairline border, 4px corners, 16px padding (20px from 768px). For a form or self-contained tool only; never nested, never holding cards.
- **Catalog row (album card):** a whole-row link, 12px vertical padding: the album title in the small display cut, the catalog line beneath (artist · tracks · edited), then where the page loaded it the album's progress as Home shows it ("Coherence · 3 of 8 tracks written · Unfinished" over "Written tracks 65/100 · Whole album 25/100", the One Score Story from `@/lib/score-story`, via `server/album-progress.ts`), a status chip and a chevron at the end. The row is a size container: from 20rem the chip and chevron sit at the end and the title keeps at least 12rem; below it they drop under the catalog line (chip left, chevron right) and the title has the whole width. Rows sit in a list divided by hairlines; hover adds the Hover wash. The Library and Home's Recent albums show progress.
- **Empty state:** a dashed Strong Rule border, 20px by 32px padding, a semibold title, one teaching sentence and the action that fixes it.

### Inputs / Fields
- **Style:** Sunken well, 1px Control Edge border, 4px corners, 44px tall (textarea at least 96px), 12px side padding, Ash Ink placeholder, saffron caret.
- **Hover / Focus:** hover lifts the border to Ash Ink; focus turns the border saffron and shows the global ring.
- **Labels and hints:** every field has a visible 500-weight label above it; hints in Ash Ink at 0.75rem below, replaced by a Coral error message when invalid. `Field` ties them to the control itself: it gives the element whose id is `htmlFor` its `aria-describedby` (and `aria-invalid` with an error), keeping any other ids the caller set; a control rendered by another component takes them through a render function.
- **Disabled:** 60% opacity.

### Navigation
- **Sidebar (Main):** 44px rows, 4px corners, a 16px icon and the label. Idle rows are Stone Ink with an Ash Ink icon; hover adds the Hover wash. The current row is Selected Graphite, semibold Bone Ink, with a saffron icon and a 2px saffron bar at its left edge, and carries `aria-current`. Settings and Help sit in the account block under the credits meter, as ordinary rows: Help is a place to look things up, never a saffron call to action. Labels never break inside a word: the label is never narrower than its word, and below a 10rem row the icon gap and padding tighten (the mobile sheet's padding below 12rem); a word that still can't fit takes the row under the icon, and the unread count wraps under the name.
- **Wordmark:** "Album Conceptualizer" in condensed caps, Bone Ink, with the second word in extra bold. Never saffron.
- **Album tab bar:** six text tabs (Overview, Studio, Story bible, Coherence, Sound, Export) on a hairline baseline, each named after what it opens (Sound opens the Sound bible). Overview covers the inbox too; Version history is no tab's page (its catalog-line link is marked current there). Idle tabs are Stone Ink with a transparent 2px underline that turns Strong Rule on hover; the current tab is semibold Bone Ink with a saffron underline. The six sit in one row when the album column is at least 36rem wide (rem, so enlarged text needs more room); with less, they form an even grid of equal `minmax(0,1fr)` columns, each cell on its own hairline, so the second row lines up under the first: three columns (3 + 3) from 17rem, two (2 × 3) from 11rem, one below that. The thresholds are sized to the longest name ("Coherence", 4.44rem semibold, plus 1rem of padding), so every name stays whole, and the row count depends only on the column width, never on the loaded font (no re-wrap when Archivo swaps in; the old flex rows shifted the page by 0.036 CLS). Wrapped, the strip neither scrolls nor fades, so no first letter or focus ring is masked; a name breaks between its words ("Story bible") and inside a word only if that word is wider than the whole column (`break-words`). Only the one row can overflow (an unusually wide font); then, and only while it overflows, the strip scrolls inside itself, centers the current tab with `scrollLeft` (never `scrollIntoView`, which would move the focus starting point past the skip link) and fades the edge with more tabs past it with a transparency mask.
- **Second-level nav (Sound):** Style · References · Demos as 44px text links separated by middots; the current one is semibold Bone Ink with a 2px saffron underline offset 8px.
- **Account block:** the foot of the sidebar and of the mobile sheet, one component (`AccountBlock`): the name, the plan, an "Upgrade" link to billing while on the free plan, then Settings, Help and Sign out.
- **Mobile:** the sidebar's contents move into a modal sheet with the same rows, credits meter and account block (Upgrade included). The sheet opens with focus on its Close button ("Close navigation menu", `autoFocus` and an explicit focus after `showModal()`), never on the scrolling column, which at 320px with 200% text overflows and is itself focusable but has no name.

### Release Header (signature)
The top of every album screen: the album title in the expanded cut (`display-release`, 2.25rem on a phone to 3.75rem wide, max 18.75em, about 24 characters), and beneath it the catalog line in condensed caps, Stone Ink, joined by middots (`CatalogItems`: each separator ends the item before it, held to its last word by a word joiner, so a wrapped line never starts with a dot): artist, track count in tabular figures, status, "On Discover", remix source when there is one, when it was edited, and "Version history". The next step for the album sits bottom-right as a button, weighted by the One Next Step Rule below. It is left out on the screen it points to, in the Studio (which has its own track list), and while the Overview's welcome banner carries the same action.
- **Version history link:** the last item of the catalog line, a quiet link (catalog caps, Stone Ink, Strong Rule underline turning ink on hover) to `/versions`, so Versions is one step from every album tab, not only the Overview. On the Version history page it is the current location: `aria-current="page"`, Bone Ink with a saffron underline (`AlbumCatalogLink`), and no album tab is current. The page names itself with an h2 "Version history" above its "Save a version" and "Saved versions" sections.
- **Remix provenance link:** "Remix of <title> by <artist>" names the original's artist on every remix, from `remixed_from` in the snapshot (`{ album_id, title, artist }`, written by Remix; `server/remix-source.ts`). It links to the original's Discover page only while that album is still published (a share-link remix can point at a private album); otherwise, and on older remixes without an album id, it is plain text.
- **Targets in the line:** both links keep the line one line of small caps: each is set as a block of the line's own height (16px), and its target is an invisible box stretched 16px above and below it (`after:`), 48px in all (stretched 14px from an inline box, "Version history" measured 42px); the focus ring hugs the text.
- **Heading level:** the release title is the page's h1 on every album page (`ReleaseTitle`). Under an address the album has no page for, the not-found heading below is the h1 ("This album has no page called “mix”") and the title is set identically as a paragraph, so the page still has exactly one h1 and it says what the page is.

### The Spine (signature)
The album's sequence as a track sheet: columns for the two-digit track number (tabular, Ash Ink, 600), the title (a link stretched over the whole 44px row, clamped to two lines, never narrower than 8rem), lyrics written as a tabular fraction ("1/2", "0/2", "2/2", "—"; never a "½" glyph), the album themes (up to six) and whether the track has a role in the arc (a check, or a dot). The themes share one column. **Names, not codes:** wherever the spine's own container has room, each theme gets a 3rem slot headed by its whole name in catalog caps, on two lines when one won't hold it (broken at a space, or hyphenated at a syllable: "ISOLA-/TION"; `themeHeadLines` / `ThemeHeadName`), with the full name on hover (`title`) and in the head's accessible name. Only a name two lines can't hold truncates, and then the legend under the table stays visible in name mode too, listing every theme in full ("Album themes: memory, signal, tide"). The room is 15rem (number, 8rem title, Lyrics, Role) plus 3rem a theme, in rem so enlarged text needs more (`themeHeadClasses` in `@/lib/theme-keys`, `@min-[18rem]` for one theme to `@min-[33rem]` for six), and the side column widens with the theme count to give it (see Layout), so a laptop's side column heads up to four themes by name and the Sequence disclosure all six. Only the narrowest layouts (the 22rem side column with three or more themes, a phone) fall back to short horizontal keys, 1rem a key (the shortest unique initial, "M", "ME", or a letter and position when two themes still clash), each with the full name on hover, and a legend under the table spells every key out; the table names the legend as its description (`aria-describedby`). Each row shows one mark per theme beneath its head. A track that carries a theme shows a solid 10px Bone Ink square; a track that doesn't shows a small Strong Rule dot (`ThemeMark`, the one mark for every theme matrix). The table sizes itself to its content (never `table-fixed`) and scrolls sideways inside its own `TableScroller`, with its edge fade, when enlarged text leaves no room; the number, lyrics, key and role columns are narrow enough that three keyed themes and the 8rem title fit a 320px phone's 288px column at normal size. Column heads are catalog caps in Ash Ink over a hairline; rows are divided by hairlines and take the Hover wash on hover or keyboard focus. A screen reader hears each row once: the title, the lyrics fraction in words, one phrase for the themes ("Carries memory and signal", "Carries none of the album themes") and the role; the marks and keys are hidden from it. In the Studio the same sheet becomes the editable track list: the selected row is Selected Graphite and its number turns saffron; the matrix heads show whole theme names the same way (two lines when needed), while each theme cell stays a toggle showing the theme's key letter (not a ThemeMark): pressed, a filled Bone Ink square with the letter in Ground; unpressed, the letter in Ash Ink; in forced colors CanvasText with Canvas lettering when pressed and GrayText when not. Below the matrix layout (a phone, a narrow column) each track row names the themes it carries under its title instead of collapsing to a count, and the current track has a row of theme toggle chips. The spine and the landing example keep ThemeMark.

### Credits Meter
The workspace balance in the sidebar: "Credits" in Stone Ink with the figure in tabular Bone Ink over "/ total" in Ash Ink, a 4px-tall fully rounded meter (Stone Ink fill on a Hairline track, never saffron; in forced colors the track is a CanvasText outline and the fill CanvasText), and a 44px link to daily challenges ("Earn more with daily challenges"). No price list: what an action costs is on its own button and in Help, so the sidebar doesn't repeat a cost sentence on every screen.

### Confirm Spend
Every action that spends credits goes through `ConfirmSpend` (components/confirm-spend.tsx). The trigger is an ordinary button whose label carries the price ("Remix · 5 credits"), in the tone its screen calls for. Pressing it swaps the trigger in place for one line, "Remix for 5 credits? You'll have 40 left.", with a primary confirm and a Cancel; Escape cancels and focus returns to the trigger. The trigger is a disclosure, not a menu: `aria-expanded="false"` and `aria-controls` naming the group it opens, never `aria-haspopup`. While the spend runs the confirm reads "Working…" and is busy (`Button busy`), so it keeps focus and a second press can't spend twice; when it is done on a screen that stays, the line closes and focus returns to the trigger after the close has committed (`useReturnFocus`, which also survives the route refresh a spend makes; the trigger is itself busy, not disabled, while the page finishes); a spend that navigates away leaves nothing to return to. No other confirm dialog, and never a spend on a single tap. When the balance can't cover it, the confirm says so ("Remix costs 5 credits and you have 3 credits.") and its confirm button stays disabled.

### Live Status and Focus Return
- **LiveStatus** (components/ui.tsx): `<LiveStatus message={status?.text ?? null} tone={status?.tone} />`, the one status line for the result of an action: an always-mounted polite live region, rendered unconditionally, that the message is put into, because many screen readers say nothing for a region that appears with its text already in it. Errors go in as an alert inside it. While empty it is out of the flow (`empty:absolute`, zero size), so an idle region adds no gap to the flex it sits in. Every status that appears after an action uses it (share link, publish, versions, export, tagging, delete); `StatusMessage` stays only for text that is part of the page from the start. An arrival line (the Overview's "Restored …") uses `ArrivalStatus`, which mounts the region empty and fills it a beat later so it is announced.
- **useReturnFocus** (components/use-return-focus.ts, `@/lib/focus-hold`): call it in the same update that closes a confirm or swaps a trigger, with where focus belongs (`returnFocus(() => triggerRef.current)`). After React commits that update, in a layout effect, focus goes there if it was dropped to the page body, and for three seconds more it goes back there whenever it drops again, so a `router.refresh()` that replaces the element a moment later doesn't lose it; it never takes focus from something the person moved to, and it stops at the first pointer press. Where the trigger is replaced, focus goes to what replaced it: Create share link hands it to Copy link, Revoke back to Create share link, a closed Publish confirm to Unpublish, the tag review to Tag from lyrics. Confirm Spend, Publish, Share, Tag from lyrics (and its Undo), Restore's Cancel and Delete's Cancel all use it; nothing uses `requestAnimationFrame` before a refresh for focus any more.

### Coherence report
**The One Score Story Rule.** Every surface that shows an album's coherence (the Coherence report, the Overview's Coherence row, Discover's detail page, Library and Home rows, the handoff pack) tells it in the same order and words, from one formatter (`@/lib/score-story` `scoreStory()`). While any track is unwritten the headline is progress, not a verdict: "4 of 8 tracks written · Unfinished" in neutral ink; then two figures of equal size in a fixed order, "Written tracks 72/100 · Whole album 45/100" (`CoherenceReport.writtenScore` is the same weighting over each dimension's uncapped score); then, on the report, the cap explained ("The whole album's score is capped for now: no dimension counts above 50 until the other 4 tracks have lyrics"). No surface leads with one figure while another leads with the other. Once every track is written: the verdict, then one score. "Unfinished" is neutral ink, not Ember. Findings that are work not done yet (`CoherenceIssue.progress`: unwritten lyrics, chords, keys, story notes, themes, motifs, a concept summary, thin structure) wear a neutral chip: "Start here" on the unwritten tracks, pinned first, and "To do" on the rest; "Fix first" (Coral) and "Warning" (Ember) are kept for real contradictions such as duplicate track numbers, theme drift or motifs that never return. In "By dimension", a lever several dimensions share (the lyric cap's "Write lyrics on N more tracks…") is said once above the list, naming the dimensions it lifts (`@/lib/shared-lever`); those rows keep only their own signal and what the written tracks score alone. "How this is scored" ends with a link to Help's "What counts as written". The Overview's Coherence row reads the same way ("3 of 7 tracks written · Unfinished" over "Written tracks 72/100 · Whole album 40/100").

### Export
The zip's confirmation ends on the next step of the work, then the balance: "Zip downloaded — open the MIDI files in your DAW (one per track, at each track's tempo). 43 credits left." (for a zip without MIDI it names the next tool for what it holds: MusicXML, ChordPro, JSON). Both the handoff and the zip status lines are LiveStatus regions.

### Tag from lyrics
The Story bible's "Tag from lyrics" proposes; the artist ticks and adds. After "Add N tags" the status names what was added ("Added tide to 04, signal and static to 05.") and an Undo sits beside it for at least 10 seconds, timed by the Studio's `useUndoWindow`: the clock stops while the Undo has focus or the pointer, a full window starts again when both leave, and if it lapses with focus on it, focus goes to "Tag from lyrics" and the line adds "Undo has ended; the tags stay." Undo takes off exactly the tags that apply added (`removeAddedTags`, `POST /api/albums/<id>/autotag/undo`), never tags added by hand since, and says so ("Undone: took tide off 04."). Proposed phrases keep the lyric's word order: a phrase never spans punctuation, and a tie is spelt the way the lyrics say it first ("last ferry", never "ferry last").

### Studio (round 6)
The track's heading is its title, edited in place (`TrackTitle`, `id="song-title"`, named "Track title"): the number in Ash Ink, then the title in the Headline size, wrapping like a heading (its height follows its text; line breaks become spaces), a Control Rule hairline under it and the focus ring while it is edited; the heading keeps one name ("Track 01: Storm Warning"). Under it only when needed: the empty-title error in Coral, or Stone Ink guidance when another track has the same title, trimmed and in any casing ("Track 03 is also called this.": a reprise can be deliberate, so it is said, not flagged). A visible row for Role and Story note follows (Role's hint defines it: the track's place in the arc). Key and Tempo sit in "Track details" after Sections; the editable heading adds no height, so the lyrics editor still reaches the first screen on a laptop (1440×900 and 1280×800). A track moves one place from More (Move track up / down; Ctrl+Alt+Shift+PageUp/PageDown anywhere, or with ↑/↓ outside text fields; in the save-bar hints from 85rem and on Help) or any distance in one step (Move to position…: an inline form under the track header like the delete question, a select of every place such as "05 · now “Signal”", Move and Cancel; focus on the select, and Escape, Cancel or Move return it to More). Every move is announced and shown with Undo ("Moved “Track 1” (now “Track 2”) from 01 to 02."); moves of one track in a row share one Undo, which puts it back where the run started with every default name as it was (`moveTrackTo`, `undoTrackMove`). Undoing a delete says so ("Put back “Track 3”.", "Put back Verse 2."). Beside the editor, the track list's scroller has a scroll-padding-top equal to its sticky column heads, so a row reached by Tab or Shift+Tab lands clear of them. The save bar holds Write next (the primary, below 48em only; from 48em it sits in the editor), Help, "Save version…" (an inline form) and Save now, as one group that never wraps apart; below 48em they show short names ("Help", "Version", "Save", accessible names unchanged), Write next takes its own full-width row after the group so the bar holds two rows, Help gives way on a touch phone (it stays in the app navigation), and below 22em they become 44px icons with their names kept; it sticks only when the window is at least 31.3125em tall and the header, the bar and the docked preview player together take less than 35% of it. Arriving at the lyrics ("Write track N", Write next) brings the track header just under the save bar with the lyrics below it when both fit, otherwise the lyrics alone; the page's scroll padding places it, never a second offset. Below 42rem "Skip to the lyrics" is a visible ink link at the top of the Studio; from 42rem it is the focus-only skip chip. Track details stacks Key and Tempo below a 14.5rem container, so the select always shows its whole key, and the track's catalog line uses CatalogItems (a separator never starts a line). The track list, story editor, album details, AI draft panel and comments are memoized with stable handlers (`useStableEvent`), so a keystroke re-renders only the editor. Undo, and Retry after a failed save, lie over the save status in a column that is always at least 44px tall, so the bar never reflows when one appears or lapses. The Studio's Undo pauses while it has focus or the pointer and, if it lapses with focus on it, moves focus to the affected row and says so. The starter-loop hint under a fresh section is Ash Ink guidance, not Ember. Below a 42rem container (the single-column layout) the Tracks list folds into a disclosure ("Tracks · 04 of 10 · Track 4", closed at first, remembered for the session), so the current track's editor comes straight after the header. A track whose title is still its default ("Track 5") is renamed when its position changes, so a number and its name always agree; written titles are never touched. Deleting a track or section that holds written lyrics asks first, inline ("Delete Track 1 and its 2 written sections?"; focus on Delete, Escape or Cancel back to More), and keeps its Undo after; an empty or starter-only one deletes at once with Undo. Add section moves focus to the new section's lyrics and announces it ("Verse 2 added, section 3 of 3"). The docked player announces only what it changes itself (an instrument notice, instrument loading), into one LiveStatus that `playerbar.tsx` mounts with the Studio page, empty, before the bar docks. The bar's visible status line is plain text, and a preview's loading and result are announced by the Studio's own preview status line, not twice.

### Help
One short, task-based page at `/app/help`, linked from the account block of the sidebar and the mobile sheet and from Settings: the path from idea to handoff, what credits pay for (the AI line reads "Get an AI draft") and what each plan grants (read from the same constants the buttons use), what counts as written (placeholder lyrics and the starter chord loop don't), and the Studio's keyboard shortcuts set in `kbd` keys. It opens with a jump list under the page title (`<nav aria-label="On this page">`, the section names as 44px text links separated by middots, each to its section's h2, e.g. `#written-title`), so a question asked elsewhere lands on its answer: the Coherence report's "How this is scored" links to `/app/help#written-title`. Plain Sections and hairline tables, each in a TableScroller, no cards; a link that stands on its own line ("Compare plans and manage billing", "What counts as written, in Help") is a 44px target.

### Not found and page titles
Every tab title ends in the product name, added by the root layout's template: "<page> · Album Conceptualizer", and on album screens "<page> · <album> · Album Conceptualizer", where each album page titles itself "Coherence · <album>" with `albumPageTitle` (server/page-titles.ts) and the Overview with the album alone. No layout below the root sets a title template (templates don't combine, and one would repeat the album). A shared album's page is titled with the album. Not-found screens are titled "Page not found", and the title survives hydration: the tab takes its title from the metadata of the address that was asked for, so each `[...missing]` page (which only calls notFound()) exports `metadata = { title: "Page not found" }`, the page-title helpers (`workspaceAlbumTitle`, `publishedAlbumTitle`) and the share page's metadata call notFound() for a missing album or link instead of returning a fallback title, and every not-found screen also renders its title (`PageNotFoundTitle`, a React 19 `<title>`). They offer one primary way back plus, where it helps, one different way on, never two routes to the same place: in the app, "Go to Home" and "Search your workspace"; outside it, "Go to your albums" and "Go to the front page". An address inside an album that isn't one of its pages stays under the album's release header and tabs and says so, in the page's h1 ("This album has no page called “mix”", the release title stepping down to a paragraph there), with "Go to the album's Overview"; only a missing album gets the app-wide screen. `/app/albums/<id>/sound`, the Sound tab's own name, opens the Sound bible (`/style`).

### Named Rules
**The Honest Signal Rule.** A tick, a score, a fraction or a status never claims work that wasn't done. Placeholder lyrics and the starter chord loop count as not written everywhere they are counted; `@/lib/lyrics` and `@/lib/chords` are the only definitions.

**The One Term Rule.** One word per concept on every surface (labels, headings, fix links, spine heads, search, page titles): "Story note" for a track's narrative summary, "Role" for its place in the arc, "Motifs" for album motifs plus track motif tags, read from the same source on the Story bible and the Coherence report; "Story bible" for what the album is about (its tab, heading and page title; never "Album Bible" or a bare "Bible", since there are two) and "Sound bible" for how it sounds (never "Style bible", "Voice / style bible" or "Voice and style"), each linking to the other in its heading row ("How it sounds → Sound bible", "What it's about → Story bible"); "Discover" for the public feed, its h1 included (never "Community albums"); "References". Sound bible completeness reads "3 of 9 fields set" everywhere (the Sound bible form, the Overview row, the readiness and publish list, the Story bible summary), from `@/lib/sound-bible-progress` `soundBibleFieldsSet()`; never "sections" (a Section is part of a song) or "parts". CONTEXT.md holds the glossary.

**The One Save Model Rule.** A surface that saves as you work has no primary Save button; it shows its status ("Saved · just now", "Saving…", "Unsaved changes — Retry"). A manual save kept for Ctrl/⌘+S is a quiet ghost button. The saffron on a screen is the next step of the work, never saving.

**The Deliberate Spend Rule.** Credits are spent only after one confirm that names the cost and the balance after (Confirm Spend), or with an Undo that stays at least 10 seconds.

**The Writing Path Rule.** Destructive controls live away from the writing path: ghost or danger-text buttons in a "More" menu or at the end of a row, never directly above or below a text field.

**The One Phrase Rule.** A row of marks is read as one phrase, not one announcement per cell: the spine says "Carries memory and signal" once per track instead of a "doesn't carry" for every theme.

**The Album Frame On A Phone.** The catalog line's status reads "On Discover" for an album on Discover (never "Published · On Discover"), and the edited time is left out below a 30rem header. The frame's first stop is a skip link named for the page ("Skip to the Coherence report"), landing on `#album-page`: a visible ink link above the title below a 42rem header, the focus-only chip from 42rem, and absent on the Studio (which has "Skip to the lyrics"). Below 42rem the header's gaps tighten; under a 12rem header the release title's size and floor are both 12cqi, so a twelve-letter word stays whole. Library and Home chips say "On Discover" too. A remix notification links to the remix on Discover while it is published (the notification records `remixAlbumId`), otherwise to the owner's album with a line saying why; notification titles carry the Strong Rule underline at rest. On Coherence, while any track is unwritten, one neutral line under the scores says low early numbers are progress, not a fault, and links to Help's "What counts as written".

**The One Next Step Rule.** The release header's next step is the album screen's saffron primary, unless the screen's own content shows a primary action (Export's download, a Sound form, an open confirm); then it steps back to secondary, so every album screen has exactly one saffron button. `AlbumNextAction` applies the rule by watching the content column for a primary; screens don't opt in or out.

**The One Primary Per State Rule.** Every state of a screen has at most one saffron button, and a screen that moves the work forward has exactly one: including first arrival on a new album (`?welcome=1`, where the welcome banner carries it), any state in which the header's next step steps back, an open confirm, and empty states. Reference screens (Help, Settings) may have none.

**The Review Before Write Rule.** Nothing writes on the artist's behalf without review or undo. An action that changes the album's content in bulk (tagging from lyrics, AI output, imports) either shows proposals the artist accepts, as dashed suggestion marks with Accept all and per-item accept, or applies at once with an Undo that stays at least 10 seconds and names what changed ("Added 3 tags on tracks 04, 05, 07 · Undo").

**The Status In Place Rule.** When an action changes something shown elsewhere on the screen (the release header's catalog line, the spine, a meter), that place updates without a reload: the client refreshes the route (`router.refresh()`) once the change has saved.

**The Say What Changed Rule.** A confirmation names the specific change ("Added tide to 04", "Published to Discover."), never a bare "Done", and any clamping or normalising of input is said out loud ("Tempo is capped at 300").

**The Checked Where Typed Rule.** Musical input (chords, key, tempo) is checked as it is typed: the offending token is named inline in Coral, beside the field, and invalid input never counts as written (`@/lib/chords` `parseProgression`, `invalidChords`). One tempo range everywhere: a track's tempo and a reference's BPM are both 20–300 bpm (`@/lib/tempo`); a reference BPM is a whole number, checked as typed, and a value still below the range is flagged when the field is left.

**The Quiet Autosave Rule.** Autosave progress ("Unsaved changes", "Saving…", "Saved · just now") is shown but never announced, in the Studio and the Sound bible alike; only an explicit Save now's result and errors are announced, once. A busy control is `Button busy` (aria-disabled), never `disabled`, so focus stays on it. A row action whose row leaves the list (Inbox Resolve, Mark done) sends focus to the next row's same action, else the previous one's, else the list heading, and announces through a region outside the row. Restore's confirm takes focus when it opens and Cancel or Escape returns it to Restore. A restore keeps the replaced draft as a version named after the restored one, never nested ("Before restoring Before restoring …"); an unnamed or auto-saved version is named by its save time.

**The Explain Where It Bites Rule.** When the product discounts or rejects something the artist typed (a starter chord loop, an unreadable chord, placeholder lyrics), the explanation sits at the field, where it happens, in one plain line; Help may repeat it but is never the only place it is said.

**The Arrivals Say Where You Are Rule.** After a remix, a create or a restore, the screen you land on says what just happened in one line, in its status area ("Remixed into your workspace · 45 credits left"), so the arrival is never a silent page swap.

**The Busy Keeps Focus Rule.** A control busy with its own work stays focusable (`Button busy`: aria-disabled, aria-busy, presses ignored) instead of `disabled`, and when an action finishes on a screen that stays, focus returns to what started it (Confirm Spend returns it to its trigger). Focus never drops to the page body.

**The Focus Comes Back Rule.** After any action that re-renders the route (`router.refresh()`) or replaces its trigger, focus lands on a sensible element after the commit: the trigger, or what replaced it (`useReturnFocus`), never the page body. It is done in a layout effect after the state change commits, not in a `requestAnimationFrame` before a refresh, and it never takes focus from where the person has moved it.

**The Mounted Empty Rule.** A status that appears after an action goes into a live region that was already in the page, empty (`LiveStatus`, rendered unconditionally); a region that mounts with its text already inside is often never announced.

**The Timed Things Wait Rule.** An Undo or any transient offer stays at least 10 seconds, pauses while it has focus or hover, and starts a full window again when both leave; if it lapses with focus inside, focus moves to the affected item and the lapse is said in the status line.

**The Em Breakpoint Rule.** A breakpoint that exists for text size is in em (in a media query, em is the reader's default font size): the sticky header and the Studio's save bar stick from `min-height: 31.3125em` (501px at the default size), not 501px, so enlarged text needs a taller window before anything sticks. Container queries that choose a layout by room are in rem for the same reason.

**The Names, Not Codes Rule.** A theme is shown by its name (catalog caps, whole, on two lines when one won't hold it; only a name two lines can't hold truncates, with the full name on hover, in the accessible name and in a visible legend) wherever there is room; single-letter keys, with a legend the table names as its description, only in the narrowest layouts.

**The Still Motion Rule.** When the reader prefers reduced motion, decorative movement stops: chevron rotations take `motion-reduce:transition-none`, spinners `motion-reduce:animate-none` (the words beside a spinner already say it's working), and smooth scrolling becomes instant. Colour transitions stay.

**The Warn For Problems Rule.** Ember and Coral are for things that are actually wrong: a contradiction, an error, a balance that can't cover a spend. Ordinary guidance (an unwritten track, a starter loop, "not written yet", "Unfinished") is Stone or Ash Ink, and its chip is neutral ("Start here", "To do").

**The Progress First Rule.** While an album is partly written, a score leads with the progress and what the written tracks score on their own; the capped whole-album score comes second, never as the headline.

**The Next Step Ends It Rule.** A confirmation of finished work ends on what to do next with it (open the MIDI in a DAW), and only then on the balance.

**The One Term for AI Rule.** The AI action and its cost have one name everywhere: "AI draft" ("AI draft · 5 credits", "New AI draft", "AI drafts" in plural). Never "AI run", "agent workflow" or "brainstorm" as the name of the spend; the ideation feature may say it brainstorms ideas, but its cost line says "AI draft". Likewise lyrics are "written", never "started" ("Lyrics written 3/8").

## Do's and Don'ts

### Do:
- **Do** use the shared primitives (Button, ButtonLink, IconButton, PageHeader, Section, Panel, Field, Chip, StatusMessage, LiveStatus, EmptyState, TableScroller) instead of restyling raw elements.
- **Do** keep exactly one h1 per page: the release title on album screens, the page header title elsewhere.
- **Do** put the catalog line under the title in condensed caps, joined by middots, with counts in tabular figures and correct plurals ("1 track", "3 tracks").
- **Do** separate content with hairlines (`line`) and whitespace; list rows are divided by hairlines.
- **Do** mark the current location with saffron plus a second cue (weight, underline, bar, `aria-current`).
- **Do** keep every interactive element at least 44 by 44px and let the global saffron focus ring show (2px, offset 2px).
- **Do** use a transparency mask, not a color, when an overflowing strip needs an edge fade.
- **Do** say what spends credits on the button itself, confirm it once with Confirm Spend, and disable priced AI actions with a plain reason when AI can't run (the disabled button drops its price).
- **Do** give a mark that relies on a wash or saffron a forced-colors equivalent (Highlight, CanvasText, a border).
- **Do** put every table that may scroll sideways in `TableScroller` (it brings its own edge fade), and line anything fixed to the content column up with `--sidebar-w`.
- **Do** check every screen at 320px with 200% text: rows stack their trailing action below the text, header actions become icons, catalog separators end the item before them (a line never starts with a dot).
- **Do** use `Button busy` for a control busy with its own work, and return focus to the trigger (or what replaced it) with `useReturnFocus` when an action finishes on a screen that stays.
- **Do** render every after-action status as a `LiveStatus`, unconditionally, and pass it `null` when there is nothing to say.
- **Do** use `PageHeader size="page"` for the app's own screens and keep the display cut for album titles, public album pages and the landing.
- **Do** write height breakpoints meant for enlarged text in em (`[@media(min-height:31.3125em)]`).

### Don't:
- **Don't** use saffron for headings, the wordmark, links, hovers, badges, checkboxes, meters or decoration, and never more than one saffron button on a screen.
- **Don't** use gradient fills, glows, box-shadows, radial backgrounds or backdrop blur.
- **Don't** use pill shapes or large radii for buttons or containers; corners are 4px, full rounding only for marks of 10px or less.
- **Don't** nest a Panel in a Panel or put cards inside a Panel; don't turn dashboard figures into stat-tile cards.
- **Don't** set a kicker or eyebrow above a heading, or number sections 01/02/03 for decoration (track numbers are data and are fine).
- **Don't** introduce hex or rgba literals or a second typeface; use the tokens and the Archivo width axis.
- **Don't** set any text below 12px or run body copy wider than 65ch.
- **Don't** add per-element focus rings or remove outlines; insetting the global ring inside a scroller is the only adjustment.
- **Don't** use `table-fixed` with rem columns, rotate column heads, or read a matrix out one cell at a time.
- **Don't** add a `scroll-margin` for the sticky header: `html`'s scroll padding already clears it, and a second offset doubles it. Anything that sits below the header reads `--header-offset`, not `--header-h`.
- **Don't** write a vulgar-fraction glyph ("½") for progress; fractions are "1/2" in tabular figures.
- **Don't** put `disabled` on a control that is only busy; it drops keyboard focus.
- **Don't** mount a status region with its message already in it (`{status ? <StatusMessage/> : null}` after an action), or move focus in a `requestAnimationFrame` before a refresh.
- **Don't** colour ordinary progress (unwritten tracks, "Unfinished", a starter loop) in Ember or Coral, or head a theme column with a letter where its name fits.
