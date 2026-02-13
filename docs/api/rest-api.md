# REST API Reference

Album Conceptualizer provides a RESTful API for programmatic access.

## Base URL

```
http://localhost:8000/api/v1
```

## Authentication

Use API keys for authenticated access:

- Header `X-API-Key: <key>`
- Or `Authorization: Bearer <key>`

Configure accepted keys via:

- `ALBUM_CONCEPTUALIZER_API_KEY=<single-key>`
- `ALBUM_CONCEPTUALIZER_API_KEYS=key1,key2,...`

### Subscription Gating

Set `ALBUM_CONCEPTUALIZER_SUBSCRIPTION_REQUIRED=true` to require active
subscriptions on protected product routes.

Billing management endpoints remain accessible with API key auth:

- `GET /api/v1/billing/subscription`
- `POST /api/v1/billing/checkout-session`
- `POST /api/v1/billing/webhook` (Stripe webhook)

### Identity and Onboarding

Identity now supports direct register/login plus magic-link onboarding and workspace invites:

- `POST /api/v1/identity/register` (bootstrap account/workspace + token)
- `POST /api/v1/identity/magic-links/request` (email magic-link token)
- `POST /api/v1/identity/magic-links/consume` (consume token and sign in)
- `POST /api/v1/identity/workspaces/{workspace_id}/invites` (owner/editor invite)
- `POST /api/v1/identity/invites/accept` (accept workspace invite)
- `GET /api/v1/identity/workspaces/{workspace_id}/invites` (list invite statuses)

By default, workspace bearer tokens require verified email
(`ALBUM_CONCEPTUALIZER_IDENTITY_REQUIRE_VERIFIED_EMAIL=true`).
For local testing, enable token visibility in responses with
`ALBUM_CONCEPTUALIZER_IDENTITY_DEBUG_TOKENS=true`.
For production delivery, configure SMTP:
`ALBUM_CONCEPTUALIZER_EMAIL_PROVIDER=smtp`,
`ALBUM_CONCEPTUALIZER_EMAIL_FROM=...`,
`ALBUM_CONCEPTUALIZER_SMTP_HOST=...`.

## Endpoints

### Health

#### Check Health

```http
GET /api/v1/health
```

Returns API health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "components": {
    "api": "healthy",
    "database": "not_configured"
  }
}
```

### Albums

#### List Albums

```http
GET /api/v1/albums
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | int | Page number (default: 1) |
| `page_size` | int | Items per page (default: 20, max: 100) |
| `search` | string | Search in title/artist |

**Response:**
```json
{
  "items": [...],
  "total": 10,
  "page": 1,
  "page_size": 20
}
```

#### Create Album

```http
POST /api/v1/albums
Content-Type: application/json

{
  "title": "The Journey Home",
  "artist": "The Storytellers",
  "concept_summary": "A traveler's journey through memory",
  "primary_genre": "Progressive Rock",
  "central_themes": ["identity", "belonging"]
}
```

#### Get Album

```http
GET /api/v1/albums/{album_id}
```

#### Update Album

```http
PATCH /api/v1/albums/{album_id}
Content-Type: application/json

{
  "title": "New Title"
}
```

#### Delete Album

```http
DELETE /api/v1/albums/{album_id}
```

### Songs

#### List Songs

```http
GET /api/v1/albums/{album_id}/songs
```

#### Create Song

```http
POST /api/v1/albums/{album_id}/songs
Content-Type: application/json

{
  "title": "Opening Track",
  "track_number": 1,
  "key": "D major",
  "tempo": 120,
  "sections": [
    {
      "section_type": "verse",
      "order": 1,
      "lyrics": "The morning light...",
      "chord_progression": ["D", "A", "Bm", "G"]
    }
  ]
}
```

### Album Bible

#### Get Bible

```http
GET /api/v1/albums/{album_id}/bible
```

#### Update Bible

```http
PUT /api/v1/albums/{album_id}/bible
Content-Type: application/json

{
  "logline": "A weary traveler discovers home was within them",
  "synopsis": "Extended description...",
  "setting": "Modern day, small town America"
}
```

#### Add Theme

