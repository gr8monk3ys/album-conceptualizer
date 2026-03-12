# Web Route Reference

This page maps the shipped Next.js surface in `apps/web/src/app/`.

Use it when you need to answer:

- which page owns a workflow
- which route handler persists a feature
- whether a route is public or protected

## Route Model

The web app has three main route classes:

- public pages
- protected app pages under `/app`
- API routes under `/api`

## Public Pages

These routes are reachable without an authenticated session.

| Route | File | Purpose |
| --- | --- | --- |
| `/` | `apps/web/src/app/page.tsx` | marketing landing page |
| `/sign-in` | `apps/web/src/app/sign-in/page.tsx` | auth entry point |
| `/share/[token]` | `apps/web/src/app/share/[token]/page.tsx` | public shared album preview |

## Protected App Shell

Everything under `/app` is guarded by middleware plus server-side identity checks.

Core shell files:

- `apps/web/middleware.ts`
- `apps/web/src/app/app/layout.tsx`
- `apps/web/src/components/sidebar.tsx`
- `apps/web/src/components/topbar.tsx`

## Protected Pages

### Workspace-Level Pages

| Route | File | Purpose |
| --- | --- | --- |
| `/app` | `apps/web/src/app/app/page.tsx` | workspace home and recent projects |
| `/app/create` | `apps/web/src/app/app/create/page.tsx` | guided album creation flow |
| `/app/discover` | `apps/web/src/app/app/discover/page.tsx` | public album feed |
| `/app/discover/[albumId]` | `apps/web/src/app/app/discover/[albumId]/page.tsx` | detail page for a published album |
| `/app/library` | `apps/web/src/app/app/library/page.tsx` | personal workspace album library |
| `/app/search` | `apps/web/src/app/app/search/page.tsx` | workspace search across albums, songs, and lyrics |
| `/app/bibles` | `apps/web/src/app/app/bibles/page.tsx` | album bible index |
| `/app/studio` | `apps/web/src/app/app/studio/page.tsx` | high-level studio surface |
| `/app/challenges` | `apps/web/src/app/app/challenges/page.tsx` | daily challenges and credits |
| `/app/notifications` | `apps/web/src/app/app/notifications/page.tsx` | notification inbox |
| `/app/settings` | `apps/web/src/app/app/settings/page.tsx` | workspace settings overview |
| `/app/settings/billing` | `apps/web/src/app/app/settings/billing/page.tsx` | plans, subscription, and billing access |
| `/app/settings/analytics` | `apps/web/src/app/app/settings/analytics/page.tsx` | workspace funnel and analytics |

### Album-Level Pages

| Route | File | Purpose |
| --- | --- | --- |
| `/app/albums/[albumId]` | `apps/web/src/app/app/albums/[albumId]/page.tsx` | album overview and project summary |
| `/app/albums/[albumId]/studio` | `apps/web/src/app/app/albums/[albumId]/studio/page.tsx` | detailed song and section editing |
| `/app/albums/[albumId]/bible` | `apps/web/src/app/app/albums/[albumId]/bible/page.tsx` | album bible and coherence information |
| `/app/albums/[albumId]/coherence` | `apps/web/src/app/app/albums/[albumId]/coherence/page.tsx` | coherence-focused review surface |
| `/app/albums/[albumId]/export` | `apps/web/src/app/app/albums/[albumId]/export/page.tsx` | export and handoff flow |
| `/app/albums/[albumId]/inbox` | `apps/web/src/app/app/albums/[albumId]/inbox/page.tsx` | comments and task workflow |
| `/app/albums/[albumId]/versions` | `apps/web/src/app/app/albums/[albumId]/versions/page.tsx` | saved snapshots and restore flow |

## API Routes

Most API routes are session-authenticated and operate against the current user's active workspace.

Important exceptions:

- `/api/health` is public
- `/api/auth/[...nextauth]` is public
- `/api/stripe/webhook` is signed by Stripe, not session-authenticated

