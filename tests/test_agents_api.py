"""Tests for agent API endpoints."""

import threading
import time
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from album_conceptualizer.api.app import create_app
from album_conceptualizer.config import reset_settings


@pytest.fixture
def agent_client(monkeypatch):
    """Client with no auth and ANTHROPIC_API_KEY set."""
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_STORAGE_BACKEND", "memory")
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEY", raising=False)
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEYS", raising=False)
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_STRICT_PRODUCTION", raising=False)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    reset_settings()
    app = create_app()
    with TestClient(app) as tc:
        yield tc
    reset_settings()


def _mock_crew():
    """Return a mock Crew whose kickoff() returns a canned result."""
    crew = MagicMock()
    crew.kickoff.return_value = "Album vision: a concept album about time travel"
    return crew


def _seed_album(client: TestClient) -> str:
    """Create an album and return its ID."""
    resp = client.post(
        "/api/v1/albums",
        json={"title": "Test Album", "artist": "Artist"},
    )
    return resp.json()["id"]


def _seed_bible(client: TestClient, album_id: str) -> None:
    """Create an album bible."""
    client.put(
        f"/api/v1/albums/{album_id}/bible",
        json={
            "album_title": "Test Album",
            "logline": "A test album.",
            "synopsis": "Synopsis.",
            "themes": [{"name": "Test", "description": "A test theme"}],
        },
    )


class TestIdeation:
    @patch("album_conceptualizer.api.v1.agents.create_album_ideation_crew")
    def test_start_ideation_returns_202(self, mock_create, agent_client):
        mock_create.return_value = _mock_crew()
        resp = agent_client.post(
            "/api/v1/agents/ideation",
            json={"concept": "Time travel love story"},
        )
        assert resp.status_code == 202
        data = resp.json()
        assert "job_id" in data
        assert data["status"] == "pending"

    @patch("album_conceptualizer.api.v1.agents.create_album_ideation_crew")
    def test_ideation_job_completes(self, mock_create, agent_client):
        mock_create.return_value = _mock_crew()
        resp = agent_client.post(
            "/api/v1/agents/ideation",
            json={"concept": "Time travel love story"},
        )
        job_id = resp.json()["job_id"]
        # Poll until complete (mock is instant)
        for _ in range(20):
            poll = agent_client.get(f"/api/v1/agents/jobs/{job_id}")
            if poll.json()["status"] in ("completed", "failed"):
                break
            time.sleep(0.1)
        assert poll.json()["status"] == "completed"
        assert poll.json()["result"]["output"]

    def test_ideation_missing_concept_returns_422(self, agent_client):
        resp = agent_client.post("/api/v1/agents/ideation", json={})
        assert resp.status_code == 422


class TestSongDevelopment:
    @patch("album_conceptualizer.api.v1.agents.create_song_development_crew")
    def test_start_song_dev_returns_202(self, mock_create, agent_client):
        mock_create.return_value = _mock_crew()
        album_id = _seed_album(agent_client)
        _seed_bible(agent_client, album_id)
        resp = agent_client.post(
            "/api/v1/agents/song-development",
            json={
                "album_id": album_id,
                "song_title": "Track 1",
                "track_number": 1,
            },
        )
        assert resp.status_code == 202

    @patch("album_conceptualizer.api.v1.agents.create_song_development_crew")
    def test_song_dev_album_not_found(self, mock_create, agent_client):
        resp = agent_client.post(
            "/api/v1/agents/song-development",
            json={
                "album_id": "nonexistent",
                "song_title": "Track 1",
                "track_number": 1,
            },
        )
        assert resp.status_code == 404

    @patch("album_conceptualizer.api.v1.agents.create_song_development_crew")
    def test_song_dev_bible_not_found(self, mock_create, agent_client):
        album_id = _seed_album(agent_client)
        # No bible created
        resp = agent_client.post(
            "/api/v1/agents/song-development",
            json={
                "album_id": album_id,
                "song_title": "Track 1",
                "track_number": 1,
            },
        )
        assert resp.status_code == 404
        assert "bible" in resp.json()["detail"].lower()


