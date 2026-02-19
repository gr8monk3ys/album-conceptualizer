"""Extended tests for songs API endpoints — covers previously uncovered paths."""

import pytest
from fastapi.testclient import TestClient

from album_conceptualizer.api.app import create_app
from album_conceptualizer.config import reset_settings


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_STORAGE_BACKEND", "memory")
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEY", raising=False)
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEYS", raising=False)
    reset_settings()
    app = create_app()
    with TestClient(app) as c:
        yield c
    reset_settings()


def _create_album(client: TestClient, title: str = "Test Album") -> str:
    resp = client.post("/api/v1/albums", json={"title": title, "artist": "Artist"})
    assert resp.status_code == 201
    return resp.json()["id"]


def _create_song(client: TestClient, album_id: str, title: str = "Song", track_number: int = 1) -> str:
    resp = client.post(
        f"/api/v1/albums/{album_id}/songs",
        json={"title": title, "track_number": track_number},
    )
    assert resp.status_code == 201
    return resp.json()["id"]


class TestGetSong:
    def test_get_song_success(self, client):
        album_id = _create_album(client)
        song_id = _create_song(client, album_id)
        resp = client.get(f"/api/v1/albums/{album_id}/songs/{song_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == song_id

    def test_get_song_not_found_returns_404(self, client):
        album_id = _create_album(client)
        resp = client.get(f"/api/v1/albums/{album_id}/songs/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 404

    def test_get_song_nonexistent_album_returns_404(self, client):
        resp = client.get("/api/v1/albums/nonexistent/songs/some-song-id")
        assert resp.status_code == 404


class TestUpdateSong:
    def test_update_song_success(self, client):
        album_id = _create_album(client)
        song_id = _create_song(client, album_id)
        resp = client.patch(
            f"/api/v1/albums/{album_id}/songs/{song_id}",
            json={"title": "Updated Title", "key": "D major"},
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "Updated Title"
        assert resp.json()["key"] == "D major"

    def test_update_song_not_found_returns_404(self, client):
        album_id = _create_album(client)
        resp = client.patch(
            f"/api/v1/albums/{album_id}/songs/00000000-0000-0000-0000-000000000000",
            json={"title": "Nope"},
        )
        assert resp.status_code == 404

    def test_update_song_partial_fields(self, client):
        album_id = _create_album(client)
        song_id = _create_song(client, album_id, title="Original")
        resp = client.patch(
            f"/api/v1/albums/{album_id}/songs/{song_id}",
            json={"tempo": 140},
        )
        assert resp.status_code == 200
        assert resp.json()["tempo"] == 140
        assert resp.json()["title"] == "Original"


class TestDeleteSong:
    def test_delete_song_success(self, client):
        album_id = _create_album(client)
        song_id = _create_song(client, album_id)
        resp = client.delete(f"/api/v1/albums/{album_id}/songs/{song_id}")
        assert resp.status_code == 204
        # Verify song is gone
        get_resp = client.get(f"/api/v1/albums/{album_id}/songs/{song_id}")
        assert get_resp.status_code == 404

    def test_delete_song_not_found_returns_404(self, client):
        album_id = _create_album(client)
        resp = client.delete(
            f"/api/v1/albums/{album_id}/songs/00000000-0000-0000-0000-000000000000"
        )
        assert resp.status_code == 404


class TestAddSection:
    def test_add_section_success(self, client):
        album_id = _create_album(client)
        song_id = _create_song(client, album_id)
        resp = client.post(
            f"/api/v1/albums/{album_id}/songs/{song_id}/sections",
            json={
                "section_type": "verse",
                "order": 1,
                "lyrics": "Hello world",
                "chord_progression": ["G", "C", "D"],
            },
        )
        assert resp.status_code == 201

    def test_add_section_invalid_type_falls_back_to_other(self, client):
        """Invalid section_type falls back to SectionType.OTHER."""
        album_id = _create_album(client)
        song_id = _create_song(client, album_id)
        resp = client.post(
            f"/api/v1/albums/{album_id}/songs/{song_id}/sections",
            json={
                "section_type": "completely_invalid_type",
                "order": 1,
                "lyrics": "Some lyrics",
            },
        )
        assert resp.status_code == 201

    def test_add_section_song_not_found_returns_404(self, client):
        album_id = _create_album(client)
        resp = client.post(
            f"/api/v1/albums/{album_id}/songs/00000000-0000-0000-0000-000000000000/sections",
            json={"section_type": "verse", "order": 1},
        )
        assert resp.status_code == 404


class TestCreateSongWithInvalidSectionType:
    def test_create_song_with_invalid_section_type(self, client):
        """Invalid section_type in song creation falls back to OTHER."""
        album_id = _create_album(client)
        resp = client.post(
            f"/api/v1/albums/{album_id}/songs",
            json={
                "title": "Song",
                "track_number": 1,
                "sections": [
                    {
                        "section_type": "totally_fake_type",
                        "order": 1,
                        "lyrics": "Lyrics here",
                        "chord_progression": [],
                    }
                ],
            },
        )
        assert resp.status_code == 201


class TestReorderSong:
    def _setup_three_songs(self, client) -> tuple[str, str, str, str]:
        """Return (album_id, song1_id, song2_id, song3_id)."""
        album_id = _create_album(client, "Reorder Album")
        s1 = _create_song(client, album_id, "Song 1", 1)
        s2 = _create_song(client, album_id, "Song 2", 2)
        s3 = _create_song(client, album_id, "Song 3", 3)
        return album_id, s1, s2, s3

    def test_reorder_song_not_found_returns_404(self, client):
        album_id = _create_album(client)
        resp = client.put(
            f"/api/v1/albums/{album_id}/songs/00000000-0000-0000-0000-000000000000/reorder",
            params={"new_track_number": 1},
        )
        assert resp.status_code == 404

    def test_reorder_song_move_down(self, client):
        """Move song from position 1 to position 3 (moving down)."""
        album_id, s1, s2, s3 = self._setup_three_songs(client)
        resp = client.put(
            f"/api/v1/albums/{album_id}/songs/{s1}/reorder",
            params={"new_track_number": 3},
        )
        assert resp.status_code == 200
        # Song 1 is now at position 3
        assert resp.json()["track_number"] == 3

    def test_reorder_song_move_up(self, client):
        """Move song from position 3 to position 1 (moving up)."""
        album_id, s1, s2, s3 = self._setup_three_songs(client)
        resp = client.put(
            f"/api/v1/albums/{album_id}/songs/{s3}/reorder",
            params={"new_track_number": 1},
        )
        assert resp.status_code == 200
        assert resp.json()["track_number"] == 1

    def test_reorder_song_same_position(self, client):
        """Moving to same position should not error."""
        album_id, s1, s2, s3 = self._setup_three_songs(client)
        resp = client.put(
            f"/api/v1/albums/{album_id}/songs/{s2}/reorder",
            params={"new_track_number": 2},
        )
        assert resp.status_code == 200
        assert resp.json()["track_number"] == 2
