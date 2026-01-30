"""Tests for the FastAPI REST API."""

import pytest
from fastapi.testclient import TestClient

from album_conceptualizer.api.app import create_app


@pytest.fixture
def client():
    """Create a test client."""
    app = create_app()
    return TestClient(app)


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