class TestCoherenceReview:
    @patch("album_conceptualizer.api.v1.agents.create_coherence_review_crew")
    def test_start_coherence_review_returns_202(self, mock_create, agent_client):
        mock_create.return_value = _mock_crew()
        album_id = _seed_album(agent_client)
        _seed_bible(agent_client, album_id)
        resp = agent_client.post(
            "/api/v1/agents/coherence-review",
            json={"album_id": album_id},
        )
        assert resp.status_code == 202

    @patch("album_conceptualizer.api.v1.agents.create_coherence_review_crew")
    def test_coherence_with_songs_assembles_content(self, mock_create, agent_client):
        """Verify album_content is assembled from songs and sections."""
        mock_create.return_value = _mock_crew()
        album_id = _seed_album(agent_client)
        _seed_bible(agent_client, album_id)
        # Add a song with sections
        agent_client.post(
            f"/api/v1/albums/{album_id}/songs",
            json={
                "title": "Opening",
                "track_number": 1,
                "sections": [
                    {"section_type": "verse", "order": 1, "lyrics": "Hello world"},
                    {"section_type": "chorus", "order": 2, "lyrics": "La la la"},
                ],
            },
        )
        resp = agent_client.post(
            "/api/v1/agents/coherence-review",
            json={"album_id": album_id},
        )
        assert resp.status_code == 202
        # Verify the crew was called with assembled content
        call_kwargs = mock_create.call_args
        album_content = call_kwargs.kwargs.get("album_content") or call_kwargs[1].get(
            "album_content", call_kwargs[0][1] if len(call_kwargs[0]) > 1 else ""
        )
        assert "Opening" in album_content
        assert "Hello world" in album_content

    @patch("album_conceptualizer.api.v1.agents.create_coherence_review_crew")
    def test_coherence_album_not_found(self, mock_create, agent_client):
        resp = agent_client.post(
            "/api/v1/agents/coherence-review",
            json={"album_id": "nonexistent"},
        )
        assert resp.status_code == 404


class TestJobEndpoints:
    @patch("album_conceptualizer.api.v1.agents.create_album_ideation_crew")
    def test_list_jobs(self, mock_create, agent_client):
        mock_create.return_value = _mock_crew()
        agent_client.post(
            "/api/v1/agents/ideation",
            json={"concept": "Album 1"},
        )
        agent_client.post(
            "/api/v1/agents/ideation",
            json={"concept": "Album 2"},
        )
        resp = agent_client.get("/api/v1/agents/jobs")
        assert resp.status_code == 200
        assert len(resp.json()) >= 2

    @patch("album_conceptualizer.api.v1.agents.create_album_ideation_crew")
    def test_list_jobs_filtered_by_status(self, mock_create, agent_client):
        mock_create.return_value = _mock_crew()
        agent_client.post(
            "/api/v1/agents/ideation",
            json={"concept": "Album"},
        )
        # Wait for completion
        time.sleep(0.3)
        resp = agent_client.get("/api/v1/agents/jobs?status=completed")
        assert resp.status_code == 200
        for job in resp.json():
            assert job["status"] == "completed"

    def test_get_job_not_found(self, agent_client):
        resp = agent_client.get("/api/v1/agents/jobs/nonexistent")
        assert resp.status_code == 404

    @patch("album_conceptualizer.api.v1.agents.create_album_ideation_crew")
    def test_delete_completed_job(self, mock_create, agent_client):
        mock_create.return_value = _mock_crew()
        resp = agent_client.post(
            "/api/v1/agents/ideation",
            json={"concept": "Throwaway"},
        )
        job_id = resp.json()["job_id"]
        # Wait for completion
        for _ in range(20):
            poll = agent_client.get(f"/api/v1/agents/jobs/{job_id}")
            if poll.json()["status"] in ("completed", "failed"):
                break
            time.sleep(0.1)
        delete = agent_client.delete(f"/api/v1/agents/jobs/{job_id}")
        assert delete.status_code == 204
        assert agent_client.get(f"/api/v1/agents/jobs/{job_id}").status_code == 404

    def test_delete_nonexistent_job(self, agent_client):
        resp = agent_client.delete("/api/v1/agents/jobs/ghost")
        assert resp.status_code == 404


class TestNoApiKey:
    @patch("album_conceptualizer.api.v1.agents.create_album_ideation_crew")
    def test_ideation_without_anthropic_key(self, mock_create, monkeypatch):
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_STORAGE_BACKEND", "memory")
        monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEY", raising=False)
        monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEYS", raising=False)
        monkeypatch.delenv("ALBUM_CONCEPTUALIZER_STRICT_PRODUCTION", raising=False)
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        reset_settings()
        app = create_app()
        with TestClient(app) as tc:
            resp = tc.post(
                "/api/v1/agents/ideation",
                json={"concept": "Test"},
            )
            assert resp.status_code == 503
            assert "ANTHROPIC_API_KEY" in resp.json()["detail"]
        reset_settings()


