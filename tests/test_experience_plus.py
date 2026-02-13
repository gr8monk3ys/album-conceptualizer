"""Additional tests for new experience toolkit features."""

from __future__ import annotations

import sys
import types
from pathlib import Path
from types import SimpleNamespace

from fastapi.testclient import TestClient

from album_conceptualizer.api.app import create_app
from album_conceptualizer.api.v1 import experience as experience_api
from album_conceptualizer.config import reset_settings


def _make_client(monkeypatch) -> TestClient:
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEY", raising=False)
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEYS", raising=False)
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_STRICT_PRODUCTION", raising=False)
    reset_settings()
    return TestClient(create_app())


def _seed_album(client: TestClient, *, title: str = "Neon Atlas") -> str:
    album = client.post(
        "/api/v1/albums",
        json={
            "title": title,
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
    return album_id


def test_template_marketplace_apply_merge(monkeypatch):
    client = _make_client(monkeypatch)
    album_id = _seed_album(client)

    templates = client.get("/api/v1/experience/templates")
    assert templates.status_code == 200
    assert templates.json()

    response = client.post(
        f"/api/v1/albums/{album_id}/experience/templates/neon-city-arc/apply",
        json={"mode": "merge", "add_tracks": True},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["template_id"] == "neon-city-arc"
    assert payload["added_tracks"]
    assert len(payload["album"]["songs"]) >= 3


def test_template_apply_replace_sets_core_fields(monkeypatch):
    client = _make_client(monkeypatch)
    album = client.post(
        "/api/v1/albums",
        json={"title": "Blank Slate"},
    )
    album_id = album.json()["id"]

    response = client.post(
        f"/api/v1/albums/{album_id}/experience/templates/festival-burn/apply",
        json={"mode": "replace", "add_tracks": False},
    )
    assert response.status_code == 200
    payload = response.json()
    assert "concept_summary" in payload["updated_fields"]
    assert payload["album"]["primary_genre"] == "Alt Rock"
    assert payload["album"]["central_themes"]


def test_collab_room_flow(monkeypatch):
    client = _make_client(monkeypatch)
    album_id = _seed_album(client)

    created = client.post(
        f"/api/v1/albums/{album_id}/experience/collab-rooms",
        json={
            "name": "Hook Lab",
            "host_alias": "nataly",
            "focus": "chorus rewrites",
            "visibility": "team",
        },
    )
    assert created.status_code == 200
    room_id = created.json()["id"]

    joined = client.post(
        f"/api/v1/albums/{album_id}/experience/collab-rooms/{room_id}/join",
        json={"alias": "producer-1", "role": "producer"},
    )
    assert joined.status_code == 200
    assert len(joined.json()["participants"]) == 2

    commented = client.post(
        f"/api/v1/albums/{album_id}/experience/collab-rooms/{room_id}/comments",
        json={
            "alias": "producer-1",
            "message": "Let's push the pre-chorus lift.",
            "track_number": 1,
        },
    )
    assert commented.status_code == 200
    assert commented.json()["comments"]

    snapshotted = client.post(
        f"/api/v1/albums/{album_id}/experience/collab-rooms/{room_id}/snapshots",
        json={"alias": "nataly", "summary": "Locked hook v3 for track 1."},
    )
    assert snapshotted.status_code == 200
    assert snapshotted.json()["snapshots"]

    listed = client.get(f"/api/v1/albums/{album_id}/experience/collab-rooms")
    assert listed.status_code == 200
    assert listed.json()


def test_challenge_mode_scorecard(monkeypatch):
    client = _make_client(monkeypatch)
    album_id = _seed_album(client)
    headers = {"X-API-Key": "challenge-key"}

    weekly = client.get("/api/v1/experience/challenges/weekly")
    assert weekly.status_code == 200
    challenge_id = weekly.json()["challenge"]["id"]

    run = client.post(
        f"/api/v1/albums/{album_id}/experience/challenges/{challenge_id}/run",
        params=[("track_numbers", 1), ("track_numbers", 2)],
    )
    assert run.status_code == 200
    assert run.json()["cards"]

    completed = client.post(
        f"/api/v1/experience/challenges/{challenge_id}/complete",
        headers=headers,
        json={"completed_tracks": [1, 2], "minutes_spent": 50, "quality_rating": 4},
    )
    assert completed.status_code == 200
    score = completed.json()
    assert score["total_points"] > 0
    assert score["level"] in {"demo", "opening-act", "touring", "headliner"}

    scorecard = client.get("/api/v1/experience/challenges/scorecard", headers=headers)
    assert scorecard.status_code == 200
    assert scorecard.json()["recent_challenges"]


def test_release_campaign_and_audio_preview(monkeypatch):
    client = _make_client(monkeypatch)
    album_id = _seed_album(client)

    campaign = client.get(
        f"/api/v1/albums/{album_id}/experience/release-campaign",
        params={"duration_days": 10},
    )
    assert campaign.status_code == 200
    campaign_payload = campaign.json()
    assert campaign_payload["duration_days"] == 10
    assert len(campaign_payload["items"]) == 10

    preview = client.post(
        f"/api/v1/albums/{album_id}/experience/audio-preview",
        json={"track_numbers": [1, 2], "bars_per_chord": 1.5},
    )
    assert preview.status_code in {200, 501}
    if preview.status_code == 200:
        preview_payload = preview.json()
        assert preview_payload["estimated_duration_seconds"] > 0
        preview_path = Path(preview_payload["file_path"])
        assert preview_path.exists()


def test_experience_state_persists_with_file_backend(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_STORAGE_BACKEND", "file")

    client = _make_client(monkeypatch)
    album_id = _seed_album(client, title="Persistence Run")

    created = client.post(
        f"/api/v1/albums/{album_id}/experience/collab-rooms",
        json={
            "name": "Persistence Room",
            "host_alias": "host",
            "focus": "state continuity",
            "visibility": "team",
        },
    )
    assert created.status_code == 200
    room_id = created.json()["id"]

    challenge_id = client.get("/api/v1/experience/challenges/weekly").json()["challenge"]["id"]
    completed = client.post(
        f"/api/v1/experience/challenges/{challenge_id}/complete",
        headers={"X-API-Key": "persist-key"},
        json={"completed_tracks": [1], "minutes_spent": 30, "quality_rating": 4},
    )
    assert completed.status_code == 200
    initial_points = completed.json()["total_points"]
    client.close()

    reset_settings()
    client_after_restart = _make_client(monkeypatch)
    listed = client_after_restart.get(f"/api/v1/albums/{album_id}/experience/collab-rooms")
    assert listed.status_code == 200
    assert any(room["id"] == room_id for room in listed.json())

    scorecard = client_after_restart.get(
        "/api/v1/experience/challenges/scorecard",
        headers={"X-API-Key": "persist-key"},
    )
    assert scorecard.status_code == 200
    assert scorecard.json()["total_points"] >= initial_points


def test_collab_shared_board_with_voting(monkeypatch):
    client = _make_client(monkeypatch)
    album_id = _seed_album(client)
    room = client.post(
        f"/api/v1/albums/{album_id}/experience/collab-rooms",
        json={"name": "Board Lab", "host_alias": "host", "visibility": "team"},
    )
    room_id = room.json()["id"]

    first = client.post(
        f"/api/v1/albums/{album_id}/experience/collab-rooms/{room_id}/board-items",
        json={"alias": "host", "title": "Open track 1 with dry drums", "track_number": 1},
    )
    assert first.status_code == 200
    first_item_id = first.json()["board_items"][0]["id"]

    second = client.post(
        f"/api/v1/albums/{album_id}/experience/collab-rooms/{room_id}/board-items",
        json={"alias": "producer", "title": "Double the final chorus", "track_number": 2},
    )
    assert second.status_code == 200
    second_item_id = second.json()["board_items"][0]["id"]

    vote_one = client.post(
        f"/api/v1/albums/{album_id}/experience/collab-rooms/{room_id}/board-items/{first_item_id}/vote",
        json={"alias": "host", "value": 1},
    )
    assert vote_one.status_code == 200

    vote_two = client.post(
        f"/api/v1/albums/{album_id}/experience/collab-rooms/{room_id}/board-items/{second_item_id}/vote",
        json={"alias": "host", "value": 1},
    )
    assert vote_two.status_code == 200

    vote_three = client.post(
        f"/api/v1/albums/{album_id}/experience/collab-rooms/{room_id}/board-items/{second_item_id}/vote",
        json={"alias": "producer", "value": 1},
    )
    assert vote_three.status_code == 200
    board = vote_three.json()["board_items"]
    assert board[0]["id"] == second_item_id
    assert board[0]["vote_score"] == 2
    assert board[0]["voter_count"] == 2


def test_reference_analyzer_returns_clusters(monkeypatch):
    client = _make_client(monkeypatch)
    response = client.post(
        "/api/v1/experience/reference-analyzer",
        json={
            "album_goal": "Big hooks with cinematic pacing",
            "target_track_count": 6,
            "desired_energy_curve": "wave",
            "reference_tracks": [
                {
                    "title": "Ref One",
                    "artist": "Artist A",
                    "tempo": 92,
                    "key": "C major",
                    "chord_progression": ["C", "G", "Am", "F"],
                    "mood_tags": ["cinematic", "hooky"],
                    "production_tags": ["analog synth", "wide drums"],
                },
                {
                    "title": "Ref Two",
                    "artist": "Artist B",
                    "tempo": 132,
                    "key": "G major",
                    "chord_progression": ["G", "D", "Em", "C"],
                    "mood_tags": ["energetic", "anthemic"],
                    "production_tags": ["guitars", "wide drums"],
                },
            ],
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["style_fingerprint"]["median_tempo"] == 112
    assert payload["diagnostics"]
    assert payload["clusters"]
    assert len(payload["recommended_track_blueprint"]) == 6


def test_release_kit_one_click_export(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    client = _make_client(monkeypatch)
    album_id = _seed_album(client, title="Launch Atlas")
    exported = client.post(
        f"/api/v1/albums/{album_id}/experience/release-kit/export",
        json={
            "platform": "spotify",
            "duration_days": 9,
            "include_campaign_csv": True,
            "include_json_manifest": True,
        },
    )
    assert exported.status_code == 200
    payload = exported.json()
    assert payload["files"]
    bundle_dir = Path(payload["bundle_dir"])
    zip_path = Path(payload["zip_path"])
    assert bundle_dir.exists()
    assert zip_path.exists()
    assert any(file_name == "campaign_schedule.csv" for file_name in payload["files"])


def test_challenge_leaderboard(monkeypatch):
    client = _make_client(monkeypatch)
    _seed_album(client)
    challenge_id = client.get("/api/v1/experience/challenges/weekly").json()["challenge"]["id"]

    completed_alpha = client.post(
        f"/api/v1/experience/challenges/{challenge_id}/complete",
        headers={"X-API-Key": "alpha"},
        json={"completed_tracks": [1, 2], "minutes_spent": 50, "quality_rating": 5},
    )
    assert completed_alpha.status_code == 200
    completed_beta = client.post(
        f"/api/v1/experience/challenges/{challenge_id}/complete",
        headers={"X-API-Key": "beta"},
        json={"completed_tracks": [1], "minutes_spent": 20, "quality_rating": 3},
    )
    assert completed_beta.status_code == 200

    leaderboard_all = client.get("/api/v1/experience/challenges/leaderboard")
    assert leaderboard_all.status_code == 200
    entries = leaderboard_all.json()["entries"]
    assert entries
    assert entries[0]["points"] >= entries[-1]["points"]

    leaderboard_weekly = client.get(
        "/api/v1/experience/challenges/leaderboard",
        params={"scope": "weekly"},
    )
    assert leaderboard_weekly.status_code == 200
    assert leaderboard_weekly.json()["scope"] == "weekly"


def test_creator_memory_profile_and_recommendations(monkeypatch):
    client = _make_client(monkeypatch)
    album_id = _seed_album(client)
    headers = {"X-API-Key": "memory-key"}

    updated = client.post(
        "/api/v1/experience/creator-memory/preferences",
        headers=headers,
        json={
            "display_name": "Naty",
            "preferred_genres": ["Alt Pop", "Alt Pop", "Indie Rock"],
            "preferred_themes": ["identity", "reinvention"],
            "preferred_moods": ["cinematic", "hopeful"],
            "workflow_preferences": ["45-minute focused sprint"],
            "goals": ["Ship one finished hook per day"],
        },
    )
    assert updated.status_code == 200
    payload = updated.json()
    assert payload["display_name"] == "Naty"
    assert payload["preferred_genres"] == ["alt pop", "indie rock"]

    logged = client.post(
        "/api/v1/experience/creator-memory/events",
        headers=headers,
        json={
            "event_type": "session-win",
            "label": "Finished chorus rewrite for track 1",
            "album_id": album_id,
            "metadata": {"session_type": "hook polish"},
        },
    )
    assert logged.status_code == 200
    assert logged.json()["recent_memory_events"]

    memory = client.get("/api/v1/experience/creator-memory", headers=headers)
    assert memory.status_code == 200
    assert memory.json()["memory_strength"] > 0

    recommendations = client.get(
        f"/api/v1/albums/{album_id}/experience/creator-memory/recommendations",
        headers=headers,
    )
    assert recommendations.status_code == 200
    rec_payload = recommendations.json()
    assert rec_payload["recommendations"]
    assert rec_payload["jam_focus"]


def test_collab_room_realtime_presence_typing_and_conflict_resolution(monkeypatch):
    client = _make_client(monkeypatch)
    album_id = _seed_album(client)
    room = client.post(
        f"/api/v1/albums/{album_id}/experience/collab-rooms",
        json={"name": "Realtime Lab", "host_alias": "host", "visibility": "team"},
    )
    assert room.status_code == 200
    room_id = room.json()["id"]

    host_path = f"/api/v1/albums/{album_id}/experience/collab-rooms/{room_id}/ws?alias=host"
    guest_path = f"/api/v1/albums/{album_id}/experience/collab-rooms/{room_id}/ws?alias=guest"

    with client.websocket_connect(host_path) as host_ws:
        host_snapshot = host_ws.receive_json()
        assert host_snapshot["type"] == "snapshot"
        assert "host" in host_snapshot["payload"]["presence"]

        with client.websocket_connect(guest_path) as guest_ws:
            guest_snapshot = guest_ws.receive_json()
            assert guest_snapshot["type"] == "snapshot"
            host_joined = host_ws.receive_json()
            assert host_joined["type"] == "presence_joined"
            assert host_joined["payload"]["alias"] == "guest"

            host_ws.send_json({"type": "claim_edit", "target": "track:1:chorus"})
            host_claimed = host_ws.receive_json()
            guest_claimed = guest_ws.receive_json()
            assert host_claimed["type"] == "edit_claimed"
            assert guest_claimed["type"] == "edit_claimed"

            guest_ws.send_json({"type": "claim_edit", "target": "track:1:chorus"})
            guest_conflict = guest_ws.receive_json()
            assert guest_conflict["type"] == "edit_conflict"
            assert guest_conflict["payload"]["holder"] == "host"

            guest_ws.send_json({"type": "claim_edit", "target": "track:1:chorus", "force": True})
            guest_takeover = guest_ws.receive_json()
            host_takeover = host_ws.receive_json()
            assert guest_takeover["type"] == "conflict_resolved"
            assert host_takeover["type"] == "conflict_resolved"

            guest_ws.send_json({"type": "typing_start", "target": "track:1:chorus"})
            typing_update = host_ws.receive_json()
            assert typing_update["type"] == "typing"
            assert typing_update["payload"]["state"] == "start"


def test_collab_realtime_hub_falls_back_to_memory_when_redis_not_configured() -> None:
    app = SimpleNamespace(
        state=SimpleNamespace(
            settings=SimpleNamespace(
                collab_realtime_backend="redis",
                collab_realtime_ttl_seconds=120,
                strict_production=False,
                redis_url=None,
            )
        )
    )
    hub = experience_api._get_collab_realtime_hub(app)
    assert isinstance(hub, experience_api.CollabRealtimeHub)
    assert not isinstance(hub, experience_api.RedisCollabRealtimeHub)


def test_collab_realtime_hub_uses_redis_backend_when_available(monkeypatch) -> None:
    redis_module = types.ModuleType("redis")
    redis_asyncio_module = types.ModuleType("redis.asyncio")

    class _FakeRedisClient:
        pass

    def _from_url(redis_url: str, *, decode_responses: bool) -> _FakeRedisClient:
        assert redis_url == "redis://localhost:6379/0"
        assert decode_responses
        return _FakeRedisClient()

    redis_asyncio_module.from_url = _from_url  # type: ignore[attr-defined]
    redis_module.asyncio = redis_asyncio_module  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "redis", redis_module)
    monkeypatch.setitem(sys.modules, "redis.asyncio", redis_asyncio_module)

    app = SimpleNamespace(
        state=SimpleNamespace(
            settings=SimpleNamespace(
                collab_realtime_backend="redis",
                collab_realtime_ttl_seconds=120,
                strict_production=False,
                redis_url="redis://localhost:6379/0",
            )
        )
    )
    hub = experience_api._get_collab_realtime_hub(app)
    assert isinstance(hub, experience_api.RedisCollabRealtimeHub)


def test_remix_battle_flow_and_public_share(monkeypatch):
    client = _make_client(monkeypatch)
    album_id = _seed_album(client)

    created = client.post(
        f"/api/v1/albums/{album_id}/experience/remix-battles",
        json={
            "alias": "host",
            "title": "Neon Battle",
            "prompt": "Flip track 1 into a peak-time remix.",
        },
    )
    assert created.status_code == 200
    battle = created.json()
    battle_id = battle["id"]

    submitted = client.post(
        f"/api/v1/albums/{album_id}/experience/remix-battles/{battle_id}/submissions",
        json={
            "alias": "guest1",
            "title": "Pulse Runner",
            "concept": "Stack syncopated bass and half-time pre-chorus drums.",
            "preview_hook": "I run on neon static.",
        },
    )
    assert submitted.status_code == 200
    payload = submitted.json()
    assert payload["submissions"]
    submission_id = payload["submissions"][0]["id"]

    voted = client.post(
        (
            f"/api/v1/albums/{album_id}/experience/remix-battles/"
            f"{battle_id}/submissions/{submission_id}/vote"
        ),
        json={"alias": "host", "score": 5},
    )
    assert voted.status_code == 200
    assert voted.json()["submissions"][0]["vote_count"] == 1

    share_slug = voted.json()["share_slug"]
    public_page = client.get(f"/api/v1/experience/remix-battles/share/{share_slug}")
    assert public_page.status_code == 200
    public_payload = public_page.json()
    assert public_payload["leaderboard_summary"]
    assert public_payload["submissions"]

    closed = client.post(
        f"/api/v1/albums/{album_id}/experience/remix-battles/{battle_id}/close",
        json={"alias": "host"},
    )
    assert closed.status_code == 200
    assert closed.json()["status"] == "closed"

    blocked_vote = client.post(
        (
            f"/api/v1/albums/{album_id}/experience/remix-battles/"
            f"{battle_id}/submissions/{submission_id}/vote"
        ),
        json={"alias": "guest2", "score": 4},
    )
    assert blocked_vote.status_code == 409


def test_daw_handoff_pack_generation(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    client = _make_client(monkeypatch)
    album_id = _seed_album(client, title="Handoff Atlas")

    response = client.post(
        f"/api/v1/albums/{album_id}/experience/daw-handoff",
        json={
            "daw_targets": ["ableton", "logic"],
            "include_midi_guides": True,
            "bpm_strategy": "median",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    bundle_dir = Path(payload["bundle_dir"])
    zip_path = Path(payload["zip_path"])
    assert bundle_dir.exists()
    assert zip_path.exists()
    assert "ableton_live_template.json" in payload["files"]
    assert "logic_pro_template.json" in payload["files"]
    assert "release_kit.json" in payload["files"]
    assert "reference_analyzer.json" in payload["files"]
    assert "arrangement_map.csv" in payload["files"]
    assert any(
        file_name.endswith(".mid") or file_name == "midi_guides_unavailable.txt"
        for file_name in payload["files"]
    )
