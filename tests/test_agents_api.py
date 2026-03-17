"""Tests for agent API endpoints."""

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