class TestCrewFailure:
    @patch("album_conceptualizer.api.v1.agents.create_album_ideation_crew")
    def test_crew_failure_sets_job_failed(self, mock_create, agent_client):
        crew = MagicMock()
        crew.kickoff.side_effect = RuntimeError("LLM error")
        mock_create.return_value = crew
        resp = agent_client.post(
            "/api/v1/agents/ideation",
            json={"concept": "Doomed album"},
        )
        job_id = resp.json()["job_id"]
        for _ in range(20):
            poll = agent_client.get(f"/api/v1/agents/jobs/{job_id}")
            if poll.json()["status"] in ("completed", "failed"):
                break
            time.sleep(0.1)
        data = poll.json()
        assert data["status"] == "failed"
        assert "LLM error" in data["error"]


class TestCrewTimeout:
    @patch("album_conceptualizer.api.v1.agents.CREW_TIMEOUT_SECONDS", 1)
    @patch("album_conceptualizer.api.v1.agents.create_album_ideation_crew")
    def test_slow_crew_times_out(self, mock_create, agent_client):
        """A crew that takes longer than the timeout should produce a FAILED job."""
        crew = MagicMock()
        crew.kickoff.side_effect = lambda: time.sleep(5) or "done"
        mock_create.return_value = crew
        resp = agent_client.post(
            "/api/v1/agents/ideation",
            json={"concept": "Slow album"},
        )
        assert resp.status_code == 202
        job_id = resp.json()["job_id"]
        # Wait for the timeout (set to 1s) + some margin.
        for _ in range(30):
            poll = agent_client.get(f"/api/v1/agents/jobs/{job_id}")
            if poll.json()["status"] in ("completed", "failed"):
                break
            time.sleep(0.2)
        data = poll.json()
        assert data["status"] == "failed"
        assert "Timed out" in data["error"]


class TestConcurrencyLimit:
    @patch("album_conceptualizer.api.v1.agents.MAX_ACTIVE_JOBS", 2)
    @patch("album_conceptualizer.api.v1.agents.create_album_ideation_crew")
    def test_third_job_rejected_when_two_active(self, mock_create, agent_client):
        """When the active-job limit is reached, new jobs should get 429."""
        # Create a crew that never finishes so jobs stay active.
        crew = MagicMock()
        crew.kickoff.side_effect = lambda: time.sleep(10)
        mock_create.return_value = crew

        resp1 = agent_client.post(
            "/api/v1/agents/ideation",
            json={"concept": "Album 1"},
        )
        assert resp1.status_code == 202

        resp2 = agent_client.post(
            "/api/v1/agents/ideation",
            json={"concept": "Album 2"},
        )
        assert resp2.status_code == 202

        # Third should be rejected.
        resp3 = agent_client.post(
            "/api/v1/agents/ideation",
            json={"concept": "Album 3"},
        )
        assert resp3.status_code == 429
        assert "Too many active agent jobs" in resp3.json()["detail"]

    @patch("album_conceptualizer.api.v1.agents.MAX_ACTIVE_JOBS", 3)
    @patch("album_conceptualizer.api.v1.agents.create_album_ideation_crew")
    def test_parallel_submits_do_not_exceed_the_cap(self, mock_create, agent_client):
        """Requests racing past the check together must not all start a crew."""
        gate = threading.Event()
        crew = MagicMock()
        crew.kickoff.side_effect = lambda: gate.wait(10) and "done"

        def slow_create(**_kwargs):
            time.sleep(0.2)  # building a crew takes time; the race window stays open
            return crew

        mock_create.side_effect = slow_create
        barrier = threading.Barrier(8)
        codes: list[int] = []

        def attempt(i: int) -> None:
            barrier.wait()
            resp = agent_client.post(
                "/api/v1/agents/ideation",
                json={"concept": f"Album {i}"},
                headers={"x-owner-id": f"owner-{i}"},
            )
            codes.append(resp.status_code)

        threads = [threading.Thread(target=attempt, args=(i,)) for i in range(8)]
        try:
            for t in threads:
                t.start()
            for t in threads:
                t.join()
            assert sorted(codes) == [202] * 3 + [429] * 5
        finally:
            gate.set()

    @patch("album_conceptualizer.api.v1.agents.MAX_ACTIVE_JOBS_PER_OWNER", 2)
    @patch("album_conceptualizer.api.v1.agents.create_album_ideation_crew")
    def test_one_owner_cannot_hold_every_slot(self, mock_create, agent_client):
        gate = threading.Event()
        crew = MagicMock()
        crew.kickoff.side_effect = lambda: gate.wait(10) and "done"
        mock_create.return_value = crew

        def start(owner: str):
            return agent_client.post(
                "/api/v1/agents/ideation",
                json={"concept": "Album"},
                headers={"x-owner-id": owner},
            )

        try:
            assert start("alice").status_code == 202
            assert start("alice").status_code == 202
            third = start("alice")
            assert third.status_code == 429
            assert third.json()["detail"] == (
                "You already have 2 agent jobs running (the limit is 2). "
                "Wait for one to finish before starting another."
            )
            assert third.headers["retry-after"] == "30"
            assert start("bob").status_code == 202
        finally:
            gate.set()


