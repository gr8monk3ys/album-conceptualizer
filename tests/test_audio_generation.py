"""Text-to-music prompt construction and provider behaviour.

No network. The Replicate provider is exercised through an injected
httpx.Client backed by a MockTransport, so the real request/response shapes
are covered without a token or a paid call.
"""

from __future__ import annotations

import httpx
import pytest

from album_conceptualizer.audio.prompt import (
    MAX_PROMPT_CHARS,
    GenerationBrief,
    build_generation_prompt,
    build_negative_prompt,
)
from album_conceptualizer.audio.providers import (
    GenerationRequest,
    ProviderNotConfiguredError,
    ProviderRequestError,
    ReplicateProvider,
    UnconfiguredProvider,
    get_provider,
)


def brief(**overrides) -> GenerationBrief:
    base = {
        "song_title": "Ash Harbour",
        "album_genre": "post-rock",
        "lead_voice": "breathy alto",
        "sonic_palette": ["warm analog", "tape hiss"],
        "emotional_targets": ["longing"],
        "avoid_list": ["autotune"],
        "tempo": 88,
        "key": "D minor",
        "mood_tags": ["nocturnal"],
        "instrumentation": ["fretless bass"],
        "narrative_summary": "a harbour town emptying out",
    }
    base.update(overrides)
    return GenerationBrief(**base)


# --- prompt: the album leads -------------------------------------------------


def test_album_identity_comes_first():
    # Providers weight early tokens and truncate from the end, so genre and
    # voice must precede song-level detail.
    prompt = build_generation_prompt(brief())
    assert prompt.startswith("post-rock")
    assert prompt.index("breathy alto") < prompt.index("88 bpm")
    assert prompt.index("warm analog") < prompt.index("a harbour town")


def test_palette_dedupes_case_insensitively():
    prompt = build_generation_prompt(brief(sonic_palette=["Warm Analog", "warm analog", "tape"]))
    assert prompt.lower().count("warm analog") == 1


def test_instrumental_and_a_lead_voice_are_never_both_asserted():
    # "instrumental" plus a described vocal is a contradiction models resolve
    # unpredictably; only one instruction may reach the provider.
    instrumental = build_generation_prompt(brief(instrumental=True))
    assert "no vocals" in instrumental
    assert "lead vocal:" not in instrumental

    sung = build_generation_prompt(brief(instrumental=False))
    assert "lead vocal: breathy alto" in sung
    assert "no vocals" not in sung


def test_instrumental_without_a_lead_voice_still_says_so():
    assert "instrumental, no vocals" in build_generation_prompt(
        brief(lead_voice=None, instrumental=True)
    )


def test_narrative_falls_back_to_the_album_concept():
    prompt = build_generation_prompt(
        brief(narrative_summary=None, concept_summary="a town that forgot the sea")
    )
    assert "a town that forgot the sea" in prompt


def test_empty_brief_does_not_produce_stray_separators():
    prompt = build_generation_prompt(GenerationBrief(song_title="Untitled", instrumental=False))
    assert prompt == ""


def test_truncation_drops_whole_clauses_and_keeps_the_album():
    prompt = build_generation_prompt(
        brief(narrative_summary="x " * 2000, sonic_palette=["warm analog"])
    )
    assert len(prompt) <= MAX_PROMPT_CHARS
    assert prompt.startswith("post-rock")
    assert not prompt.endswith(",")
    # A dropped clause must not leave a half-word behind.
    assert "  " not in prompt


# --- negative prompt ---------------------------------------------------------


def test_negative_prompt_is_the_albums_avoid_list():
    assert build_negative_prompt(brief(avoid_list=["autotune", "trap hats"])) == (
        "autotune, trap hats"
    )


def test_no_avoid_list_means_no_constraint_not_a_house_default():
    assert build_negative_prompt(brief(avoid_list=[])) == ""


# --- provider resolution -----------------------------------------------------


def test_nothing_configured_resolves_to_a_provider_that_explains_itself(monkeypatch):
    monkeypatch.delenv("MUSIC_PROVIDER", raising=False)
    provider = get_provider()
    assert isinstance(provider, UnconfiguredProvider)
    with pytest.raises(ProviderNotConfiguredError, match="MUSIC_PROVIDER"):
        provider.generate(GenerationRequest(prompt="anything"))


def test_provider_named_but_token_missing_still_does_not_raise_at_resolve_time(monkeypatch):
    # Resolution must stay safe so the app boots and unrelated routes serve.
    monkeypatch.setenv("MUSIC_PROVIDER", "replicate")
    monkeypatch.delenv("REPLICATE_API_TOKEN", raising=False)
    assert isinstance(get_provider(), UnconfiguredProvider)


def test_unknown_provider_is_a_configuration_error(monkeypatch):
    monkeypatch.setenv("MUSIC_PROVIDER", "nope")
    with pytest.raises(ProviderNotConfiguredError, match="Unknown MUSIC_PROVIDER"):
        get_provider()


