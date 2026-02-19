"""Smoke tests for the experience API endpoints.

These tests verify that all major experience endpoints:
- Return correct HTTP status codes
- Accept valid request bodies without error
- Return well-formed responses

No Anthropic API calls are made — all endpoints do pure data computation.
"""

import pytest
from fastapi.testclient import TestClient

from album_conceptualizer.api.app import create_app
from album_conceptualizer.config import reset_settings


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


def _create_album(client: TestClient, title: str = "Smoke Album", songs: int = 3) -> str:
    """Create an album and populate it with songs, returning the album_id."""
    resp = client.post(
        "/api/v1/albums",
        json={
            "title": title,
            "artist": "Test Artist",
            "concept_summary": "A journey through duality",
            "primary_genre": "Rock",
            "central_themes": ["love", "loss"],
        },
    )
    assert resp.status_code == 201
    album_id = resp.json()["id"]

    for i in range(1, songs + 1):
        client.post(
            f"/api/v1/albums/{album_id}/songs",
            json={
                "title": f"Track {i}",
                "track_number": i,
                "tempo": 100 + i * 10,
                "key": "C major",
            },
        )

    return album_id


_REFERENCE_TRACKS = [
    {
        "title": "Bohemian Rhapsody",
        "artist": "Queen",
        "tempo": 72,
        "key": "Bb major",
        "mood_tags": ["epic", "emotional"],
        "production_tags": ["orchestral", "layered"],
    },
    {
        "title": "Hotel California",
        "artist": "Eagles",
        "tempo": 75,
        "key": "B minor",
        "mood_tags": ["dark", "cinematic"],
        "production_tags": ["guitar-driven", "atmospheric"],
    },
]


# ---------------------------------------------------------------------------
# Stateless / album-independent endpoints
# ---------------------------------------------------------------------------


class TestPromptPacks:
    def test_list_prompt_packs_returns_list(self, client):
        """GET /experience/prompt-packs returns a non-empty list."""
        resp = client.get("/api/v1/experience/prompt-packs")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) > 0
        assert "id" in data[0]
        assert "name" in data[0]

    def test_list_prompt_packs_difficulty_filter(self, client):
        """GET /experience/prompt-packs?difficulty=beginner filters by difficulty."""
        resp = client.get("/api/v1/experience/prompt-packs?difficulty=beginner")
        assert resp.status_code == 200
        packs = resp.json()
        assert all(p["difficulty"] == "beginner" for p in packs)


