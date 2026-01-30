# REST API Reference

Album Conceptualizer provides a RESTful API for programmatic access.

## Base URL

```
http://localhost:8000/api/v1
```

## Authentication

Currently, the API does not require authentication. For production deployments,
implement OAuth2 or API key authentication.

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
