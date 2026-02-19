"""Extended tests for album bible API endpoints — covers previously uncovered paths."""

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


def _get_bible(client: TestClient, album_id: str) -> dict:
    resp = client.get(f"/api/v1/albums/{album_id}/bible")
    assert resp.status_code == 200
    return resp.json()


def _add_theme(client: TestClient, album_id: str, name: str = "Hope") -> str:
    resp = client.post(
        f"/api/v1/albums/{album_id}/bible/themes",
        json={"name": name, "description": "A theme about hope"},
    )
    assert resp.status_code == 201
    return resp.json()["id"]


def _add_character(client: TestClient, album_id: str, name: str = "Hero") -> str:
    resp = client.post(
        f"/api/v1/albums/{album_id}/bible/characters",
        json={"name": name, "role": "protagonist", "description": "The main hero"},
    )
    assert resp.status_code == 201
    return resp.json()["id"]


def _add_motif(client: TestClient, album_id: str, name: str = "Rain") -> str:
    resp = client.post(
        f"/api/v1/albums/{album_id}/bible/motifs",
        json={"name": name, "description": "Rain symbolism throughout"},
    )
    assert resp.status_code == 201
    return resp.json()["id"]


class TestGetBibleNotFound:
    def test_get_bible_nonexistent_album_returns_404(self, client):
        """_get_or_create_bible raises 404 when album does not exist (line 162)."""
        resp = client.get("/api/v1/albums/nonexistent-album-id/bible")
        assert resp.status_code == 404

    def test_update_bible_nonexistent_album_returns_404(self, client):
        """update_bible raises 404 when album does not exist (line 262)."""
        resp = client.put(
            "/api/v1/albums/nonexistent-album-id/bible",
            json={
                "logline": "A tale of ten characters in search of meaning.",
                "synopsis": "Long synopsis here.",
            },
        )
        assert resp.status_code == 404


class TestPatchBible:
    """Tests for the patch_bible endpoint (lines 281-289)."""

    def test_patch_bible_logline_only(self, client):
        album_id = _create_album(client)
        # First set the bible
        client.put(
            f"/api/v1/albums/{album_id}/bible",
            json={
                "logline": "Original logline for the album here.",
                "synopsis": "Original synopsis.",
            },
        )
        resp = client.patch(
            f"/api/v1/albums/{album_id}/bible",
            json={"logline": "Updated logline for the album now."},
        )
        assert resp.status_code == 200
        assert resp.json()["logline"] == "Updated logline for the album now."
        # Synopsis unchanged
        assert resp.json()["synopsis"] == "Original synopsis."

    def test_patch_bible_synopsis_only(self, client):
        album_id = _create_album(client)
        client.put(
            f"/api/v1/albums/{album_id}/bible",
            json={
                "logline": "A logline that is long enough to pass validation.",
                "synopsis": "Original synopsis.",
            },
        )
        resp = client.patch(
            f"/api/v1/albums/{album_id}/bible",
            json={"synopsis": "Updated synopsis."},
        )
        assert resp.status_code == 200
        assert resp.json()["synopsis"] == "Updated synopsis."
        assert resp.json()["logline"] == "A logline that is long enough to pass validation."

    def test_patch_bible_setting(self, client):
        album_id = _create_album(client)
        resp = client.patch(
            f"/api/v1/albums/{album_id}/bible",
            json={"setting": "A dystopian future city"},
        )
        assert resp.status_code == 200
        assert resp.json()["setting"] == "A dystopian future city"

    def test_patch_bible_empty_body(self, client):
        album_id = _create_album(client)
        resp = client.patch(f"/api/v1/albums/{album_id}/bible", json={})
        assert resp.status_code == 200

    def test_patch_bible_nonexistent_album_returns_404(self, client):
        resp = client.patch(
            "/api/v1/albums/nonexistent/bible",
            json={"synopsis": "New synopsis"},
        )
        assert resp.status_code == 404


class TestRemoveTheme:
    """Tests for remove_theme endpoint including 404 path (lines 334-342)."""

    def test_remove_theme_success(self, client):
        album_id = _create_album(client)
        theme_id = _add_theme(client, album_id, "Redemption")
        resp = client.delete(f"/api/v1/albums/{album_id}/bible/themes/{theme_id}")
        assert resp.status_code == 204
        # Verify theme is gone
        bible = _get_bible(client, album_id)
        theme_ids = [t["id"] for t in bible["themes"]]
        assert theme_id not in theme_ids

    def test_remove_theme_not_found_returns_404(self, client):
        album_id = _create_album(client)
        resp = client.delete(
            f"/api/v1/albums/{album_id}/bible/themes/00000000-0000-0000-0000-000000000000"
        )
        assert resp.status_code == 404
        assert "Theme not found" in resp.json()["detail"]

    def test_remove_theme_leaves_other_themes(self, client):
        album_id = _create_album(client)
        theme1_id = _add_theme(client, album_id, "Hope")
        theme2_id = _add_theme(client, album_id, "Despair")
        client.delete(f"/api/v1/albums/{album_id}/bible/themes/{theme1_id}")
        bible = _get_bible(client, album_id)
        remaining_ids = [t["id"] for t in bible["themes"]]
        assert theme1_id not in remaining_ids
        assert theme2_id in remaining_ids


