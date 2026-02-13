"""Tests for creative experience endpoints."""

from fastapi.testclient import TestClient

from album_conceptualizer.api.app import create_app
from album_conceptualizer.config import reset_settings


def _make_client(monkeypatch) -> TestClient:
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEY", raising=False)
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEYS", raising=False)
    reset_settings()
    return TestClient(create_app())


def _seed_album(client: TestClient) -> str:
    album = client.post(
        "/api/v1/albums",
        json={
            "title": "Neon Atlas",
            "artist": "Signal Fires",
            "concept_summary": "A city traveler rebuilding identity after midnight",
            "primary_genre": "Alt Pop",
            "central_themes": ["identity", "memory", "reinvention"],
        },
    ).json()
    album_id = album["id"]

    client.post(
        f"/api/v1/albums/{album_id}/songs",
        json={
            "title": "Streetlights",
            "track_number": 1,
            "narrative_summary": "The protagonist leaves home and follows city lights.",
            "themes": ["identity"],
            "sections": [
                {
                    "section_type": "verse",
                    "order": 1,
                    "lyrics": "Headlights bloom in rain",
                    "chord_progression": ["C", "G", "Am", "F"],
                },
                {
                    "section_type": "chorus",
                    "order": 2,
                    "lyrics": "I rewrite my name in neon",
                    "chord_progression": ["F", "G", "C", "Am"],
                },
            ],
        },
    )
    client.post(
        f"/api/v1/albums/{album_id}/songs",
        json={
            "title": "Afterimage",
            "track_number": 2,
            "themes": ["memory"],
            "sections": [
                {
                    "section_type": "verse",
                    "order": 1,
                    "lyrics": "Faces in the train glass",
                    "chord_progression": ["Dm", "Bb", "F", "C"],
                }
            ],
        },
    )
    client.put(
        f"/api/v1/albums/{album_id}/bible",
        json={
            "logline": "A lone narrator remaps selfhood in a sleeping metropolis.",
            "synopsis": "Each track captures a stop on a nocturnal emotional migration.",
            "setting": "Rain-soaked megacity",
        },
    )
    client.post(
        f"/api/v1/albums/{album_id}/bible/motifs",
        json={
            "name": "Neon Signal",
            "motif_type": "lyrical",
            "description": "A color-coded call toward change",
            "appearances": [{"track_number": 1}, {"track_number": 2}],
        },
    )
    return album_id


def test_prompt_packs_list_and_filter(monkeypatch):
    client = _make_client(monkeypatch)
    response = client.get("/api/v1/experience/prompt-packs")
    assert response.status_code == 200
    packs = response.json()
    assert len(packs) >= 4

    filtered = client.get("/api/v1/experience/prompt-packs", params={"difficulty": "advanced"})
    assert filtered.status_code == 200
    assert filtered.json()
    assert all(item["difficulty"] == "advanced" for item in filtered.json())


def test_style_capture_returns_fingerprint(monkeypatch):
    client = _make_client(monkeypatch)
    response = client.post(
        "/api/v1/experience/style-capture",
        json={
            "album_goal": "Festival-ready hooks with emotional storytelling",
            "reference_tracks": [
                {
                    "title": "Ref One",
                    "artist": "A",
                    "key": "C major",
                    "tempo": 120,
                    "chord_progression": ["C", "G", "Am", "F"],
                    "mood_tags": ["cinematic", "hopeful"],
                    "production_tags": ["wide drums", "analog synth"],
                },
                {
                    "title": "Ref Two",
                    "artist": "B",
                    "key": "G major",
                    "tempo": 132,
                    "chord_progression": ["G", "D", "Em", "C"],
                    "mood_tags": ["energetic"],
                    "production_tags": ["punchy bass"],
                },
            ],
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["tempo_range"] == [120, 132]
    assert data["median_tempo"] == 126
    assert data["key_centers"]
    assert data["common_chord_roots"]
    assert data["suggested_prompt"]


def test_jam_mode_generates_track_cards(monkeypatch):
    client = _make_client(monkeypatch)
    album_id = _seed_album(client)

    response = client.post(
        f"/api/v1/albums/{album_id}/experience/jam-mode",
        json={"pack_id": "cinematic-arc", "focus": "tight hooks", "target_tracks": [1, 2]},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["pack"]["id"] == "cinematic-arc"
    assert len(data["cards"]) == 2
    assert data["cards"][0]["progression_seed"]


def test_timeline_board_flags_missing_story_data(monkeypatch):
    client = _make_client(monkeypatch)
    album_id = _seed_album(client)

    client.post(
        f"/api/v1/albums/{album_id}/bible/themes",
        json={
            "name": "Distance",
            "description": "Urban isolation",
            "primary_songs": [99],
        },
    )
    response = client.get(f"/api/v1/albums/{album_id}/experience/timeline-board")
    assert response.status_code == 200
    payload = response.json()
    assert payload["rows"]
    assert payload["warnings"]
    assert payload["coherence_score"] < 100


def test_progress_coach_returns_next_actions(monkeypatch):
    client = _make_client(monkeypatch)
    album_id = _seed_album(client)

    response = client.get(f"/api/v1/albums/{album_id}/experience/progress-coach")
    assert response.status_code == 200
    payload = response.json()
    assert 0 <= payload["completion_percent"] <= 100
    assert payload["readiness_tier"] in {"launch-ready", "beta-ready", "prototype", "early-draft"}
    assert payload["checklist"]
    assert payload["next_actions"]


def test_release_kit_generates_marketing_assets(monkeypatch):
    client = _make_client(monkeypatch)
    album_id = _seed_album(client)

    response = client.get(
        f"/api/v1/albums/{album_id}/experience/release-kit",
        params={"platform": "spotify"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["album_pitch"]
    assert payload["press_blurb"]
    assert payload["track_teasers"]
    assert payload["social_posts"]
    assert payload["cover_art_prompt"]
