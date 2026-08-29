# Data Model

This page documents the Prisma data model for the Next.js product.

Schema file:

- `apps/web/prisma/schema.prisma`

Database schema name:

- `album_conceptualizer`

## Mental Model

The web product stores data in two layers:

1. normalized relational tables for querying and UI workflows
2. a full `album.json` snapshot stored on `Album.data`

That dual model is intentional.

The normalized tables make the app fast to query.
The JSON snapshot preserves the full album structure that the Python engine expects for export.

## Core Domains

### Identity

These models support NextAuth and user ownership:

| Model | Purpose |
| --- | --- |
| `User` | primary user record |
| `Account` | OAuth provider linkage |
| `Session` | persisted NextAuth session |
| `VerificationToken` | email auth and verification token support |

Important notes:

- `User.email` is unique
- deleting a user cascades through most owned data

### Workspace

The workspace is the top-level tenant boundary for the web app.

| Model | Purpose |
| --- | --- |
| `Workspace` | top-level scope for albums, billing, analytics, and notifications |
| `WorkspaceMember` | membership and role mapping |

Important notes:

- every workspace has an `ownerId`
- memberships are unique per `workspaceId` plus `userId`
- the web app resolves one active workspace per user for most flows

### Album Structure

These models store the creative project itself.

| Model | Purpose |
| --- | --- |
| `Album` | top-level project record |
| `Song` | normalized track row |
| `Section` | normalized section row within a song |

Important notes:

- `Album.workspaceId` binds the album to a workspace
- `Song` rows are unique by `albumId` plus `trackNumber`
- `Section` rows are unique by `songId`, `sectionType`, and `order`

## Album Is Stored Twice On Purpose

`Album` contains:

- queryable metadata such as title, artist, genre, status, and publish state
- normalized child rows in `Song` and `Section`
- `data`, which stores the full `album.json` snapshot

The important rule is:

`Album.data` is the source of truth for export and future editor compatibility.

The normalized rows are derived from that snapshot during create and save operations.

That behavior lives in:

- `apps/web/src/server/album-json.ts`
- `apps/web/src/server/album-sync.ts`
- `apps/web/src/app/api/albums/route.ts`
- `apps/web/src/app/api/albums/[albumId]/route.ts`

## Collaboration And Project Management

These models add workflow and review behavior around albums.

| Model | Purpose |
| --- | --- |
| `AlbumVersion` | saved album snapshot |
| `AlbumShareLink` | public share token |
| `AlbumLike` | user likes on public albums |
| `AlbumSectionComment` | comments anchored to a section id from album JSON |
| `AlbumTask` | tasks linked to albums and optionally to comments or sections |
| `Notification` | user notifications tied to workspace activity |

Important notes:

- `AlbumVersion.data` stores the full album JSON snapshot at save time
- `AlbumShareLink` is one-to-one per album in the current model
- comments use the external section id from the album JSON, not only the normalized `Section` row id
- tasks can be created from comments and can deep-link back to section context

## Billing, Credits, And Challenges

These models support monetization and usage accounting.

| Model | Purpose |
| --- | --- |
| `Subscription` | workspace billing state and Stripe ids |
| `CreditBalance` | current workspace credit balance |
| `CreditLedgerEntry` | immutable credit delta history |
| `ChallengeCompletion` | daily challenge records and earned credits |

Important notes:

- `Subscription.workspaceId` is unique, so each workspace has one subscription row
- `CreditBalance.workspaceId` is the primary key
- `CreditLedgerEntry` is append-only accounting history
- challenge completion is unique by workspace, challenge key, and day

## Analytics

`AnalyticsEvent` stores product usage milestones.

Key fields:

| Field | Meaning |
| --- | --- |
| `workspaceId` | tenant context |
| `userId` | acting user |
| `albumId` | concrete album when known |
| `albumKey` | durable logical album key used for funnel continuity |
| `sessionId` | browser or request-level session grouping |
| `event` | event name |
| `source` | event source, default `server` |
| `path` | route or endpoint context |
| `metadata` | event payload |

This model is used by the workspace funnel and product instrumentation.

## Relationship Summary

At a high level:

- a `User` can own many `Workspace` records and belong to many more through `WorkspaceMember`
- a `Workspace` owns many `Album` records
- an `Album` owns many `Song`, `AlbumVersion`, `AlbumSectionComment`, `AlbumTask`, and `AnalyticsEvent` records
- a `Song` owns many `Section` records
- comments and tasks produce `Notification` rows
- a `Workspace` has one `Subscription` and one `CreditBalance`

## Deletion Behavior

The schema uses cascades aggressively for owned records.

Examples:

- deleting a workspace cascades to albums, notifications, subscription, credits, and analytics
- deleting an album cascades to songs, comments, tasks, versions, likes, and related notifications
- deleting a user cascades through many authored or owned records

That is convenient, but it also means destructive actions have broad impact.

## Common Change Patterns

### Add A New Album-Level Field

Usually update all of:

1. `apps/web/prisma/schema.prisma`
2. Prisma migration
3. `apps/web/src/server/album-json.ts`
4. `apps/web/src/server/album-sync.ts`
5. any page or API route that reads or writes the field
6. Playwright coverage if the field is user-facing

### Add A New Collaboration Primitive

Usually update:

1. `schema.prisma`
2. server access layer
3. API route
4. page or component
5. notifications or analytics if needed

### Change Export-Relevant Album Shape

You must treat these together:

1. `AlbumJsonSchema`
2. `Album.data`
3. `Song` and `Section` derivation logic
4. the Python engine expectations

This is where silent regressions are most likely if you change only one side.

## Practical Rule

If a change affects creative content structure, do not assume the normalized tables are enough.

Always check whether the same change must also exist in the `album.json` snapshot and in the Python export path.
