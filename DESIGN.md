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
    fontSize: "clamp(2rem, 1.1rem + 3.9vw, 3.5rem)"
    fontWeight: 760
    lineHeight: 1.02
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 125"
  display-release:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 1.35rem + 2.6vw, 3.75rem)"
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
    fontSize: "clamp(1.75rem, 1.2rem + 2.4vw, 2.75rem)"
    fontWeight: 760
    lineHeight: 1.02
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 125"
  headline:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.333
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
- **Saffron** (`accent`, #f5c542): the one primary action per screen (filled button), the current location (the 2px underline of the album tab, the marker bar and icon of the current sidebar item, the active wizard step, the current track number in the Studio track list), the focus ring, text selection and the input caret.
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
- **Strong Rule** (`line-strong`, #57534b): secondary button and chip borders, the underline of inline links, empty-state dashed border, the "not carried" dot.
- **Control Edge** (`line-control`, #77726a): the boundary of form controls, 3:1 or better against the surfaces they sit on.

### Semantic
- **Coral** (`danger`, #ff8a7a) with **Coral Wash** (`danger-soft`, #2c1b18): destructive buttons (coral text, coral border at 60%, wash on hover), errors, the sign-in error block.
- **Sage** (`ok`, #86d6a0): success text and the "Done" check.
- **Ember** (`warn`, #f39a5c): warning text and warning chips.

### Named Rules
**The One Signal Rule.** Saffron marks the primary action, the current location and focus, and nothing else: not headings, not the wordmark, not hovers, not links, not checkboxes, not decoration, never in a gradient. A screen has at most one saffron button.

**The Links Are Ink Rule.** Inline links are Bone or Stone Ink with a Strong Rule underline offset 4px; on hover the underline turns to ink. Form checks and radios use ink as their accent color.

**The Warm Neutral Rule.** Every neutral sits at a warm hue (about 85–92 in OKLCH) with near-zero chroma. Never substitute a cool or blue-black gray.

**The Forced Colors Rule.** In forced-colors (Windows High Contrast) mode the washes and the saffron are replaced by system colors, so every signal also has a shape the system can draw: the current sidebar row gets a Highlight outline and its bar turns Highlight; the current album tab's underline turns Highlight while idle tabs drop theirs; every button carries a 1px border (transparent by design, drawn by the system); theme marks switch to CanvasText and GrayText.

## Typography

**Display Font:** Archivo at width 125 (with ui-sans-serif, system-ui)
**Body Font:** Archivo at width 100 (with ui-sans-serif, system-ui)
**Label/Mono Font:** Archivo at width 75 for catalog lines; ui-monospace only for code

**Character:** One variable grotesk, self-hosted, stretched between 62% and 125%. The expanded cut gives album titles the weight of a sleeve; the condensed caps read like the small print on a catalog spine; the normal width does the working UI.

### Hierarchy
- **Display** (760, fluid: `display-xl` 2–3.5rem for the landing headline and the album title on a public share page; `display-lg` 1.625–3rem for sign-in, error and not-found; `display-md` 1.75–2.75rem for every page h1 via the page header; line-height 1.02, tracking -0.02em, balanced wrap): one h1 per page, titles only.
- **Release title** (`display-release`: 760, fluid from 2.25rem on a phone to 3.75rem on a wide screen, 1.02, max 24ch): the album title in the release header on every album screen, set with `text-display-release`. Long titles break and hyphenate rather than overflow.
- **Display, small** (760, 1.125–2.25rem): album titles in catalog rows and Discover, plan names, the example album on the landing page, the "How it works" heading.
- **Headline** (600, 1.5rem, 1.333): the current track's title in the Studio, set after its two-digit number at 1.875rem in Ash Ink.
- **Title** (600, 1.125rem, 1.556): every section h2 and list-level h3.
- **Body** (400, 0.875rem, 1.625): descriptions, row text, hints of note. Keep to 65ch on the text element itself; the landing lede and step bodies run 48–62ch.
- **Body lead** (400, 1rem, 1.625): the landing lede and empty-state titles (semibold).
- **Label** (600, 0.875rem): button text and the current nav item; field labels are 500.
- **Hint** (400, 0.75rem, 1.625, Ash Ink): field hints and small explanations. 12px is the floor for any text.
- **Catalog** (600, 0.75rem, width 75, 0.06em tracking, uppercase): the catalog line under a title, table column headings, figure labels in a definition row, the wordmark.
- **Figure** (tabular numerals): track numbers (zero-padded to two digits), counts, credits, bpm, coverage fractions. Track numbers run 0.875rem in the spine and 1.25rem in the Studio list, weight 600.

### Named Rules
**The One Family Rule.** Archivo is the only typeface. Hierarchy comes from the width axis, weight and size, never from a second family.

**The Catalog-Below Rule.** Condensed caps sit under a title, head a table column, or label a figure. They never float above a heading as a kicker or eyebrow.

**The Tabular Figures Rule.** Any number that could line up with another number is set in tabular figures; track numbers are real data and are always two digits.

## Layout

The app shell is a fixed sidebar and a single content column. From 768px the sidebar (16rem, capped at 33vw) is sticky at full height with a hairline right edge; below 768px it becomes a modal sheet (20rem or 88vw) opened from a 44px menu button. Sidebar and sheet scroll as one column when they are taller than the window (a landscape phone, 200% text): nothing inside them shrinks, so the navigation never collapses, and the credits meter and account block sit at the bottom when there is room. The top bar is sticky, 4.3125rem tall (`--header-h`), on Warm Graphite with a hairline bottom edge. Page scroll padding is `--sticky-offset` plus 1rem, where the Studio sets `--sticky-offset` to its measured header and save bar while it is mounted and every other screen falls back to the header height; a field reached by Tab or a deep link therefore lands clear of everything sticky. Content padding is 16px, 32px from 768px, with 24px (32px) vertical padding.

Album screens share one frame: the release header (title, catalog line, the one next-step action to the right), the album tab bar, then the album body. When the body's own container is at least 56rem wide it splits into the spine (up to 21rem, 24rem once the container reaches 72rem; sticky under the header, scrolling on its own) and the content, 40px apart; with less room, from a sidebar or enlarged text, the spine folds into a "Sequence" disclosure above the content, open by default on the Overview so a phone shows the whole sequence there. The Studio replaces the spine with its editable track list, whose column widens from 16rem to 32rem as theme and position columns appear at 1280px and 1536px.

Vertical rhythm steps on a 4px grid: 8px and 12px inside groups, 16px between a heading and its content, 24px between sections (a hairline and 24px top padding), 40px between major columns. The public pages sit in a 1200px column; the landing hero splits 5:7 from 1024px. Grid tracks use `minmax(0, 1fr)`, text-holding flex children can shrink, and wide tables scroll inside their own region, so nothing scrolls the page sideways at 320px or 1440px.

### Named Rules
**The Spine Stays Rule.** On every album screen the sequence is in view or one disclosure away; it is never dropped for lack of room.

**The 44px Rule.** Every interactive element, including rows that are links and chip remove buttons, is at least 44 by 44px. Row links stretch over the whole row.

**The 65ch Rule.** Body copy, hints and descriptions carry their own max width of 65ch at their own size.

**The Whole Album on a Phone Rule.** A phone gets the whole sequence: no nested scroll box for a tracklist, 7 to 12 rows visible in the page's own scroll. Keyboard hints hide on coarse pointers (`pointer-coarse:hidden`).

**The 200% Table Rule.** Tables survive 200% text. No `table-fixed` with rem-sized columns that can starve the title: the title column keeps at least 8rem, numeric and mark columns stay narrow, and when the row still can't fit, the table scrolls sideways inside its own region instead of squeezing the title.

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
- **Disabled:** 50% opacity and a not-allowed cursor; a disabled priced action still shows its price and one plain line explaining why.
- **Icon button:** a 44px square, Stone Ink icon, Hover wash on hover; always carries an accessible name.
- **Focus:** the global saffron ring, 2px, offset 2px. No per-component focus styles, with one exception: rows and tabs inside a scroller or a tight list (sidebar rows, album tabs) draw the ring inset (`focus-visible:-outline-offset-2`) so it is never clipped or painted over by the next row. Every element carries the ring's color before it is focused, so the ring appears at once instead of fading in from the text color under `transition-colors`. The global element styles live in the base layer, beneath the utilities, so these adjustments apply.

### Chips
- **Style:** a 4px-cornered outline chip, 0.75rem at 500, 2px by 8px padding. Neutral chips use a Strong Rule border and Stone Ink; state chips use the state color for text and border (50% opacity).
- **Editable chips:** in chip-list editors each value is a 44px-tall Raised chip with its own labelled 44px remove button; suggestions are dashed-border chips with a plus.

### Cards / Containers
- **Section:** not a box. A hairline top rule, 24px top padding, the h2 with an optional description and actions, content 16px below.
- **Panel:** Raised Graphite, a Hairline border, 4px corners, 16px padding (20px from 768px). For a form or self-contained tool only; never nested, never holding cards.
- **Catalog row (album card):** a whole-row link, 12px vertical padding: the album title in the small display cut, the catalog line beneath (artist · tracks · edited), a status chip and a chevron at the end. Rows sit in a list divided by hairlines; hover adds the Hover wash.
- **Empty state:** a dashed Strong Rule border, 20px by 32px padding, a semibold title, one teaching sentence and the action that fixes it.

### Inputs / Fields
- **Style:** Sunken well, 1px Control Edge border, 4px corners, 44px tall (textarea at least 96px), 12px side padding, Ash Ink placeholder, saffron caret.
- **Hover / Focus:** hover lifts the border to Ash Ink; focus turns the border saffron and shows the global ring.
- **Labels and hints:** every field has a visible 500-weight label above it; hints in Ash Ink at 0.75rem below, replaced by a Coral error message when invalid. `Field` ties them to the control itself: it gives the element whose id is `htmlFor` its `aria-describedby` (and `aria-invalid` with an error), keeping any other ids the caller set; a control rendered by another component takes them through a render function.
- **Disabled:** 60% opacity.

### Navigation
- **Sidebar (Main):** 44px rows, 4px corners, a 16px icon and the label. Idle rows are Stone Ink with an Ash Ink icon; hover adds the Hover wash. The current row is Selected Graphite, semibold Bone Ink, with a saffron icon and a 2px saffron bar at its left edge, and carries `aria-current`. Settings and Help sit in the account block under the credits meter, as ordinary rows: Help is a place to look things up, never a saffron call to action.
- **Wordmark:** "Album Conceptualizer" in condensed caps, Bone Ink, with the second word in extra bold. Never saffron.
- **Album tab bar:** six text tabs (Overview, Studio, Bible, Coherence, Sound, Export) on a hairline baseline. Idle tabs are Stone Ink with a transparent 2px underline that turns Strong Rule on hover; the current tab is semibold Bone Ink with a saffron underline. The six sit in one row when the album column is at least 32rem wide (rem, so enlarged text needs more room); with less, they stack as a ruled grid of three columns, or two below 20rem, each tab on its own hairline, so a phone shows every tab. If a row still overflows, the strip scrolls inside itself, centers the current tab with `scrollLeft` (never `scrollIntoView`, which would move the focus starting point past the skip link) and fades the edge with more tabs past it with a transparency mask.
- **Second-level nav (Sound):** Style · References · Demos as 44px text links separated by middots; the current one is semibold Bone Ink with a 2px saffron underline offset 8px.
- **Mobile:** the sidebar's contents move into a modal sheet with the same rows, credits meter and account block.

### Release Header (signature)
The top of every album screen: the album title in the expanded cut (`display-release`, 2.25rem on a phone to 3.75rem wide, max 24ch), and beneath it the catalog line in condensed caps, Stone Ink, joined by middots: artist, track count in tabular figures, status (and "On Discover"), remix source when there is one, and when it was edited. The next step for the album sits bottom-right as a button, weighted by the One Next Step Rule below. It is left out on the screen it points to, in the Studio (which has its own track list), and while the Overview's welcome banner carries the same action.

### The Spine (signature)
The album's sequence as a track sheet: columns for the two-digit track number (tabular, Ash Ink, 600), the title (a link stretched over the whole 44px row, clamped to two lines, never narrower than 8rem), lyrics written as a fraction glyph ("½", "2/2", "—"), the album themes (up to six) and whether the track has a role in the arc (a check, or a dot). The themes share one column: its head is a row of short horizontal keys in catalog caps (the shortest unique initial, "M", "ME", or a letter and position when two themes still clash), each with the full name on hover, and a legend under the table spells every key out; each row shows one mark per theme beneath its key. A track that carries a theme shows a solid 10px Bone Ink square; a track that doesn't shows a small Strong Rule dot (`ThemeMark`, the one mark for every theme matrix). The table sizes itself to its content (never `table-fixed`) and scrolls sideways inside its own region when enlarged text leaves no room. Column heads are catalog caps in Ash Ink over a hairline; rows are divided by hairlines and take the Hover wash on hover or keyboard focus. A screen reader hears each row once: the title, the lyrics fraction in words, one phrase for the themes ("Carries memory and signal", "Carries none of the album themes") and the role; the marks and keys are hidden from it. In the Studio the same sheet becomes the editable track list: the selected row is Selected Graphite and its number turns saffron.

### Credits Meter
The workspace balance in the sidebar: "Credits" in Stone Ink with the figure in tabular Bone Ink over "/ total" in Ash Ink, a 4px-tall fully rounded meter (Stone Ink fill on a Hairline track, never saffron), one sentence of what things cost, and a 44px link to daily challenges.

### Confirm Spend
Every action that spends credits goes through `ConfirmSpend` (components/confirm-spend.tsx). The trigger is an ordinary button whose label carries the price ("Remix · 5 credits"), in the tone its screen calls for. Pressing it swaps the trigger in place for one line, "Remix for 5 credits? You'll have 40 left.", with a primary confirm and a Cancel; Escape cancels and focus returns to the trigger. No other confirm dialog, and never a spend on a single tap. When the balance can't cover it, the confirm says so ("Remix costs 5 credits and you have 3 credits.") and its confirm button stays disabled.

### Help
One short, task-based page at `/app/help`, linked from the account block of the sidebar and the mobile sheet and from Settings: the path from idea to handoff, what credits pay for and what each plan grants (read from the same constants the buttons use), what counts as written (placeholder lyrics and the starter chord loop don't), and the Studio's keyboard shortcuts set in `kbd` keys. Plain Sections and hairline tables, no cards.

### Named Rules
**The Honest Signal Rule.** A tick, a score, a fraction or a status never claims work that wasn't done. Placeholder lyrics and the starter chord loop count as not written everywhere they are counted; `@/lib/lyrics` and `@/lib/chords` are the only definitions.

**The One Term Rule.** One word per concept on every surface (labels, headings, fix links, spine heads, search): "Story note" for a track's narrative summary, "Role" for its place in the arc, "Motifs" for album motifs plus track motif tags, read from the same source on the Bible and the Coherence report. CONTEXT.md holds the glossary.

**The One Save Model Rule.** A surface that saves as you work has no primary Save button; it shows its status ("Saved · just now", "Saving…", "Unsaved changes — Retry"). A manual save kept for Ctrl/⌘+S is a quiet ghost button. The saffron on a screen is the next step of the work, never saving.

**The Deliberate Spend Rule.** Credits are spent only after one confirm that names the cost and the balance after (Confirm Spend), or with an Undo that stays at least 10 seconds.

**The Writing Path Rule.** Destructive controls live away from the writing path: ghost or danger-text buttons in a "More" menu or at the end of a row, never directly above or below a text field.

**The One Phrase Rule.** A row of marks is read as one phrase, not one announcement per cell: the spine says "Carries memory and signal" once per track instead of a "doesn't carry" for every theme.

**The One Next Step Rule.** The release header's next step is the album screen's saffron primary, unless the screen's own content shows a primary action (Export's download, a Sound form, an open confirm); then it steps back to secondary, so every album screen has exactly one saffron button. `AlbumNextAction` applies the rule by watching the content column for a primary; screens don't opt in or out.

## Do's and Don'ts

### Do:
- **Do** use the shared primitives (Button, ButtonLink, IconButton, PageHeader, Section, Panel, Field, Chip, StatusMessage, EmptyState) instead of restyling raw elements.
- **Do** keep exactly one h1 per page: the release title on album screens, the page header title elsewhere.
- **Do** put the catalog line under the title in condensed caps, joined by middots, with counts in tabular figures and correct plurals ("1 track", "3 tracks").
- **Do** separate content with hairlines (`line`) and whitespace; list rows are divided by hairlines.
- **Do** mark the current location with saffron plus a second cue (weight, underline, bar, `aria-current`).
- **Do** keep every interactive element at least 44 by 44px and let the global saffron focus ring show (2px, offset 2px).
- **Do** use a transparency mask, not a color, when an overflowing strip needs an edge fade.
- **Do** say what spends credits on the button itself, confirm it once with Confirm Spend, and disable priced AI actions with a plain reason when AI can't run.
- **Do** give a mark that relies on a wash or saffron a forced-colors equivalent (Highlight, CanvasText, a border).

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
