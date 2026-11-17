# Feature map

Every feature a person can reach in the web app (`apps/web`), in their words. Other
loops name features by the **Feature** column; `pr-review` and `fuzz` walk this table.
Paths under "Where" are relative to the web app's origin; `<album>` is an album id.
The Python engine has no screens of its own: users reach it through the Story bible,
Export and AI rows below.

| Feature | Where | How to reach it | How to check it works |
|---|---|---|---|
| Landing page | `/` | Open the site | Heading "Build a concept album that actually holds together." |
| Privacy | `/privacy` | Landing page footer | Heading "How Album Conceptualizer handles your data" |
| Terms | `/terms` | Landing page footer | Heading "Terms for using Album Conceptualizer" |
| Support | `/support` | Landing page footer | Heading "Get help with access, billing, and exports" |
| Sign in | `/sign-in` | "Sign in" on the landing page | After signing in you land on `/app` with heading "Home" |
| Credits | Sidebar, every `/app` page | Signed in | The "Credits" meter shows a balance (50 for a new account) |
| Start a new album | `/app/create` | "New album" in the top bar | Fill title, artist and concept, Continue twice, "Save and continue" and confirm: you land on `/app/albums/<album>` with the album title as heading |
| Album overview | `/app/albums/<album>` | Open an album from Home or Library | Heading is the album title; the Album tabs (Overview, Studio, Story bible, Coherence, Sound, Export) show |
| Write lyrics in the Studio | `/app/albums/<album>/studio` | Album tab "Studio" | Type in "Lyrics draft", press "Save now": "Saved." appears |
| Story bible | `/app/albums/<album>/bible` | Album tab "Story bible" | Page opens; "Markdown" downloads `<Title>_album_bible.md` |
| Coherence report | `/app/albums/<album>/coherence` | Album tab "Coherence" | Page opens under the album heading with the coherence report |
| Sound bible | `/app/albums/<album>/style` | Album tab "Sound" | Page opens with the Sound navigation (Sound bible, References, Demos) |
| References | `/app/albums/<album>/references` | Album tab "Sound", then "References" | Page opens; "Add your first reference" opens the reference form |
| Rough demos | `/app/albums/<album>/demos` | Album tab "Sound", then "Demos" | Page opens; "Add your first demo" opens the demo upload form |
| Export | `/app/albums/<album>/export` | Album tab "Export" | "Download zip · 2 credits", then "Download zip": a `<Title>_export.zip` downloads |
| Version history | `/app/albums/<album>/versions` | The catalog line in the album header | Name a version, "Save version"; "Restore the version …" then "Restore this version" shows "Restored “…”" |
| Inbox (comments and tasks) | `/app/albums/<album>/inbox` | "Comments and tasks" row on the album Overview | Page opens under the album heading, listing open comments and tasks |
| Share link | Album overview | "Create share link" on the Overview | A `/share/<token>` link appears with a "Revoke" button |
| Shared album | `/share/<token>` | Open a share link, signed in or not | The album title shows as the heading without signing in |
| Publish to Discover | Album overview | "Publish", then "Publish anyway" for an unfinished album | "Published to Discover." appears and the button becomes "Unpublish" |
| Discover | `/app/discover` | Sidebar "Discover" | Published albums show as cards; "Like <title>" toggles; the card opens `/app/discover/<album>` |
| Delete an album | Album overview | "Delete album…", type the title, "Delete this album" | You are taken back to `/app` and the album is gone |
| Home | `/app` | Sidebar "Home" | Heading "Home" with your recent albums |
| Library | `/app/library` | Sidebar "Library" | Heading "Library" listing your albums |
| Challenges | `/app/challenges` | Sidebar "Challenges" | Heading "Challenges" with today's challenge |
| Search | `/app/search?q=…` | Search box in the top bar | Heading "Search"; matching albums are listed |
| Story bibles | `/app/bibles` | By address only: no screen links to it | Heading "Story bibles" listing each album's bible |
| Studio (pick an album) | `/app/studio` | By address only: no screen links to it | Heading "Studio" listing albums to write in |
| Notifications | `/app/notifications` | Sidebar "Notifications" | Heading "Notifications" |
| Settings | `/app/settings` | Sidebar "Settings" | Heading "Settings" with Plan and billing, Album progress, Help and Account |
| Plan and billing | `/app/settings/billing` | Settings, "Plan and billing" | Heading "Plan and billing" with the plans and action costs |
| Album progress | `/app/settings/analytics` | Settings, "Album progress" | Heading "Album progress"; your new album appears in it |
| Help | `/app/help` | Sidebar "Help" | Heading "Help" with the idea-to-handoff steps and keyboard shortcuts |
| Sign out | Settings | "Sign out" | You are back on `/` signed out |
