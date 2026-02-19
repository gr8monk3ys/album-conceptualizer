"""Extended tests for music theory endpoints covering previously uncovered paths."""

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


class TestProgressionAnalysisEndpoint:
    """Tests for POST /api/v1/theory/progression/analyze."""

    def test_analyze_with_key_returns_roman_numerals(self, client):
        resp = client.post(
            "/api/v1/theory/progression/analyze",
            json={"chords": ["C", "G", "Am", "F"], "key": "C major"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["key"] == "C major"
        assert len(data["roman_numerals"]) == 4
        assert data["roman_numerals"][0] == "I"  # C in C major
        assert data["roman_numerals"][1] == "V"  # G in C major

    def test_analyze_minor_chord_lowercased(self, client):
        resp = client.post(
            "/api/v1/theory/progression/analyze",
            json={"chords": ["Am", "F", "C", "G"], "key": "C major"},
        )
        assert resp.status_code == 200
        data = resp.json()
        # Am is the vi chord → should be lowercase
        assert data["roman_numerals"][0] == "vi"

    def test_analyze_without_key_returns_question_marks(self, client):
        resp = client.post(
            "/api/v1/theory/progression/analyze",
            json={"chords": ["C", "G", "Am", "F"]},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["key"] is None
        assert all(n == "?" for n in data["roman_numerals"])
        assert "No key specified" in data["analysis"]

    def test_analyze_unknown_root_returns_question_mark(self, client):
        resp = client.post(
            "/api/v1/theory/progression/analyze",
            json={"chords": ["Xx"], "key": "C major"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["roman_numerals"][0] == "?"

    def test_analyze_invalid_key_falls_back_gracefully(self, client):
        resp = client.post(
            "/api/v1/theory/progression/analyze",
            json={"chords": ["C", "G"], "key": "Z invalid"},
        )
        assert resp.status_code == 200

    def test_analyze_empty_progression(self, client):
        resp = client.post(
            "/api/v1/theory/progression/analyze",
            json={"chords": [], "key": "C major"},
        )
        assert resp.status_code == 200
        assert resp.json()["roman_numerals"] == []


class TestChordSuggestionEndpoint:
    """Tests for GET /api/v1/theory/progression/suggest."""

    def test_suggest_pop_style(self, client):
        resp = client.get("/api/v1/theory/progression/suggest?current=C&style=pop")
        assert resp.status_code == 200
        data = resp.json()
        assert data["current_chord"] == "C"
        assert len(data["suggestions"]) > 0
        assert "pop" in data["context"].lower() or "Pop" in data["context"]

    def test_suggest_jazz_style(self, client):
        resp = client.get("/api/v1/theory/progression/suggest?current=Cmaj7&style=jazz")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["suggestions"]) > 0
        assert "jazz" in data["context"].lower() or "Jazz" in data["context"]

    def test_suggest_rock_style(self, client):
        resp = client.get("/api/v1/theory/progression/suggest?current=G&style=rock")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["suggestions"]) > 0
        assert "rock" in data["context"].lower() or "Rock" in data["context"]

    def test_suggest_classical_style(self, client):
        resp = client.get("/api/v1/theory/progression/suggest?current=G&style=classical")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["suggestions"]) > 0
        assert "Classical" in data["context"] or "classical" in data["context"]

    def test_suggest_unknown_style_falls_back(self, client):
        resp = client.get("/api/v1/theory/progression/suggest?current=C&style=bluegrass")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["suggestions"]) > 0

    def test_suggest_with_key_context(self, client):
        resp = client.get(
            "/api/v1/theory/progression/suggest?current=C&key=C+major&style=pop"
        )
        assert resp.status_code == 200


class TestChordQualitiesEndpoint:
    """Tests for GET /api/v1/theory/chord/qualities."""

    def test_list_chord_qualities_returns_all(self, client):
        resp = client.get("/api/v1/theory/chord/qualities")
        assert resp.status_code == 200
        qualities = resp.json()
        assert isinstance(qualities, list)
        assert len(qualities) >= 10
        assert "major" in qualities
        assert "minor" in qualities
        assert "dominant_7" in qualities

    def test_invalid_scale_type_falls_back_to_major(self, client):
        resp = client.get("/api/v1/theory/scale?root=C&scale_type=nonexistent_scale")
        assert resp.status_code == 200
        data = resp.json()
        assert data["root"] == "C"
        assert "C" in data["notes"]

    def test_various_scale_types(self, client):
        for scale_type in ["major", "natural_minor", "dorian", "mixolydian"]:
            resp = client.get(f"/api/v1/theory/scale?root=D&scale_type={scale_type}")
            assert resp.status_code == 200
            assert resp.json()["root"] == "D"

    def test_diminished_chord_analysis(self, client):
        resp = client.post(
            "/api/v1/theory/chord/analyze",
            json={"symbol": "Bdim"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["root"] == "B"
        assert "diminish" in data["quality"]

    def test_progression_analyze_with_diminished_chord(self, client):
        resp = client.post(
            "/api/v1/theory/progression/analyze",
            json={"chords": ["Bdim", "C"], "key": "C major"},
        )
        assert resp.status_code == 200
        data = resp.json()
        # Bdim is the vii° chord
        assert "°" in data["roman_numerals"][0] or data["roman_numerals"][0] == "?"