WEB_SNAPSHOT = {
    "id": "clx9webalbumcuid",
    "title": "Glass Harbor",
    "artist": "The Tides",
    "concept_summary": "A lighthouse keeper loses the light. The town forgets the sea.",
    "primary_genre": "art rock",
    "central_themes": ["memory"],
    "recurring_motifs": ["foghorn"],
    "style_bible": {"lead_voice": "weathered baritone", "sonic_palette": ["tape hiss"]},
    "songs": [
        {
            "id": "not-a-uuid",
            "title": "Opening Night",
            "track_number": 1,
            "themes": ["memory", "loss"],
            "characters": ["Keeper"],
            "sections": [
                {"section_type": "hook", "order": 0, "lyrics": "The light goes out"},
                {"section_type": "verse", "order": 1, "lyrics": "Salt on the glass"},
            ],
        }
    ],
}


class TestAlbumSnapshots:
    """The web app sends album snapshots; the engine must not need its own copy."""

    @patch("album_conceptualizer.api.v1.agents.create_song_development_crew")
    def test_song_development_from_snapshot(self, mock_create, agent_client):
        mock_create.return_value = _mock_crew()
        resp = agent_client.post(
            "/api/v1/agents/song-development",
            json={"album": WEB_SNAPSHOT, "song_title": "Opening Night", "track_number": 1},
        )
        assert resp.status_code == 202
        bible = mock_create.call_args.kwargs["album_bible"]
        assert bible.album_title == "Glass Harbor"
        assert bible.logline == "A lighthouse keeper loses the light"
        assert [t.name for t in bible.themes] == ["memory", "loss"]
        assert bible.themes[0].primary_songs == [1]
        assert [m.name for m in bible.motifs] == ["foghorn"]
        assert [c.name for c in bible.characters] == ["Keeper"]
        assert bible.style_profile.primary_genre == "art rock"
        assert "weathered baritone" in bible.style_profile.lyrical_tone
        assert "tape hiss" in bible.style_profile.production_notes

    @patch("album_conceptualizer.api.v1.agents.create_coherence_review_crew")
    def test_coherence_review_from_snapshot(self, mock_create, agent_client):
        mock_create.return_value = _mock_crew()
        resp = agent_client.post("/api/v1/agents/coherence-review", json={"album": WEB_SNAPSHOT})
        assert resp.status_code == 202
        content = mock_create.call_args.kwargs["album_content"]
        assert "Track 1: Opening Night" in content
        assert "[chorus] The light goes out" in content

    def test_requires_album_or_album_id(self, agent_client):
        resp = agent_client.post("/api/v1/agents/coherence-review", json={})
        assert resp.status_code == 422

    def test_malformed_snapshot_is_400(self, agent_client):
        resp = agent_client.post(
            "/api/v1/agents/coherence-review", json={"album": {"songs": "nope"}}
        )
        assert resp.status_code == 400


class TestJobOwnership:
    @patch("album_conceptualizer.api.v1.agents.create_album_ideation_crew")
    def test_other_owner_cannot_see_or_delete_job(self, mock_create, agent_client):
        mock_create.return_value = _mock_crew()
        job_id = agent_client.post(
            "/api/v1/agents/ideation",
            json={"concept": "Private"},
            headers={"x-owner-id": "alice"},
        ).json()["job_id"]
        bob = {"x-owner-id": "bob"}
        assert agent_client.get(f"/api/v1/agents/jobs/{job_id}", headers=bob).status_code == 404
        assert all(
            j["job_id"] != job_id
            for j in agent_client.get("/api/v1/agents/jobs", headers=bob).json()
        )
        assert agent_client.delete(f"/api/v1/agents/jobs/{job_id}", headers=bob).status_code == 404
        alice = {"x-owner-id": "alice"}
        assert agent_client.get(f"/api/v1/agents/jobs/{job_id}", headers=alice).status_code == 200


class TestAgentStatus:
    def test_available_needs_key_and_crews(self, agent_client):
        with (
            patch("album_conceptualizer.api.v1.agents.create_album_ideation_crew", MagicMock()),
            patch("album_conceptualizer.api.v1.agents.create_song_development_crew", MagicMock()),
            patch("album_conceptualizer.api.v1.agents.create_coherence_review_crew", MagicMock()),
        ):
            assert agent_client.get("/api/v1/agents/status").json() == {"available": True}

    def test_unavailable_without_crews(self, agent_client):
        with patch("album_conceptualizer.api.v1.agents.create_album_ideation_crew", None):
            assert agent_client.get("/api/v1/agents/status").json() == {"available": False}
