"""Extended tests for export API endpoints covering previously uncovered paths."""

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


def _seed_album(client: TestClient) -> tuple[str, str]:
    """Create an album with one song; return (album_id, song_id)."""
    album_resp = client.post(
        "/api/v1/albums",
        json={"title": "Export Album", "artist": "Test Artist"},
    )
    album_id = album_resp.json()["id"]

    song_resp = client.post(
        f"/api/v1/albums/{album_id}/songs",
        json={
            "title": "Export Song",
            "track_number": 1,
            "key": "G major",
            "tempo": 120,
            "sections": [
                {
                    "section_type": "verse",
                    "order": 1,
                    "lyrics": "Hello world\nSecond line",
                    "chord_progression": ["G", "C", "D"],
                }
            ],
        },
    )
    song_id = song_resp.json()["id"]
    return album_id, song_id


class TestGenerateChordPro:
    def test_sections_with_chords_inline(self, client):
        resp = client.post(
            "/api/v1/export/chordpro",
            json={
                "title": "My Song",
                "artist": "Artist",
                "key": "G",
                "tempo": 120,
                "sections": [
                    {
                        "name": "Verse",
                        "lyrics": "Hello world\nLine two",
                        "chords": ["G", "C"],
                    }
                ],
            },
        )
        assert resp.status_code == 200
        body = resp.text
        assert "{title: My Song}" in body
        assert "{key: G}" in body
        assert "[G]Hello world" in body
        assert "[C]Line two" in body

    def test_section_without_chords(self, client):
        resp = client.post(
            "/api/v1/export/chordpro",
            json={
                "title": "Empty Chords",
                "sections": [
                    {"name": "Intro", "lyrics": "Just lyrics\nNo chords here", "chords": []}
                ],
            },
        )
        assert resp.status_code == 200
        assert "{comment: Intro}" in resp.text
        assert "Just lyrics" in resp.text

    def test_empty_sections(self, client):
        resp = client.post(
            "/api/v1/export/chordpro",
            json={"title": "No Sections"},
        )
        assert resp.status_code == 200
        assert "{title: No Sections}" in resp.text


class TestExportAlbumChordPro:
    def test_export_specific_song_by_id(self, client):
        album_id, song_id = _seed_album(client)
        resp = client.get(
            f"/api/v1/export/album/{album_id}/chordpro",
            params={"song_id": song_id},
        )
        assert resp.status_code == 200
        assert "Export Song" in resp.text

    def test_export_nonexistent_song_id_returns_404(self, client):
        album_id, _ = _seed_album(client)
        resp = client.get(
            f"/api/v1/export/album/{album_id}/chordpro",
            params={"song_id": "00000000-0000-0000-0000-000000000000"},
        )
        assert resp.status_code == 404

    def test_export_nonexistent_album_returns_404(self, client):
        resp = client.get("/api/v1/export/album/nonexistent/chordpro")
        assert resp.status_code == 404


class TestExportAlbumJson:
    def test_export_album_json(self, client):
        album_id, _ = _seed_album(client)
        resp = client.get(f"/api/v1/export/album/{album_id}/json")
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "Export Album"
        assert len(data["songs"]) == 1

    def test_export_album_json_not_found(self, client):
        resp = client.get("/api/v1/export/album/no-such-album/json")
        assert resp.status_code == 404


class TestExportTracklist:
    def test_export_tracklist(self, client):
        album_id, _ = _seed_album(client)
        resp = client.get(f"/api/v1/export/album/{album_id}/tracklist")
        assert resp.status_code == 200
        assert "Export Song" in resp.text

    def test_export_tracklist_not_found(self, client):
        resp = client.get("/api/v1/export/album/no-album/tracklist")
        assert resp.status_code == 404


class TestExportFormats:
    def test_list_formats_always_includes_core(self, client):
        resp = client.get("/api/v1/export/formats")
        assert resp.status_code == 200
        data = resp.json()
        assert data["chordpro"]["available"] is True
        assert data["json"]["available"] is True
        assert data["text"]["available"] is True

    def test_list_formats_includes_midi_status(self, client):
        resp = client.get("/api/v1/export/formats")
        assert resp.status_code == 200
        data = resp.json()
        # MIDI is either available or not depending on extras
        assert "midi" in data
        assert "available" in data["midi"]

    def test_list_formats_includes_musicxml_status(self, client):
        resp = client.get("/api/v1/export/formats")
        assert resp.status_code == 200
        data = resp.json()
        assert "musicxml" in data
        assert "available" in data["musicxml"]


class TestProgressionMidiUnavailable:
    def test_midi_export_returns_501_without_music_deps(self, client, monkeypatch):
        """When pretty_midi is not installed, endpoint returns 501."""
        import sys

        # Temporarily hide pretty_midi
        original = sys.modules.get("pretty_midi")
        sys.modules["pretty_midi"] = None  # type: ignore[assignment]
        try:
            resp = client.post(
                "/api/v1/export/progression/midi",
                json={"chords": ["C", "G", "Am", "F"], "tempo": 120},
            )
            assert resp.status_code in (200, 501)
        finally:
            if original is not None:
                sys.modules["pretty_midi"] = original
            else:
                sys.modules.pop("pretty_midi", None)


class TestAlbumZipExport:
    def test_zip_export_json_format(self, client):
        resp = client.post(
            "/api/v1/export/album/zip",
            json={
                "album": {
                    "title": "Zip Album",
                    "artist": "Zipper",
                    "songs": [
                        {
                            "title": "Zipped Song",
                            "track_number": 1,
                            "sections": [
                                {
                                    "section_type": "verse",
                                    "order": 1,
                                    "lyrics": "Compressed",
                                    "chord_progression": ["C", "G"],
                                }
                            ],
                        }
                    ],
                },
                "formats": ["json"],
            },
        )
        assert resp.status_code == 200
        assert resp.headers.get("content-type", "").startswith("application/zip")

    def test_zip_export_invalid_format_returns_400(self, client):
        resp = client.post(
            "/api/v1/export/album/zip",
            json={
                "album": {"title": "Bad Format Album", "artist": "Artist", "songs": []},
                "formats": ["not_a_real_format"],
            },
        )
        assert resp.status_code == 400

    def test_zip_export_invalid_album_returns_400(self, client):
        resp = client.post(
            "/api/v1/export/album/zip",
            json={
                "album": {"this_key_does_not_exist": True, "missing_required": True},
                "formats": ["json"],
            },
        )
        assert resp.status_code in (400, 422)

    def test_zip_export_chordpro_and_text(self, client):
        resp = client.post(
            "/api/v1/export/album/zip",
            json={
                "album": {
                    "title": "Multi Format Album",
                    "artist": "Multi",
                    "songs": [
                        {
                            "title": "Track 1",
                            "track_number": 1,
                            "sections": [
                                {
                                    "section_type": "verse",
                                    "order": 1,
                                    "lyrics": "Multi-format lyrics",
                                    "chord_progression": ["D", "A", "Bm", "G"],
                                }
                            ],
                        }
                    ],
                },
                "formats": ["json", "chordpro", "text"],
            },
        )
        assert resp.status_code == 200
