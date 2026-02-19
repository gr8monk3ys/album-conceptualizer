"""Integration tests covering the full album creation and management lifecycle."""

import pytest


@pytest.mark.integration
class TestAlbumCreationWorkflow:
    """Full album workflow: metadata → songs → bible → export."""

    def test_create_album_with_rich_metadata(self, client):
        resp = client.post(
            "/api/v1/albums",
            json={
                "title": "Lifecycle Album",
                "artist": "The Lifecycle Band",
                "primary_genre": "Indie",
                "concept_summary": "A journey through time",
                "central_themes": ["nostalgia", "change"],
            },
        )
        assert resp.status_code == 201
        album = resp.json()
        assert album["title"] == "Lifecycle Album"
        assert album["primary_genre"] == "Indie"
        assert "id" in album

    def test_add_multiple_songs_then_list(self, client):
        album_id = client.post(
            "/api/v1/albums",
            json={"title": "Multi-Song Album", "artist": "Artist"},
        ).json()["id"]

        for i in range(1, 4):
            resp = client.post(
                f"/api/v1/albums/{album_id}/songs",
                json={
                    "title": f"Track {i}",
                    "track_number": i,
                    "key": "C major",
                    "tempo": 120 + i * 5,
                    "sections": [
                        {
                            "section_type": "verse",
                            "order": 1,
                            "lyrics": f"Verse of track {i}",
                            "chord_progression": ["C", "G", "Am", "F"],
                        },
                        {
                            "section_type": "chorus",
                            "order": 2,
                            "lyrics": f"Chorus of track {i}",
                            "chord_progression": ["F", "G", "C"],
                        },
                    ],
                },
            )
            assert resp.status_code == 201

        songs = client.get(f"/api/v1/albums/{album_id}/songs").json()
        assert songs["total"] == 3

    def test_full_bible_workflow(self, client):
        album_id = client.post(
            "/api/v1/albums",
            json={"title": "Bible Album", "artist": "Narrator"},
        ).json()["id"]

        client.put(
            f"/api/v1/albums/{album_id}/bible",
            json={
                "logline": "A tale of two cities.",
                "synopsis": "Long-form story arc.",
                "setting": "Victorian London",
            },
        )
        client.post(
            f"/api/v1/albums/{album_id}/bible/themes",
            json={"name": "Duality", "description": "Light and dark", "primary_songs": [1]},
        )
        client.post(
            f"/api/v1/albums/{album_id}/bible/characters",
            json={
                "name": "The Narrator",
                "role": "protagonist",
                "description": "An unreliable voice",
                "appears_in": [1, 2],
            },
        )
        client.post(
            f"/api/v1/albums/{album_id}/bible/motifs",
            json={
                "name": "Fog",
                "motif_type": "lyrical",
                "description": "Obscured truth",
                "appearances": [{"track_number": 1}],
            },
        )

        bible = client.get(f"/api/v1/albums/{album_id}/bible").json()
        assert bible["logline"] == "A tale of two cities."
        assert len(bible["themes"]) == 1
        assert len(bible["characters"]) == 1
        assert len(bible["motifs"]) == 1

    def test_update_album_metadata_reflects_immediately(self, client):
        album_id = client.post(
            "/api/v1/albums",
            json={"title": "Original Title", "artist": "Original Artist"},
        ).json()["id"]

        updated = client.patch(
            f"/api/v1/albums/{album_id}",
            json={"title": "Updated Title", "primary_genre": "Jazz"},
        ).json()

        assert updated["title"] == "Updated Title"
        assert updated["primary_genre"] == "Jazz"

        fetched = client.get(f"/api/v1/albums/{album_id}").json()
        assert fetched["title"] == "Updated Title"
        assert fetched["primary_genre"] == "Jazz"

    def test_reorder_song_within_album(self, client):
        album_id = client.post(
            "/api/v1/albums",
            json={"title": "Reorder Album", "artist": "Artist"},
        ).json()["id"]

        song1_id = client.post(
            f"/api/v1/albums/{album_id}/songs",
            json={"title": "First Song", "track_number": 1},
        ).json()["id"]
        client.post(
            f"/api/v1/albums/{album_id}/songs",
            json={"title": "Second Song", "track_number": 2},
        )

        resp = client.put(
            f"/api/v1/albums/{album_id}/songs/{song1_id}/reorder",
            params={"new_track_number": 2},
        )
        assert resp.status_code == 200
        assert resp.json()["track_number"] == 2

    def test_export_album_chordpro_contains_song_content(self, client):
        album_id = client.post(
            "/api/v1/albums",
            json={"title": "Export Album", "artist": "Band"},
        ).json()["id"]

        client.post(
            f"/api/v1/albums/{album_id}/songs",
            json={
                "title": "ChordPro Song",
                "track_number": 1,
                "key": "G",
                "sections": [
                    {
                        "section_type": "verse",
                        "order": 1,
                        "lyrics": "Walk on the wild side",
                        "chord_progression": ["G", "C", "D"],
                    }
                ],
            },
        )

        resp = client.get(f"/api/v1/export/album/{album_id}/chordpro")
        assert resp.status_code == 200
        assert "ChordPro Song" in resp.text
        assert "Walk on the wild side" in resp.text

    def test_delete_album_cascades_to_songs(self, client):
        album_id = client.post(
            "/api/v1/albums",
            json={"title": "Doomed Album", "artist": "Artist"},
        ).json()["id"]

        client.post(
            f"/api/v1/albums/{album_id}/songs",
            json={"title": "Song", "track_number": 1},
        )

        assert client.delete(f"/api/v1/albums/{album_id}").status_code == 204
        assert client.get(f"/api/v1/albums/{album_id}").status_code == 404
        assert client.get(f"/api/v1/albums/{album_id}/songs").status_code == 404


@pytest.mark.integration
class TestAlbumListingAndPagination:
    """List endpoint behaviour with multiple albums."""

    def test_empty_library_returns_zero_total(self, client):
        data = client.get("/api/v1/albums").json()
        assert data["total"] == 0
        assert data["items"] == []

    def test_five_albums_all_listed(self, client):
        for i in range(5):
            client.post(
                "/api/v1/albums",
                json={"title": f"Album {i}", "artist": "Artist"},
            )

        data = client.get("/api/v1/albums").json()
        assert data["total"] == 5
        assert len(data["items"]) == 5

    def test_nonexistent_album_returns_404(self, client):
        resp = client.get("/api/v1/albums/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 404


@pytest.mark.integration
class TestMusicTheoryWorkflow:
    """Theory endpoints work end-to-end and return structured data."""

    def test_analyze_chord_then_get_scale(self, client):
        chord = client.post(
            "/api/v1/theory/chord/analyze",
            json={"symbol": "Am7"},
        ).json()
        assert chord["root"] == "A"
        assert chord["quality"] == "minor_7"

        scale = client.get("/api/v1/theory/scale?root=A&scale_type=natural_minor").json()
        assert scale["root"] == "A"
        assert "A" in scale["notes"]

    def test_key_analysis_contains_diatonic_chords(self, client):
        data = client.get("/api/v1/theory/key/G/major").json()
        assert data["tonic"] == "G"
        assert len(data["diatonic_chords"]) > 0
        assert "common_progressions" in data
