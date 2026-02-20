"""Tests for the FastAPI REST API."""

import pytest
from fastapi.testclient import TestClient

from album_conceptualizer.api.app import create_app
from album_conceptualizer.config import reset_settings


@pytest.fixture
def client(monkeypatch):
    """Create a test client."""
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_STORAGE_BACKEND", "memory")
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEY", raising=False)
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEYS", raising=False)
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_STRICT_PRODUCTION", raising=False)
    reset_settings()
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client
    reset_settings()


class TestHealthEndpoints:
    """Tests for health check endpoints."""

    def test_health_check(self, client):
        """Test /api/v1/health endpoint."""
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        assert "version" in data

    def test_liveness_check(self, client):
        """Test /api/v1/live endpoint."""
        response = client.get("/api/v1/live")
        assert response.status_code == 200
        assert response.json()["status"] == "alive"

    def test_readiness_check(self, client):
        """Test /api/v1/ready endpoint."""
        response = client.get("/api/v1/ready")
        assert response.status_code == 200
        data = response.json()
        assert "ready" in data
        assert "checks" in data

    def test_readiness_default_mode_ignores_optional_dependencies(self, client):
        """Default readiness gates only required production checks."""
        response = client.get("/api/v1/ready")
        assert response.status_code == 200
        payload = response.json()
        assert payload["strict_mode"] is False
        assert payload["ready"] is True
        assert payload["required_checks"]["api"] is True
        assert payload["optional_checks"]["vector_store"] is False
        assert payload["optional_checks"]["llm"] is False

    def test_readiness_strict_mode_requires_optional_dependencies(self, client):
        """Strict readiness requires LLM and vector dependencies to be ready."""
        response = client.get("/api/v1/ready?strict=true")
        assert response.status_code == 200
        payload = response.json()
        assert payload["strict_mode"] is True
        assert payload["ready"] is False

    def test_metrics_snapshot_contains_duration_fields(self, client):
        """Test /api/v1/metrics JSON includes latency aggregates."""
        client.get("/api/v1/health")
        response = client.get("/api/v1/metrics")
        assert response.status_code == 200
        payload = response.json()
        assert "request_count" in payload
        assert "total_duration_ms" in payload
        assert "avg_duration_ms" in payload
        assert "path_duration_ms" in payload

    def test_metrics_prometheus_contains_duration_series(self, client):
        """Test Prometheus text output includes duration counters."""
        client.get("/api/v1/health")
        response = client.get("/api/v1/metrics", params={"format": "prometheus"})
        assert response.status_code == 200
        body = response.text
        assert "album_conceptualizer_request_duration_ms_sum" in body
        assert "album_conceptualizer_request_duration_ms_avg" in body