# --- Replicate, over a mock transport ---------------------------------------


def _provider(handler, **kw) -> ReplicateProvider:
    return ReplicateProvider(
        "tok", "model-version", client=httpx.Client(transport=httpx.MockTransport(handler)), **kw
    )


def test_succeeds_and_returns_the_audio_url():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["Authorization"] == "Bearer tok"
        body = request.read().decode()
        assert "warm analog" in body
        return httpx.Response(
            201, json={"status": "succeeded", "output": "https://cdn/audio.wav", "id": "p1"}
        )

    result = _provider(handler).generate(
        GenerationRequest(prompt="post-rock, warm analog", duration_seconds=15)
    )
    assert result.audio_url == "https://cdn/audio.wav"
    assert result.provider == "replicate"
    assert result.duration_seconds == 15


def test_list_output_is_unwrapped_to_a_string():
    # MusicGen returns a bare string; other models return a list. Treating a
    # list as a URL yields a "successful" render pointing at "['https://...']".
    def handler(_):
        return httpx.Response(201, json={"status": "succeeded", "output": ["https://cdn/a.wav"]})

    assert _provider(handler).generate(GenerationRequest(prompt="x")).audio_url == (
        "https://cdn/a.wav"
    )


def test_succeeded_with_no_output_is_an_error_not_an_empty_url():
    def handler(_):
        return httpx.Response(201, json={"status": "succeeded", "output": None})

    with pytest.raises(ProviderRequestError, match="no audio URL"):
        _provider(handler).generate(GenerationRequest(prompt="x"))


def test_polls_until_terminal():
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST":
            return httpx.Response(
                201,
                json={"status": "starting", "urls": {"get": "https://api.replicate.com/v1/p/1"}},
            )
        calls["n"] += 1
        if calls["n"] < 2:
            return httpx.Response(
                200,
                json={"status": "processing", "urls": {"get": "https://api.replicate.com/v1/p/1"}},
            )
        return httpx.Response(200, json={"status": "succeeded", "output": "https://cdn/b.wav"})

    import album_conceptualizer.audio.providers as mod

    original, mod._POLL_INTERVAL_SECONDS = mod._POLL_INTERVAL_SECONDS, 0.0
    try:
        assert _provider(handler).generate(GenerationRequest(prompt="x")).audio_url == (
            "https://cdn/b.wav"
        )
    finally:
        mod._POLL_INTERVAL_SECONDS = original
    assert calls["n"] == 2


def test_failed_prediction_surfaces_the_providers_reason():
    def handler(_):
        return httpx.Response(201, json={"status": "failed", "error": "prompt rejected"})

    with pytest.raises(ProviderRequestError, match="prompt rejected"):
        _provider(handler).generate(GenerationRequest(prompt="x"))


def test_bad_token_is_a_configuration_error_and_is_never_retried():
    def handler(_):
        return httpx.Response(401, json={"detail": "no"})

    with pytest.raises(ProviderNotConfiguredError):
        _provider(handler).generate(GenerationRequest(prompt="x"))


@pytest.mark.parametrize("code", [429, 502, 503, 504])
def test_transient_upstream_failures_are_marked_retryable(code):
    def handler(_):
        return httpx.Response(code, json={})

    with pytest.raises(ProviderRequestError) as excinfo:
        _provider(handler).generate(GenerationRequest(prompt="x"))
    assert excinfo.value.retryable is True


def test_rejected_request_is_not_retryable():
    def handler(_):
        return httpx.Response(422, text="bad input")

    with pytest.raises(ProviderRequestError) as excinfo:
        _provider(handler).generate(GenerationRequest(prompt="x"))
    assert excinfo.value.retryable is False


def test_timeout_reports_how_long_it_waited():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            201 if request.method == "POST" else 200,
            json={"status": "processing", "urls": {"get": "https://api.replicate.com/v1/p/1"}},
        )

    import album_conceptualizer.audio.providers as mod

    original, mod._POLL_INTERVAL_SECONDS = mod._POLL_INTERVAL_SECONDS, 0.0
    try:
        with pytest.raises(ProviderRequestError, match="did not finish within 0s"):
            _provider(handler, timeout_seconds=0).generate(GenerationRequest(prompt="x"))
    finally:
        mod._POLL_INTERVAL_SECONDS = original


def test_negative_prompt_and_seed_reach_the_provider_only_when_set():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        import json as _json

        seen.update(_json.loads(request.read())["input"])
        return httpx.Response(201, json={"status": "succeeded", "output": "https://cdn/c.wav"})

    _provider(handler).generate(GenerationRequest(prompt="x"))
    assert "negative_prompt" not in seen and "seed" not in seen

    seen.clear()
    _provider(handler).generate(GenerationRequest(prompt="x", negative_prompt="autotune", seed=7))
    assert seen["negative_prompt"] == "autotune" and seen["seed"] == 7