class TestRemoveCharacter:
    """Tests for remove_character endpoint including 404 path (lines 391-399)."""

    def test_remove_character_success(self, client):
        album_id = _create_album(client)
        char_id = _add_character(client, album_id, "Villain")
        resp = client.delete(f"/api/v1/albums/{album_id}/bible/characters/{char_id}")
        assert resp.status_code == 204
        bible = _get_bible(client, album_id)
        char_ids = [c["id"] for c in bible["characters"]]
        assert char_id not in char_ids

    def test_remove_character_not_found_returns_404(self, client):
        album_id = _create_album(client)
        resp = client.delete(
            f"/api/v1/albums/{album_id}/bible/characters/00000000-0000-0000-0000-000000000000"
        )
        assert resp.status_code == 404
        assert "Character not found" in resp.json()["detail"]

    def test_remove_character_leaves_others(self, client):
        album_id = _create_album(client)
        char1_id = _add_character(client, album_id, "Hero")
        char2_id = _add_character(client, album_id, "Mentor")
        client.delete(f"/api/v1/albums/{album_id}/bible/characters/{char1_id}")
        bible = _get_bible(client, album_id)
        remaining_ids = [c["id"] for c in bible["characters"]]
        assert char1_id not in remaining_ids
        assert char2_id in remaining_ids


class TestRemoveMotif:
    """Tests for remove_motif endpoint including 404 path (lines 444-452)."""

    def test_remove_motif_success(self, client):
        album_id = _create_album(client)
        motif_id = _add_motif(client, album_id, "Fire")
        resp = client.delete(f"/api/v1/albums/{album_id}/bible/motifs/{motif_id}")
        assert resp.status_code == 204
        bible = _get_bible(client, album_id)
        motif_ids = [m["id"] for m in bible["motifs"]]
        assert motif_id not in motif_ids

    def test_remove_motif_not_found_returns_404(self, client):
        album_id = _create_album(client)
        resp = client.delete(
            f"/api/v1/albums/{album_id}/bible/motifs/00000000-0000-0000-0000-000000000000"
        )
        assert resp.status_code == 404
        assert "Motif not found" in resp.json()["detail"]

    def test_remove_motif_leaves_others(self, client):
        album_id = _create_album(client)
        motif1_id = _add_motif(client, album_id, "Rain")
        motif2_id = _add_motif(client, album_id, "Fire")
        client.delete(f"/api/v1/albums/{album_id}/bible/motifs/{motif1_id}")
        bible = _get_bible(client, album_id)
        remaining_ids = [m["id"] for m in bible["motifs"]]
        assert motif1_id not in remaining_ids
        assert motif2_id in remaining_ids


class TestSetStyleProfile:
    """Tests for set_style_profile endpoint (lines 464-486)."""

    def test_set_style_profile_minimal(self, client):
        album_id = _create_album(client)
        resp = client.put(
            f"/api/v1/albums/{album_id}/bible/style",
            json={"primary_genre": "Rock"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["primary_genre"] == "Rock"

    def test_set_style_profile_full(self, client):
        album_id = _create_album(client)
        payload = {
            "primary_genre": "Progressive Rock",
            "subgenres": ["Art Rock", "Psychedelic"],
            "genre_blend_notes": "Heavy influence from 70s prog",
            "era_influence": "1970s",
            "reference_artists": ["Pink Floyd", "Genesis"],
            "reference_albums": ["Dark Side of the Moon"],
            "typical_tempo_range": [70, 120],
            "typical_keys": ["C minor", "E flat major"],
            "harmonic_tendencies": "Modal harmony with jazz chords",
            "instrumentation_core": ["guitar", "bass", "drums", "keyboards"],
            "instrumentation_accents": ["mellotron", "saxophone"],
            "production_notes": "Warm analog sound",
            "lyrical_tone": "Introspective and philosophical",
            "lyrical_devices": ["metaphor", "allegory"],
            "vocabulary_notes": "Sophisticated literary vocabulary",
        }
        resp = client.put(
            f"/api/v1/albums/{album_id}/bible/style",
            json=payload,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["primary_genre"] == "Progressive Rock"
        assert "Pink Floyd" in data["reference_artists"]
        assert data["lyrical_tone"] == "Introspective and philosophical"

    def test_set_style_profile_overwrites_previous(self, client):
        album_id = _create_album(client)
        client.put(
            f"/api/v1/albums/{album_id}/bible/style",
            json={"primary_genre": "Pop"},
        )
        resp = client.put(
            f"/api/v1/albums/{album_id}/bible/style",
            json={"primary_genre": "Jazz"},
        )
        assert resp.status_code == 200
        assert resp.json()["primary_genre"] == "Jazz"

    def test_set_style_profile_nonexistent_album_returns_404(self, client):
        resp = client.put(
            "/api/v1/albums/nonexistent/bible/style",
            json={"primary_genre": "Blues"},
        )
        assert resp.status_code == 404