```http
POST /api/v1/albums/{album_id}/bible/themes
Content-Type: application/json

{
  "name": "Identity",
  "description": "Who we are when stripped of the familiar",
  "importance": "primary"
}
```

### Music Theory

#### Analyze Chord

```http
POST /api/v1/theory/chord/analyze
Content-Type: application/json

{
  "symbol": "Am7"
}
```

**Response:**
```json
{
  "input": "Am7",
  "root": "A",
  "quality": "minor_7",
  "bass_note": null,
  "normalized_symbol": "Am7",
  "intervals": ["1", "b3", "5", "b7"]
}
```

#### Get Scale

```http
GET /api/v1/theory/scale?root=C&scale_type=major
```

#### Analyze Key

```http
GET /api/v1/theory/key/C/major
```

**Response:**
```json
{
  "tonic": "C",
  "mode": "major",
  "diatonic_chords": ["I", "ii", "iii", "IV", "V", "vi", "vii°"],
  "common_progressions": [["I", "V", "vi", "IV"], ...],
  "relative_key": {"tonic": "A", "mode": "minor"}
}
```

### Export

#### Export as ChordPro

```http
GET /api/v1/export/album/{album_id}/chordpro
```

#### Export as JSON

```http
GET /api/v1/export/album/{album_id}/json
```

#### Export Progression to MIDI

```http
POST /api/v1/export/progression/midi
Content-Type: application/json

{
  "chords": ["C", "G", "Am", "F"],
  "tempo": 120,
  "title": "My Progression"
}
```

Returns downloadable MIDI file.

### Experience Toolkit

#### List Prompt Packs

```http
GET /api/v1/experience/prompt-packs
```

Returns creative challenge packs for jam sessions.

#### Capture Style Fingerprint

```http
POST /api/v1/experience/style-capture
Content-Type: application/json

{
  "album_goal": "Festival-ready hooks with emotional storytelling",
  "reference_tracks": [
    {
      "title": "Reference Song",
      "tempo": 124,
      "key": "C major",
      "chord_progression": ["C", "G", "Am", "F"],
      "mood_tags": ["cinematic", "hopeful"]
    }
  ]
}
```

#### Analyze Reference Tracks (Deep Diagnostics)

```http
POST /api/v1/experience/reference-analyzer
Content-Type: application/json

{
  "album_goal": "Big hooks with cinematic pacing",
  "desired_energy_curve": "wave",
  "target_track_count": 8,
  "reference_tracks": [
    {
      "title": "Reference Song",
      "tempo": 124,
      "key": "C major",
      "chord_progression": ["C", "G", "Am", "F"],
      "mood_tags": ["cinematic", "hooky"]
    }
  ]
}
```

Returns diagnostics, clusters, arrangement cues, and a track-by-track blueprint.

#### Build Jam Mode Plan

```http
POST /api/v1/albums/{album_id}/experience/jam-mode
Content-Type: application/json

{
  "pack_id": "cinematic-arc",
  "focus": "tight hooks and progression movement",
  "target_tracks": [1, 2, 3]
}
```

#### Get Timeline Board

```http
GET /api/v1/albums/{album_id}/experience/timeline-board
```

Returns per-track narrative rows plus continuity warnings.

#### Get Progress Coach

```http
GET /api/v1/albums/{album_id}/experience/progress-coach
```

Returns weighted completion metrics and prioritized next actions.

#### Generate Release Kit

```http
GET /api/v1/albums/{album_id}/experience/release-kit
```

Returns album pitch, press blurb, track teasers, social posts, and cover prompt text.

#### One-Click Release Kit Export Bundle

```http
POST /api/v1/albums/{album_id}/experience/release-kit/export
Content-Type: application/json

{
  "platform": "spotify",
  "duration_days": 14,
  "include_campaign_csv": true,
  "include_json_manifest": true
}
```

Builds a packaged folder + ZIP with launch copy, teasers, checklist, campaign CSV, and manifest JSON.

#### DAW Handoff Pack (Ableton / Logic)

```http
POST /api/v1/albums/{album_id}/experience/daw-handoff
Content-Type: application/json

{
  "daw_targets": ["ableton", "logic"],
  "include_midi_guides": true,
  "bpm_strategy": "median"
}
```

