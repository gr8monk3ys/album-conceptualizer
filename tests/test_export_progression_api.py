"""Tests for progression export API endpoints (MIDI and MusicXML)."""

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


class TestProgressionMidiExport:
    """Tests for POST /api/v1/export/progression/midi (lines 298-322)."""

    def test_export_progression_midi_basic(self, client):
        """Covers lines 298-322: progression MIDI export with pretty_midi installed."""
        resp = client.post(
            "/api/v1/export/progression/midi",
            json={
                "chords": ["C", "G", "Am", "F"],
                "tempo": 120,
                "bars_per_chord": 1,
            },
        )
        # pretty_midi is installed so should succeed
        assert resp.status_code == 200
        assert resp.headers.get("content-type", "").startswith("audio/midi")

    def test_export_progression_midi_with_title(self, client):
        resp = client.post(
            "/api/v1/export/progression/midi",
            json={
                "chords": ["D", "A", "Bm", "G"],
                "tempo": 90,
                "bars_per_chord": 2,
                "title": "My Progression",
            },
        )
        assert resp.status_code == 200
        # Filename should contain the title
        disposition = resp.headers.get("content-disposition", "")
        assert "my_progression.mid" in disposition

    def test_export_progression_midi_single_chord(self, client):
        resp = client.post(
            "/api/v1/export/progression/midi",
            json={"chords": ["Am"], "tempo": 100},
        )
        assert resp.status_code == 200

    def test_export_progression_midi_without_title_uses_default(self, client):
        resp = client.post(
            "/api/v1/export/progression/midi",
            json={"chords": ["C", "F", "G"], "tempo": 120},
        )
        assert resp.status_code == 200
        disposition = resp.headers.get("content-disposition", "")
        assert "progression.mid" in disposition


class TestProgressionMusicXMLExport:
    """Tests for POST /api/v1/export/progression/musicxml (lines 335-368)."""

    def test_export_progression_musicxml_basic(self, client):
        """Covers lines 335-368: progression MusicXML export with music21 installed."""
        resp = client.post(
            "/api/v1/export/progression/musicxml",
            json={
                "chords": ["C", "G", "Am", "F"],
                "tempo": 120,
            },
        )
        # music21 is installed so should succeed
        assert resp.status_code == 200

    def test_export_progression_musicxml_with_title(self, client):
        resp = client.post(
            "/api/v1/export/progression/musicxml",
            json={
                "chords": ["D", "A", "Bm"],
                "tempo": 80,
                "title": "My Theme",
            },
        )
        assert resp.status_code == 200
        disposition = resp.headers.get("content-disposition", "")
        assert "my_theme.musicxml" in disposition

    def test_export_progression_musicxml_without_title_uses_default(self, client):
        resp = client.post(
            "/api/v1/export/progression/musicxml",
            json={"chords": ["Am", "G", "F", "E"], "tempo": 100},
        )
        assert resp.status_code == 200
        disposition = resp.headers.get("content-disposition", "")
        assert "progression.musicxml" in disposition


class TestGenerateChordProNoSectionName:
    """Covers 77->81: section with no name in generate_chordpro."""

    def test_section_without_name_key_skips_comment_directive(self, client):
        """Covers the FALSE branch of `if name:` at line 77."""
        resp = client.post(
            "/api/v1/export/chordpro",
            json={
                "title": "Nameless Section Song",
                "sections": [
                    {
                        # No "name" key — so section.get("name", "") returns ""
                        "lyrics": "Just some lyrics\nSecond line",
                        "chords": ["C", "G"],
                    }
                ],
            },
        )
        assert resp.status_code == 200
        body = resp.text
        assert "{title: Nameless Section Song}" in body
        # No {comment: ...} directive since name is empty
        assert "{comment:" not in body
        assert "Just some lyrics" in body
