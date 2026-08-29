# Web API Examples

This page gives concrete examples for the Next.js web API in `apps/web/src/app/api/`.

It is intentionally practical. Use it when you need to:

- test routes outside the UI
- understand request body shape
- confirm what the route actually returns

For the full route inventory, see [Web Route Reference](web-route-reference.md).

## Auth Model

Most web API routes are authenticated with a NextAuth session cookie, not an API key.

That means the easiest ways to exercise them are:

- use the browser while signed in
- use Playwright
- copy an authenticated request from browser dev tools

For local manual testing, assume:

```bash
BASE_URL="http://127.0.0.1:3002"
COOKIE='next-auth.session-token=<your-session-cookie>'
```

In HTTPS production you may see `__Secure-next-auth.session-token` instead.

## Common Headers

Most examples below assume:

```bash
-H "Content-Type: application/json" \
-H "Cookie: ${COOKIE}"
```

## 1. Health Check

Public route.

```bash
curl "${BASE_URL}/api/health"
```

Typical response:

```json
{
  "ok": true,
  "service": "album-conceptualizer-web",
  "mode": "default",
  "checks": {
    "api": true,
    "config": true,
    "db": true,
    "engine": true
  }
}
```

If strict production config is invalid, this returns `503` and includes `errors.config`.

## 2. Create Album

Route:

```text
POST /api/albums
```

This expects the full `album.json` payload under `album`.

```bash
curl "${BASE_URL}/api/albums" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Cookie: ${COOKIE}" \
  -d '{
    "album": {
      "title": "Neon Pilgrimage",
      "artist": "Glass Avenue",
      "concept_summary": "A city-night concept album about escape, memory, and return.",
      "primary_genre": "Synth Pop",
      "central_themes": ["escape", "memory", "return"],
      "songs": [
        {
          "id": "song-1",
          "title": "Static at Dusk",
          "track_number": 1,
          "key": "D minor",
          "tempo": 118,
          "narrative_summary": "The protagonist leaves home at twilight.",
          "sections": [
            {
              "id": "section-1",
              "section_type": "verse",
              "order": 1,
              "lyrics": "Streetlights flicker through the rain",
              "chord_progression": ["Dm", "Bb", "F", "C"]
            }
          ]
        }
      ]
    }
  }'
```

Typical response:

```json
{
  "id": "cm9xyz123abc456def"
}
```

Notes:

- free plans are currently capped at five projects
- album creation also spends credits
- the route rate-limits project creation

## 3. Save Album

Route:

```text
PATCH /api/albums/[albumId]
```

This is the most important persistence route in the web app.

It expects the full album snapshot again, not a tiny partial patch.

```bash
curl "${BASE_URL}/api/albums/cm9xyz123abc456def" \
  -X PATCH \
  -H "Content-Type: application/json" \
  -H "Cookie: ${COOKIE}" \
  -d '{
    "versionMessage": "Add second chorus draft",
    "album": {
      "id": "cm9xyz123abc456def",
      "title": "Neon Pilgrimage",
      "artist": "Glass Avenue",
      "concept_summary": "A city-night concept album about escape, memory, and return.",
      "primary_genre": "Synth Pop",
      "central_themes": ["escape", "memory", "return"],
      "songs": [
        {
          "id": "song-1",
          "title": "Static at Dusk",
          "track_number": 1,
          "key": "D minor",
          "tempo": 118,
          "sections": [
            {
              "id": "section-1",
              "section_type": "verse",
              "order": 1,
              "lyrics": "Streetlights flicker through the rain",
              "chord_progression": ["Dm", "Bb", "F", "C"]
            },
            {
              "id": "section-2",
              "section_type": "chorus",
              "order": 1,
              "lyrics": "Run until the skyline bends",
              "chord_progression": ["Bb", "F", "C", "Dm"]
            }
          ]
        }
      ]
    }
  }'
```

Typical response:

```json
{
  "ok": true
}
```

Important:

- this route rebuilds normalized `Song` and `Section` rows from the submitted snapshot
- `Album.data` remains the export source of truth

## 4. Create Share Link

Route:

```text
POST /api/albums/[albumId]/share
```

```bash
curl "${BASE_URL}/api/albums/cm9xyz123abc456def/share" \
  -X POST \
  -H "Cookie: ${COOKIE}"
```

Typical response:

```json
{
  "share": {
    "token": "9a8b7c6d5e4f3a2b1c0d",
    "revokedAt": null,
    "expiresAt": "2026-04-10T23:11:44.000Z",
    "url": "http://127.0.0.1:3002/share/9a8b7c6d5e4f3a2b1c0d"
  }
}
```