Generates DAW-ready templates plus analyzer/release-kit metadata and a downloadable ZIP.

#### Build Release Campaign

```http
GET /api/v1/albums/{album_id}/experience/release-campaign?duration_days=14
```

Returns a day-by-day campaign schedule with channel copy and KPI focus.

#### Generate Audio Preview (MIDI)

```http
POST /api/v1/albums/{album_id}/experience/audio-preview
Content-Type: application/json

{
  "track_numbers": [1, 2, 3],
  "bars_per_chord": 1.5
}
```

Returns a generated MIDI preview path and duration estimate.

#### Template Marketplace

```http
GET /api/v1/experience/templates
POST /api/v1/albums/{album_id}/experience/templates/{template_id}/apply
```

Use templates to seed concept, themes, and optional starter tracks.

#### Collaboration Rooms

```http
POST /api/v1/albums/{album_id}/experience/collab-rooms
GET /api/v1/albums/{album_id}/experience/collab-rooms
GET /api/v1/albums/{album_id}/experience/collab-rooms/{room_id}
POST /api/v1/albums/{album_id}/experience/collab-rooms/{room_id}/join
POST /api/v1/albums/{album_id}/experience/collab-rooms/{room_id}/comments
POST /api/v1/albums/{album_id}/experience/collab-rooms/{room_id}/snapshots
POST /api/v1/albums/{album_id}/experience/collab-rooms/{room_id}/board-items
POST /api/v1/albums/{album_id}/experience/collab-rooms/{room_id}/board-items/{item_id}/vote
WS   /api/v1/albums/{album_id}/experience/collab-rooms/{room_id}/ws?alias=<name>
```

Supports room creation, participants, comments, checkpoint snapshots, shared board voting, and
live presence/typing/edit-lock conflict events via WebSocket.

#### Remix Battles

```http
POST /api/v1/albums/{album_id}/experience/remix-battles
GET  /api/v1/albums/{album_id}/experience/remix-battles
GET  /api/v1/albums/{album_id}/experience/remix-battles/{battle_id}
POST /api/v1/albums/{album_id}/experience/remix-battles/{battle_id}/submissions
POST /api/v1/albums/{album_id}/experience/remix-battles/{battle_id}/submissions/{submission_id}/vote
POST /api/v1/albums/{album_id}/experience/remix-battles/{battle_id}/close
GET  /api/v1/experience/remix-battles/share/{share_slug}
```

Enables public-share remix competitions with ranked submissions and voting.

#### Challenge Mode and Scorecards

```http
GET /api/v1/experience/challenges
GET /api/v1/experience/challenges/weekly
POST /api/v1/albums/{album_id}/experience/challenges/{challenge_id}/run
POST /api/v1/experience/challenges/{challenge_id}/complete
GET /api/v1/experience/challenges/scorecard
GET /api/v1/experience/challenges/leaderboard
```

Enables weekly prompts, streak tracking, progression scorecards, and leaderboard standings.

#### Creator Memory

```http
GET /api/v1/experience/creator-memory
POST /api/v1/experience/creator-memory/preferences
POST /api/v1/experience/creator-memory/events
GET /api/v1/albums/{album_id}/experience/creator-memory/recommendations
```

Persists per-creator preferences/goals, logs workflow events, and returns personalized recommendations.

## Error Responses

All errors follow this format:

```json
{
  "detail": "Error message"
}
```

### Common Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 204 | No Content (successful delete) |
| 400 | Bad Request |
| 404 | Not Found |
| 422 | Validation Error |
| 500 | Internal Server Error |
| 501 | Not Implemented (missing optional deps) |

## Interactive Documentation

When running the API, access interactive docs at:

- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`
- **OpenAPI Schema**: `http://localhost:8000/openapi.json`

## Running the API

```bash
# Development mode with auto-reload
uvicorn album_conceptualizer.api.app:app --reload

# Production mode
uvicorn album_conceptualizer.api.app:app --host 0.0.0.0 --port 8000

# With Docker
docker compose up -d app
```
