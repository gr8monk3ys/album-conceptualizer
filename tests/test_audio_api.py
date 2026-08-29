"""Endpoints for in-app music generation.

No network and no provider token: the provider is swapped for a fake so the
job lifecycle, the concurrency limit, owner scoping and the unconfigured path
are all exercised deterministically.
"""

from __future__ import annotations

import pytest

import album_conceptualizer.api.v1.audio as audio_api
from album_conceptualizer.api.jobs import JobStore
from album_conceptualizer.audio.providers import (
    GenerationResult,
    ProviderRequestError,
)


BRIEF = {
    "song_title": "Ash Harbour",
    "album_genre": "post-rock",
    "lead_voice": "breathy alto",
    "sonic_palette": ["warm analog"],
    "avoid_list": ["autotune"],
    "tempo": 88,
    "duration_seconds": 15,
}


class FakeProvider:
    name = "fake"

    def __init__(self, error: Exception | None = None) -> None:
        self.error = error
        self.calls: list = []

    def generate(self, request):
        self.calls.append(request)
        if self.error:
            raise self.error
        return GenerationResult(
            audio_url="https://cdn/track.wav",
            provider=self.name,
            model="fake-model",
            duration_seconds=request.duration_seconds,
            prompt=request.prompt,
        )


@pytest.fixture(autouse=True)
def _isolate_job_store(monkeypatch):
    # Each test gets its own store; the module-level one would otherwise leak
    # active jobs across tests and trip the concurrency limit at random.
    monkeypatch.setattr(audio_api, "_render_jobs", JobStore(ttl_seconds=60))


def _use(monkeypatch, provider):
    monkeypatch.setattr(audio_api, "get_provider", lambda: provider)
    return provider


# --- prompt preview ----------------------------------------------------------

def test_prompt_preview_spends_nothing_and_shows_what_would_be_sent(client, monkeypatch):
    provider = _use(monkeypatch, FakeProvider())
    response = client.post("/api/v1/audio/prompt-preview", json=BRIEF)
    assert response.status_code == 200
    body = response.json()
    assert body["prompt"].startswith("post-rock")
    assert body["negative_prompt"] == "autotune"
    assert body["provider"] == "fake"
    assert provider.calls == []  # nothing was generated


def test_prompt_preview_works_with_no_provider_configured(client, monkeypatch):
    from album_conceptualizer.audio.providers import UnconfiguredProvider

    _use(monkeypatch, UnconfiguredProvider())
    response = client.post("/api/v1/audio/prompt-preview", json=BRIEF)
    assert response.status_code == 200
    assert response.json()["provider"] == "unconfigured"


# --- generate ----------------------------------------------------------------

def test_generate_runs_the_job_and_returns_the_audio_url(client, monkeypatch):
    provider = _use(monkeypatch, FakeProvider())
    response = client.post("/api/v1/audio/generate", json=BRIEF)
    assert response.status_code == 202
    job_id = response.json()["job_id"]

    # TestClient runs BackgroundTasks before the response is released, so the
    # job is already terminal here.
    polled = client.get(f"/api/v1/audio/generate/{job_id}")
    assert polled.status_code == 200
    body = polled.json()
    assert body["status"] == "completed"
    assert body["result"]["audio_url"] == "https://cdn/track.wav"
    assert body["result"]["duration_seconds"] == 15

    sent = provider.calls[0]
    assert sent.prompt.startswith("post-rock")
    assert sent.negative_prompt == "autotune"
    assert sent.duration_seconds == 15


def test_unconfigured_provider_is_503_before_a_job_is_created(client, monkeypatch):
    from album_conceptualizer.audio.providers import UnconfiguredProvider

    _use(monkeypatch, UnconfiguredProvider())
    response = client.post("/api/v1/audio/generate", json=BRIEF)
    assert response.status_code == 503
    assert "MUSIC_PROVIDER" in response.json()["detail"]
    # A job that could only ever fail must not exist.
    assert audio_api._render_jobs.count_active() == 0


def test_provider_failure_is_reported_verbatim_on_the_job(client, monkeypatch):
    _use(monkeypatch, FakeProvider(error=ProviderRequestError("prompt rejected")))
    job_id = client.post("/api/v1/audio/generate", json=BRIEF).json()["job_id"]
    body = client.get(f"/api/v1/audio/generate/{job_id}").json()
    assert body["status"] == "failed"
    assert body["error"] == "prompt rejected"


def test_unexpected_provider_exception_still_fails_the_job(client, monkeypatch):
    # A job must never be left RUNNING forever by an error nobody anticipated.
    _use(monkeypatch, FakeProvider(error=ValueError("boom")))
    job_id = client.post("/api/v1/audio/generate", json=BRIEF).json()["job_id"]
    body = client.get(f"/api/v1/audio/generate/{job_id}").json()
    assert body["status"] == "failed"
    assert "boom" in body["error"]


def test_concurrency_limit_is_per_owner(client, monkeypatch):
    _use(monkeypatch, FakeProvider())
    store = audio_api._render_jobs
    for _ in range(audio_api.MAX_ACTIVE_RENDERS):
        store.create("music_generation", owner_id="alice")  # left PENDING

    blocked = client.post("/api/v1/audio/generate", json=BRIEF, headers={"x-owner-id": "alice"})
    assert blocked.status_code == 429
    assert blocked.headers["retry-after"] == "30"

    # Another tenant is unaffected by alice's queue.
    assert client.post(
        "/api/v1/audio/generate", json=BRIEF, headers={"x-owner-id": "bob"}
    ).status_code == 202


def test_one_owner_cannot_read_anothers_render(client, monkeypatch):
    _use(monkeypatch, FakeProvider())
    job_id = client.post(
        "/api/v1/audio/generate", json=BRIEF, headers={"x-owner-id": "alice"}
    ).json()["job_id"]

    # 404, not 403, so job ids are not enumerable.
    assert client.get(
        f"/api/v1/audio/generate/{job_id}", headers={"x-owner-id": "mallory"}
    ).status_code == 404
    assert client.get(
        f"/api/v1/audio/generate/{job_id}", headers={"x-owner-id": "alice"}
    ).status_code == 200


def test_unknown_job_is_404(client):
    assert client.get("/api/v1/audio/generate/does-not-exist").status_code == 404


@pytest.mark.parametrize(
    "patch",
    [
        {"song_title": ""},
        {"duration_seconds": 0},
        {"duration_seconds": 5000},
        {"tempo": 5},
        {"seed": -1},
    ],
)
def test_invalid_payloads_are_rejected(client, monkeypatch, patch):
    _use(monkeypatch, FakeProvider())
    assert client.post("/api/v1/audio/generate", json={**BRIEF, **patch}).status_code == 422