class TestStyleCapture:
    def test_style_capture_with_minimal_track(self, client):
        """POST /experience/style-capture with one minimal track returns fingerprint."""
        resp = client.post(
            "/api/v1/experience/style-capture",
            json={"reference_tracks": [{"title": "My Track"}]},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "suggested_primary_genre" in data
        assert "suggested_prompt" in data
        assert isinstance(data["key_centers"], list)

    def test_style_capture_with_full_tracks(self, client):
        """POST /experience/style-capture with rich track data returns complete fingerprint."""
        resp = client.post(
            "/api/v1/experience/style-capture",
            json={
                "reference_tracks": _REFERENCE_TRACKS,
                "album_goal": "Create an epic concept album",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["median_tempo"] is not None
        assert data["tempo_range"] is not None

    def test_style_capture_rejects_empty_track_list(self, client):
        """POST /experience/style-capture rejects empty track list (min_length=1)."""
        resp = client.post(
            "/api/v1/experience/style-capture",
            json={"reference_tracks": []},
        )
        assert resp.status_code == 422


class TestReferenceAnalyzer:
    def test_reference_analyzer_returns_full_response(self, client):
        """POST /experience/reference-analyzer returns diagnostics, clusters, blueprint."""
        resp = client.post(
            "/api/v1/experience/reference-analyzer",
            json={
                "reference_tracks": _REFERENCE_TRACKS,
                "album_goal": "A dark introspective concept album",
                "target_track_count": 10,
                "desired_energy_curve": "rise",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "style_fingerprint" in data
        assert "diagnostics" in data
        assert isinstance(data["diagnostics"], list)
        assert "recommended_track_blueprint" in data

    def test_reference_analyzer_with_wave_curve(self, client):
        """POST /experience/reference-analyzer accepts 'wave' energy curve."""
        resp = client.post(
            "/api/v1/experience/reference-analyzer",
            json={
                "reference_tracks": [{"title": "Track A"}],
                "desired_energy_curve": "wave",
            },
        )
        assert resp.status_code == 200

    def test_reference_analyzer_rejects_invalid_energy_curve(self, client):
        """POST /experience/reference-analyzer rejects invalid energy_curve pattern."""
        resp = client.post(
            "/api/v1/experience/reference-analyzer",
            json={
                "reference_tracks": [{"title": "Track A"}],
                "desired_energy_curve": "chaos",
            },
        )
        assert resp.status_code == 422


class TestTemplates:
    def test_list_templates_returns_list(self, client):
        """GET /experience/templates returns a list of marketplace templates."""
        resp = client.get("/api/v1/experience/templates")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)


# ---------------------------------------------------------------------------
# Album-specific experience endpoints
# ---------------------------------------------------------------------------


class TestProgressCoach:
    def test_progress_coach_for_empty_album(self, client):
        """GET /albums/{id}/experience/progress-coach returns coaching data."""
        album_id = _create_album(client, "Progress Test Album")
        resp = client.get(f"/api/v1/albums/{album_id}/experience/progress-coach")
        assert resp.status_code == 200
        data = resp.json()
        assert "readiness_tier" in data
        assert "next_actions" in data
        assert isinstance(data["next_actions"], list)

    def test_progress_coach_404_for_missing_album(self, client):
        """GET /albums/nonexistent/experience/progress-coach returns 404."""
        resp = client.get("/api/v1/albums/nonexistent-id/experience/progress-coach")
        assert resp.status_code == 404


class TestTimelineBoard:
    def test_timeline_board_returns_tracks(self, client):
        """GET /albums/{id}/experience/timeline-board returns timeline data."""
        album_id = _create_album(client, "Timeline Album")
        resp = client.get(f"/api/v1/albums/{album_id}/experience/timeline-board")
        assert resp.status_code == 200
        data = resp.json()
        assert "rows" in data
        assert "warnings" in data
        assert isinstance(data["rows"], list)

    def test_timeline_board_404_for_missing_album(self, client):
        resp = client.get("/api/v1/albums/nonexistent-id/experience/timeline-board")
        assert resp.status_code == 404


class TestReleaseKit:
    def test_release_kit_returns_marketing_content(self, client):
        """GET /albums/{id}/experience/release-kit returns pitch, blurb, social posts."""
        album_id = _create_album(client, "Release Kit Album")
        resp = client.get(f"/api/v1/albums/{album_id}/experience/release-kit")
        assert resp.status_code == 200
        data = resp.json()
        assert "album_pitch" in data
        assert "social_posts" in data

    def test_release_kit_platform_filter(self, client):
        """GET /albums/{id}/experience/release-kit?platform=streaming works."""
        album_id = _create_album(client, "Release Kit Album 2")
        resp = client.get(
            f"/api/v1/albums/{album_id}/experience/release-kit?platform=streaming"
        )
        assert resp.status_code == 200


class TestJamMode:
    def test_jam_mode_default_request(self, client):
        """POST /albums/{id}/experience/jam-mode returns jam cards."""
        album_id = _create_album(client, "Jam Mode Album")
        resp = client.post(
            f"/api/v1/albums/{album_id}/experience/jam-mode",
            json={},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "cards" in data
        assert isinstance(data["cards"], list)

    def test_jam_mode_with_pack_and_focus(self, client):
        """POST /albums/{id}/experience/jam-mode accepts pack_id and focus."""
        album_id = _create_album(client, "Jam Mode Album 2")
        resp = client.post(
            f"/api/v1/albums/{album_id}/experience/jam-mode",
            json={"pack_id": "lofi-diary", "focus": "melody", "target_tracks": [1, 2]},
        )
        assert resp.status_code == 200

    def test_jam_mode_404_for_missing_album(self, client):
        resp = client.post(
            "/api/v1/albums/nonexistent-id/experience/jam-mode",
            json={},
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Collaboration rooms
# ---------------------------------------------------------------------------


class TestCollabRooms:
    def test_create_collab_room(self, client):
        """POST /albums/{id}/experience/collab-rooms creates a room."""
        album_id = _create_album(client, "Collab Album")
        resp = client.post(
            f"/api/v1/albums/{album_id}/experience/collab-rooms",
            json={
                "name": "Writing Session",
                "host_alias": "Alice",
                "focus": "Work on the chorus",
                "visibility": "team",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "id" in data
        assert data["name"] == "Writing Session"

    def test_list_collab_rooms(self, client):
        """GET /albums/{id}/experience/collab-rooms returns room list."""
        album_id = _create_album(client, "Collab Album 2")
        client.post(
            f"/api/v1/albums/{album_id}/experience/collab-rooms",
            json={"name": "Room One", "host_alias": "Bob"},
        )
        resp = client.get(f"/api/v1/albums/{album_id}/experience/collab-rooms")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
        assert len(resp.json()) == 1

    def test_get_collab_room_by_id(self, client):
        """GET /albums/{id}/experience/collab-rooms/{room_id} returns room."""
        album_id = _create_album(client, "Collab Album 3")
        create_resp = client.post(
            f"/api/v1/albums/{album_id}/experience/collab-rooms",
            json={"name": "My Room", "host_alias": "Carol"},
        )
        room_id = create_resp.json()["id"]
        resp = client.get(
            f"/api/v1/albums/{album_id}/experience/collab-rooms/{room_id}"
        )
        assert resp.status_code == 200
        assert resp.json()["id"] == room_id

    def test_get_collab_room_not_found(self, client):
        album_id = _create_album(client, "Collab Album 4")
        resp = client.get(
            f"/api/v1/albums/{album_id}/experience/collab-rooms/nonexistent-room"
        )
        assert resp.status_code == 404

    def test_join_collab_room(self, client):
        """POST collab-rooms/{room_id}/join adds participant."""
        album_id = _create_album(client, "Collab Album 5")
        room_id = client.post(
            f"/api/v1/albums/{album_id}/experience/collab-rooms",
            json={"name": "Join Test", "host_alias": "Host"},
        ).json()["id"]

        resp = client.post(
            f"/api/v1/albums/{album_id}/experience/collab-rooms/{room_id}/join",
            json={"alias": "NewMember", "role": "contributor"},
        )
        assert resp.status_code == 200
        participants = resp.json()["participants"]
        assert any(p["alias"] == "NewMember" for p in participants)

    def test_add_collab_comment(self, client):
        """POST collab-rooms/{room_id}/comments appends comment."""
        album_id = _create_album(client, "Collab Album 6")
        room_id = client.post(
            f"/api/v1/albums/{album_id}/experience/collab-rooms",
            json={"name": "Comment Room", "host_alias": "Host"},
        ).json()["id"]

        resp = client.post(
            f"/api/v1/albums/{album_id}/experience/collab-rooms/{room_id}/comments",
            json={"alias": "Alice", "message": "This track needs more energy!"},
        )
        assert resp.status_code == 200
        assert len(resp.json()["comments"]) == 1

    def test_save_collab_snapshot(self, client):
        """POST collab-rooms/{room_id}/snapshots saves checkpoint."""
        album_id = _create_album(client, "Collab Album 7")
        room_id = client.post(
            f"/api/v1/albums/{album_id}/experience/collab-rooms",
            json={"name": "Snapshot Room", "host_alias": "Host"},
        ).json()["id"]

        resp = client.post(
            f"/api/v1/albums/{album_id}/experience/collab-rooms/{room_id}/snapshots",
            json={"alias": "Alice", "summary": "Completed the verse structure today"},
        )
        assert resp.status_code == 200
        assert len(resp.json()["snapshots"]) == 1

    def test_add_and_vote_board_item(self, client):
        """POST board-items then vote on it."""
        album_id = _create_album(client, "Collab Album 8")
        room_id = client.post(
            f"/api/v1/albums/{album_id}/experience/collab-rooms",
            json={"name": "Board Room", "host_alias": "Host"},
        ).json()["id"]

        # Add board item
        resp = client.post(
            f"/api/v1/albums/{album_id}/experience/collab-rooms/{room_id}/board-items",
            json={"alias": "Alice", "title": "Add string arrangements"},
        )
        assert resp.status_code == 200
        item_id = resp.json()["board_items"][0]["id"]

        # Vote on it
        vote_resp = client.post(
            f"/api/v1/albums/{album_id}/experience/collab-rooms/{room_id}/board-items/{item_id}/vote",
            json={"alias": "Bob", "value": 1},
        )
        assert vote_resp.status_code == 200
        assert vote_resp.json()["board_items"][0]["vote_score"] == 1


# ---------------------------------------------------------------------------
# Remix battles
# ---------------------------------------------------------------------------


class TestRemixBattles:
    def test_create_remix_battle(self, client):
        """POST /albums/{id}/experience/remix-battles creates a battle."""
        album_id = _create_album(client, "Battle Album")
        resp = client.post(
            f"/api/v1/albums/{album_id}/experience/remix-battles",
            json={
                "alias": "BattleMaster",
                "title": "Best Chorus Challenge",
                "prompt": "Reinterpret the main chorus as a jazz ballad",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "id" in data
        assert data["status"] == "open"

    def test_list_remix_battles(self, client):
        """GET /albums/{id}/experience/remix-battles lists battles."""
        album_id = _create_album(client, "Battle Album 2")
        client.post(
            f"/api/v1/albums/{album_id}/experience/remix-battles",
            json={
                "alias": "Creator",
                "title": "Remix This Track",
                "prompt": "Take the main theme and flip it into something unexpected",
            },
        )
        resp = client.get(f"/api/v1/albums/{album_id}/experience/remix-battles")
        assert resp.status_code == 200
        battles = resp.json()
        assert len(battles) == 1

    def test_submit_remix_battle_entry(self, client):
        """POST /remix-battles/{id}/submissions adds entry to battle."""
        album_id = _create_album(client, "Battle Album 3")
        battle_id = client.post(
            f"/api/v1/albums/{album_id}/experience/remix-battles",
            json={
                "alias": "Creator",
                "title": "Open Battle",
                "prompt": "Reimagine the album opener as an ambient piece",
            },
        ).json()["id"]

        resp = client.post(
            f"/api/v1/albums/{album_id}/experience/remix-battles/{battle_id}/submissions",
            json={
                "alias": "Contestant",
                "title": "My Entry",
                "concept": "I'd strip it down to piano and reverb to create space",
            },
        )
        assert resp.status_code == 200
        assert len(resp.json()["submissions"]) == 1


# ---------------------------------------------------------------------------
# DAW handoff (writes to disk)
# ---------------------------------------------------------------------------


class TestDawHandoff:
    def test_daw_handoff_default_targets(self, client):
        """POST /albums/{id}/experience/daw-handoff with default targets succeeds."""
        album_id = _create_album(client, "DAW Album", songs=2)
        resp = client.post(
            f"/api/v1/albums/{album_id}/experience/daw-handoff",
            json={},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "bundle_dir" in data
        assert "files" in data
        assert len(data["files"]) > 0

    def test_daw_handoff_rejects_invalid_target(self, client):
        """POST daw-handoff rejects unsupported DAW target."""
        album_id = _create_album(client, "DAW Album 2")
        resp = client.post(
            f"/api/v1/albums/{album_id}/experience/daw-handoff",
            json={"daw_targets": ["garageband", "invalidDAW"]},
        )
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Creator memory
# ---------------------------------------------------------------------------


class TestCreatorMemory:
    def test_get_creator_memory_profile(self, client):
        """GET /experience/creator-memory returns profile (empty initially)."""
        resp = client.get("/api/v1/experience/creator-memory")
        assert resp.status_code == 200
        data = resp.json()
        assert "profile_id" in data

    def test_update_creator_memory_preferences(self, client):
        """POST /experience/creator-memory/preferences updates prefs."""
        resp = client.post(
            "/api/v1/experience/creator-memory/preferences",
            json={
                "preferred_genres": ["rock", "jazz"],
                "preferred_keys": ["C major"],
                "preferred_tempos": [120],
            },
        )
        assert resp.status_code == 200

    def test_get_creator_memory_recommendations(self, client):
        """GET /albums/{id}/experience/creator-memory/recommendations returns suggestions."""
        album_id = _create_album(client, "Creator Memory Album")
        resp = client.get(
            f"/api/v1/albums/{album_id}/experience/creator-memory/recommendations"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "recommendations" in data