class TestAlbumEndpoints:
    """Tests for album CRUD endpoints."""

    def test_create_album(self, client):
        """Test creating an album."""
        response = client.post(
            "/api/v1/albums",
            json={
                "title": "Test Album",
                "artist": "Test Artist",
                "concept_summary": "A test concept",
                "primary_genre": "Rock",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Test Album"
        assert data["artist"] == "Test Artist"
        assert "id" in data

    def test_list_albums(self, client):
        """Test listing albums."""
        # Create an album first
        client.post(
            "/api/v1/albums",
            json={"title": "Album 1", "artist": "Artist 1"},
        )

        response = client.get("/api/v1/albums")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert data["total"] >= 1

    def test_get_album(self, client):
        """Test getting a specific album."""
        # Create an album
        create_response = client.post(
            "/api/v1/albums",
            json={"title": "Get Test", "artist": "Artist"},
        )
        album_id = create_response.json()["id"]

        # Get it
        response = client.get(f"/api/v1/albums/{album_id}")
        assert response.status_code == 200
        assert response.json()["title"] == "Get Test"

    def test_get_album_not_found(self, client):
        """Test getting non-existent album."""
        response = client.get("/api/v1/albums/nonexistent-id")
        assert response.status_code == 404

    def test_update_album(self, client):
        """Test updating an album."""
        # Create
        create_response = client.post(
            "/api/v1/albums",
            json={"title": "Original Title", "artist": "Artist"},
        )
        album_id = create_response.json()["id"]

        # Update
        response = client.patch(
            f"/api/v1/albums/{album_id}",
            json={"title": "Updated Title"},
        )
        assert response.status_code == 200
        assert response.json()["title"] == "Updated Title"

    def test_delete_album(self, client):
        """Test deleting an album."""
        # Create
        create_response = client.post(
            "/api/v1/albums",
            json={"title": "To Delete", "artist": "Artist"},
        )
        album_id = create_response.json()["id"]

        # Delete
        response = client.delete(f"/api/v1/albums/{album_id}")
        assert response.status_code == 204

        # Verify deleted
        get_response = client.get(f"/api/v1/albums/{album_id}")
        assert get_response.status_code == 404


class TestSongEndpoints:
    """Tests for song endpoints."""

    @pytest.fixture
    def album_id(self, client):
        """Create an album and return its ID."""
        response = client.post(
            "/api/v1/albums",
            json={"title": "Song Test Album", "artist": "Artist"},
        )
        return response.json()["id"]

    def test_create_song(self, client, album_id):
        """Test creating a song."""
        response = client.post(
            f"/api/v1/albums/{album_id}/songs",
            json={
                "title": "Test Song",
                "track_number": 1,
                "key": "C major",
                "tempo": 120,
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Test Song"
        assert data["track_number"] == 1

    def test_list_songs(self, client, album_id):
        """Test listing songs in an album."""
        # Create a song
        client.post(
            f"/api/v1/albums/{album_id}/songs",
            json={"title": "Song 1", "track_number": 1},
        )

        response = client.get(f"/api/v1/albums/{album_id}/songs")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1

    def test_create_song_with_sections(self, client, album_id):
        """Test creating a song with sections."""
        response = client.post(
            f"/api/v1/albums/{album_id}/songs",
            json={
                "title": "Full Song",
                "track_number": 1,
                "sections": [
                    {
                        "section_type": "verse",
                        "order": 1,
                        "lyrics": "First verse lyrics",
                        "chord_progression": ["C", "G", "Am", "F"],
                    },
                    {
                        "section_type": "chorus",
                        "order": 2,
                        "lyrics": "Chorus lyrics",
                        "chord_progression": ["F", "G", "C"],
                    },
                ],
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert len(data["sections"]) == 2

    def test_update_song_not_found(self, client, album_id):
        """Updating a missing song should return 404."""
        response = client.patch(
            f"/api/v1/albums/{album_id}/songs/does-not-exist",
            json={"title": "Updated"},
        )
        assert response.status_code == 404

    def test_add_section_endpoint(self, client, album_id):
        """Test adding a section to an existing song."""
        song_resp = client.post(
            f"/api/v1/albums/{album_id}/songs",
            json={"title": "Section Song", "track_number": 1},
        )
        song_id = song_resp.json()["id"]

        response = client.post(
            f"/api/v1/albums/{album_id}/songs/{song_id}/sections",
            json={
                "section_type": "verse",
                "order": 1,
                "lyrics": "Line 1",
                "chord_progression": ["C", "G", "Am", "F"],
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["section_type"] == "verse"
        assert data["order"] == 1

    def test_reorder_song_endpoint(self, client, album_id):
        """Test changing track order for a song."""
        song_1 = client.post(
            f"/api/v1/albums/{album_id}/songs",
            json={"title": "Song 1", "track_number": 1},
        ).json()
        client.post(
            f"/api/v1/albums/{album_id}/songs",
            json={"title": "Song 2", "track_number": 2},
        )

        response = client.put(
            f"/api/v1/albums/{album_id}/songs/{song_1['id']}/reorder",
            params={"new_track_number": 2},
        )
        assert response.status_code == 200
        assert response.json()["track_number"] == 2


class TestTheoryEndpoints:
    """Tests for music theory endpoints."""

    def test_analyze_chord(self, client):
        """Test chord analysis."""
        response = client.post(
            "/api/v1/theory/chord/analyze",
            json={"symbol": "Am7"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["root"] == "A"
        assert data["quality"] == "minor_7"

    def test_get_scale(self, client):
        """Test scale generation."""
        response = client.get("/api/v1/theory/scale?root=C&scale_type=major")
        assert response.status_code == 200
        data = response.json()
        assert data["root"] == "C"
        assert data["notes"] == ["C", "D", "E", "F", "G", "A", "B"]

    def test_analyze_key(self, client):
        """Test key analysis."""
        response = client.get("/api/v1/theory/key/C/major")
        assert response.status_code == 200
        data = response.json()
        assert data["tonic"] == "C"
        assert "diatonic_chords" in data
        assert "common_progressions" in data

    def test_list_scale_types(self, client):
        """Test listing scale types."""
        response = client.get("/api/v1/theory/scale/types")
        assert response.status_code == 200
        data = response.json()
        assert "major" in data
        assert "natural_minor" in data


class TestExportEndpoints:
    """Tests for export endpoints."""

    def test_list_export_formats(self, client):
        """Test listing available export formats."""
        response = client.get("/api/v1/export/formats")
        assert response.status_code == 200
        data = response.json()
        assert "chordpro" in data
        assert data["chordpro"]["available"] is True

    def test_generate_chordpro(self, client):
        """Test generating ChordPro format."""
        response = client.post(
            "/api/v1/export/chordpro",
            json={
                "title": "Test Song",
                "artist": "Test Artist",
                "key": "G",
                "sections": [
                    {"name": "Verse", "lyrics": "Hello world", "chords": ["G", "C"]},
                ],
            },
        )
        assert response.status_code == 200
        assert "{title: Test Song}" in response.text
        assert "{key: G}" in response.text

    def test_export_album_chordpro(self, client):
        """Test exporting album songs as ChordPro."""
        album = client.post(
            "/api/v1/albums",
            json={"title": "Export Album", "artist": "Band"},
        ).json()
        album_id = album["id"]
        client.post(
            f"/api/v1/albums/{album_id}/songs",
            json={
                "title": "Export Song",
                "track_number": 1,
                "sections": [
                    {
                        "section_type": "verse",
                        "order": 1,
                        "lyrics": "Hello world",
                        "chord_progression": ["C", "G", "Am", "F"],
                    }
                ],
            },
        )

        response = client.get(f"/api/v1/export/album/{album_id}/chordpro")
        assert response.status_code == 200
        assert "{title: Export Song}" in response.text
        assert "Hello world" in response.text


class TestBibleEndpoints:
    """Tests for bible subresource endpoints."""

    @pytest.fixture
    def album_id(self, client):
        response = client.post(
            "/api/v1/albums",
            json={"title": "Bible Album", "artist": "Artist"},
        )
        return response.json()["id"]

    def test_add_theme(self, client, album_id):
        response = client.post(
            f"/api/v1/albums/{album_id}/bible/themes",
            json={
                "name": "Identity",
                "description": "Who we become",
                "primary_songs": [1],
            },
        )
        assert response.status_code == 201
        assert response.json()["name"] == "Identity"

    def test_add_character(self, client, album_id):
        response = client.post(
            f"/api/v1/albums/{album_id}/bible/characters",
            json={
                "name": "Narrator",
                "role": "protagonist",
                "description": "Main voice",
                "appears_in": [1, 2],
            },
        )
        assert response.status_code == 201
        assert response.json()["name"] == "Narrator"

    def test_add_motif(self, client, album_id):
        response = client.post(
            f"/api/v1/albums/{album_id}/bible/motifs",
            json={
                "name": "Clock",
                "motif_type": "lyrical",
                "description": "Passage of time",
                "appearances": [{"track_number": 1}],
            },
        )
        assert response.status_code == 201
        assert response.json()["name"] == "Clock"