Use:

```text
GET /api/albums/[albumId]/share
DELETE /api/albums/[albumId]/share
```

to inspect or revoke the link.

## 5. Create Section Comment

Route:

```text
POST /api/albums/[albumId]/comments
```

```bash
curl "${BASE_URL}/api/albums/cm9xyz123abc456def/comments" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Cookie: ${COOKIE}" \
  -d '{
    "sectionId": "section-2",
    "songTrackNumber": 1,
    "sectionType": "chorus",
    "sectionOrder": 1,
    "body": "Push this hook harder and tag @producer on the next pass."
  }'
```

Typical response:

```json
{
  "comment": {
    "id": "cm9comment123",
    "sectionId": "section-2",
    "songTrackNumber": 1,
    "sectionType": "chorus",
    "sectionOrder": 1,
    "body": "Push this hook harder and tag @producer on the next pass.",
    "createdAt": "2026-03-11T20:42:10.000Z",
    "updatedAt": "2026-03-11T20:42:10.000Z",
    "deletedAt": null,
    "resolvedAt": null,
    "author": {
      "id": "cm9user123",
      "name": "Dev User",
      "image": null
    },
    "resolvedBy": null
  }
}
```

Notes:

- comments are anchored to the external section id from the album JSON
- comment creation can generate notifications for mentions and workspace owners

## 6. Create Task

Route:

```text
POST /api/albums/[albumId]/tasks
```

```bash
curl "${BASE_URL}/api/albums/cm9xyz123abc456def/tasks" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Cookie: ${COOKIE}" \
  -d '{
    "title": "Rewrite chorus hook",
    "body": "Find a stronger first line and keep the skyline image.",
    "status": "open",
    "priority": 3,
    "sectionId": "section-2",
    "songTrackNumber": 1,
    "sectionType": "chorus",
    "sectionOrder": 1
  }'
```

Typical response:

```json
{
  "task": {
    "id": "cm9task123",
    "title": "Rewrite chorus hook",
    "body": "Find a stronger first line and keep the skyline image.",
    "status": "open",
    "priority": 3,
    "dueAt": null,
    "sectionId": "section-2",
    "songTrackNumber": 1,
    "sectionType": "chorus",
    "sectionOrder": 1,
    "createdAt": "2026-03-11T20:45:00.000Z",
    "updatedAt": "2026-03-11T20:45:00.000Z",
    "createdBy": {
      "id": "cm9user123",
      "name": "Dev User",
      "email": "dev@example.com",
      "image": null
    },
    "assignedTo": null
  }
}
```

Use:

```text
GET /api/albums/[albumId]/tasks
```

to list tasks, optionally filtered by `?status=open`.

## 7. Save A Version Snapshot

Route:

```text
POST /api/albums/[albumId]/versions
```

```bash
curl "${BASE_URL}/api/albums/cm9xyz123abc456def/versions" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Cookie: ${COOKIE}" \
  -d '{
    "message": "Checkpoint before bridge rewrite"
  }'
```

Typical response:

```json
{
  "id": "cm9version123"
}
```

## 8. Start Stripe Checkout

Route:

```text
POST /api/stripe/checkout
```

```bash
curl "${BASE_URL}/api/stripe/checkout" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Cookie: ${COOKIE}" \
  -d '{
    "plan": "pro"
  }'
```

Typical response:

```json
{
  "url": "https://checkout.stripe.com/c/pay/cs_test_123",
  "sessionId": "cs_test_123"
}
```

Notes:

- this route requires the relevant `STRIPE_PRICE_ID_*` env var
- it is rate-limited
- it creates a subscription-mode checkout session

## 9. Track Album Page View

Route:

```text
POST /api/analytics/album-view
```

```bash
curl "${BASE_URL}/api/analytics/album-view" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Cookie: ${COOKIE}" \
  -d '{
    "albumId": "cm9xyz123abc456def",
    "event": "album_studio_viewed",
    "path": "/app/albums/cm9xyz123abc456def/studio"
  }' \
  -i
```

Expected response:

```text
HTTP/1.1 204 No Content
```

## Error Patterns

Common error responses:

### Unauthorized

```json
{
  "error": "Unauthorized."
}
```

### Invalid Payload

```json
{
  "error": "Invalid payload."
}
```

### Not Found

```json
{
  "error": "Not found."
}
```

## Practical Advice

If you are debugging a route:

1. start with [Web Route Reference](web-route-reference.md)
2. inspect the handler under `apps/web/src/app/api/...`
3. check the server helpers in `apps/web/src/server/...`
4. if the route touches albums, verify the `album.json` shape and Prisma model together