### Auth And Health

| Route | Methods | Purpose |
| --- | --- | --- |
| `/api/auth/[...nextauth]` | `GET`, `POST` | NextAuth entry point |
| `/api/health` | `GET` | web runtime health and config gate |

### Albums

| Route | Methods | Purpose |
| --- | --- | --- |
| `/api/albums` | `POST` | create an album from an `album.json` payload |
| `/api/albums/[albumId]` | `PATCH`, `DELETE` | save or delete an album |
| `/api/albums/[albumId]/autotag` | `POST` | generate or refresh tags |
| `/api/albums/[albumId]/export` | `GET` | export through the Python engine |
| `/api/albums/[albumId]/publish` | `POST` | publish to Discover |
| `/api/albums/[albumId]/fork` | `POST` | fork into the active workspace |
| `/api/albums/[albumId]/like` | `POST`, `DELETE` | like or unlike a public album |

### Bible And Export Artifacts

| Route | Methods | Purpose |
| --- | --- | --- |
| `/api/albums/[albumId]/bible/markdown` | `GET` | export album bible as markdown |
| `/api/albums/[albumId]/bible/pdf` | `GET` | export album bible as PDF |
| `/api/midi/preview` | `POST` | generate a MIDI preview |
| `/api/audio/preview/mp3` | `POST` | generate an MP3 preview |

### Sharing, Versions, And Remix

| Route | Methods | Purpose |
| --- | --- | --- |
| `/api/albums/[albumId]/share` | `GET`, `POST`, `DELETE` | inspect, create, or revoke a share link |
| `/api/share/[token]/fork` | `POST` | fork a public share into a workspace |
| `/api/albums/[albumId]/versions` | `GET`, `POST` | list versions or save a snapshot |
| `/api/albums/[albumId]/versions/[versionId]/restore` | `POST` | restore a snapshot |

### Comments, Tasks, And Notifications

| Route | Methods | Purpose |
| --- | --- | --- |
| `/api/albums/[albumId]/comments` | `GET`, `POST` | list or create section comments |
| `/api/albums/[albumId]/comments/[commentId]` | `PATCH`, `DELETE` | update, resolve, or remove a comment |
| `/api/albums/[albumId]/tasks` | `GET`, `POST` | list or create tasks |
| `/api/albums/[albumId]/tasks/[taskId]` | `PATCH`, `DELETE` | update or remove a task |
| `/api/notifications/[notificationId]` | `PATCH` | update a notification state |
| `/api/notifications/read-all` | `POST` | mark all notifications as read |

### Billing, Credits, And Analytics

| Route | Methods | Purpose |
| --- | --- | --- |
| `/api/stripe/checkout` | `POST` | create Stripe checkout |
| `/api/stripe/portal` | `POST` | create Stripe billing portal session |
| `/api/stripe/webhook` | `POST` | Stripe event ingestion |
| `/api/challenges/complete` | `POST` | record challenge completion and credit reward |
| `/api/analytics/album-view` | `POST` | track album page views and funnel events |

## Route Ownership Tips

If you need to change:

- shell navigation or layout, start in `apps/web/src/app/app/layout.tsx`
- auth behavior, start in `apps/web/src/server/auth.ts` and `apps/web/middleware.ts`
- album persistence, start in `apps/web/src/app/api/albums/` plus `apps/web/src/server/album-sync.ts`
- export behavior, start in `apps/web/src/app/api/albums/[albumId]/export/route.ts`
- share and discover flows, start in `apps/web/src/app/app/discover/` and `apps/web/src/app/api/albums/[albumId]/publish/route.ts`

## The Most Important Persistence Note

Album saves are not just a shallow metadata update.

`PATCH /api/albums/[albumId]` rebuilds the normalized song and section rows from the submitted `album.json` snapshot, and `Album.data` is intentionally treated as the source of truth for export and future editor behavior.

That means route changes and data-model changes usually need to be made together.
