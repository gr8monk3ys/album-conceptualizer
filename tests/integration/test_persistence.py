"""Integration tests verifying data persists across requests with the SQLite backend."""

import pytest


@pytest.mark.integration
class TestSQLitePersistence:
    """Data written in one request survives subsequent requests."""

    def test_album_persists_between_requests(self, sqlite_client):
        response = sqlite_client.post(
            "/api/v1/albums",
            json={"title": "Persistent Album", "artist": "Test Artist"},
        )
        assert response.status_code == 201
        album_id = response.json()["id"]

        get_response = sqlite_client.get(f"/api/v1/albums/{album_id}")
        assert get_response.status_code == 200
        assert get_response.json()["title"] == "Persistent Album"

    def test_songs_persist_with_album(self, sqlite_client):
        album_id = sqlite_client.post(
            "/api/v1/albums",
            json={"title": "Song Album", "artist": "Artist"},
        ).json()["id"]

        for i in range(1, 3):
            sqlite_client.post(
                f"/api/v1/albums/{album_id}/songs",
                json={"title": f"Track {i}", "track_number": i},
            )

        songs = sqlite_client.get(f"/api/v1/albums/{album_id}/songs").json()
        assert songs["total"] == 2

    def test_bible_persists_with_album(self, sqlite_client):
        album_id = sqlite_client.post(
            "/api/v1/albums",
            json={"title": "Bible Album", "artist": "Artist"},
        ).json()["id"]

        sqlite_client.put(
            f"/api/v1/albums/{album_id}/bible",
            json={
                "logline": "A story about persistence.",
                "synopsis": "Data that survives restarts.",
                "setting": "SQLite land",
            },
        )

        bible = sqlite_client.get(f"/api/v1/albums/{album_id}/bible").json()
        assert bible["logline"] == "A story about persistence."
        assert bible["setting"] == "SQLite land"

    def test_delete_removes_album_permanently(self, sqlite_client):
        album_id = sqlite_client.post(
            "/api/v1/albums",
            json={"title": "To Be Deleted", "artist": "Artist"},
        ).json()["id"]

        sqlite_client.delete(f"/api/v1/albums/{album_id}")

        assert sqlite_client.get(f"/api/v1/albums/{album_id}").status_code == 404

    def test_multiple_albums_are_isolated(self, sqlite_client):
        album_ids = []
        for i in range(3):
            resp = sqlite_client.post(
                "/api/v1/albums",
                json={"title": f"Album {i}", "artist": f"Artist {i}"},
            )
            album_ids.append(resp.json()["id"])

        assert sqlite_client.get("/api/v1/albums").json()["total"] == 3

        for i, album_id in enumerate(album_ids):
            resp = sqlite_client.get(f"/api/v1/albums/{album_id}")
            assert resp.status_code == 200
            assert resp.json()["title"] == f"Album {i}"

    def test_album_update_persists(self, sqlite_client):
        album_id = sqlite_client.post(
            "/api/v1/albums",
            json={"title": "Old Title", "artist": "Artist"},
        ).json()["id"]

        sqlite_client.patch(
            f"/api/v1/albums/{album_id}",
            json={"title": "New Title"},
        )

        fetched = sqlite_client.get(f"/api/v1/albums/{album_id}").json()
        assert fetched["title"] == "New Title"

    def test_song_sections_persist(self, sqlite_client):
        album_id = sqlite_client.post(
            "/api/v1/albums",
            json={"title": "Sections Album", "artist": "Artist"},
        ).json()["id"]

        song_id = sqlite_client.post(
            f"/api/v1/albums/{album_id}/songs",
            json={
                "title": "Structured Song",
                "track_number": 1,
                "sections": [
                    {
                        "section_type": "verse",
                        "order": 1,
                        "lyrics": "Persisted verse",
                        "chord_progression": ["C", "G", "Am", "F"],
                    },
                    {
                        "section_type": "chorus",
                        "order": 2,
                        "lyrics": "Persisted chorus",
                        "chord_progression": ["F", "G", "C"],
                    },
                ],
            },
        ).json()["id"]

        songs = sqlite_client.get(f"/api/v1/albums/{album_id}/songs").json()
        song = next(s for s in songs["items"] if s["id"] == song_id)
        assert len(song["sections"]) == 2
        assert song["sections"][0]["lyrics"] == "Persisted verse"
