"""Tests for the audio generation integration layer."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from album_conceptualizer.integrations.audio_gen import (
    AudioGenRequest,
    AudioGenResult,
    AudioGenStatus,
    ReplicateProvider,
    build_song_prompt,
)


# ---------------------------------------------------------------------------
# build_song_prompt
# ---------------------------------------------------------------------------


class TestBuildSongPrompt:
    """Tests for the prompt builder utility."""

    def test_basic_genre_and_mood(self):
        prompt = build_song_prompt(
            song_title="Dawn",
            genre_tags=["ambient", "electronic"],
            mood_tags=["dreamy", "hopeful"],
        )
        assert "ambient" in prompt
        assert "electronic" in prompt
        assert "dreamy" in prompt
        assert "hopeful" in prompt

    def test_instrumentation_and_tempo(self):
        prompt = build_song_prompt(
            song_title="Drive",
            instrumentation=["guitar", "synth"],
            tempo=128,
        )
        assert "guitar" in prompt
        assert "synth" in prompt
        assert "128 BPM" in prompt

    def test_key_included(self):
        prompt = build_song_prompt(
            song_title="Waltz",
            key="Bb minor",
        )
        assert "key of Bb minor" in prompt

    def test_concept_summary_truncated(self):
        long_summary = "x" * 300
        prompt = build_song_prompt(
            song_title="Epic",
            concept_summary=long_summary,
        )
        # The summary portion should be at most 200 characters.
        assert len(long_summary[:200]) <= 200
        assert "x" * 200 in prompt
        assert "x" * 201 not in prompt

    def test_fallback_when_no_tags(self):
        prompt = build_song_prompt(song_title="Untitled")
        assert "instrumental track titled Untitled" in prompt

    def test_all_fields_combined(self):
        prompt = build_song_prompt(
            song_title="Finale",
            genre_tags=["rock"],
            mood_tags=["epic"],
            instrumentation=["drums", "bass"],
            tempo=140,
            key="E minor",
            concept_summary="The hero's triumphant return",
        )
        assert "rock" in prompt
        assert "epic" in prompt
        assert "drums" in prompt
        assert "140 BPM" in prompt
        assert "key of E minor" in prompt
        assert "triumphant" in prompt

    def test_empty_lists_treated_as_absent(self):
        prompt = build_song_prompt(
            song_title="Silent",
            genre_tags=[],
            mood_tags=[],
            instrumentation=[],
        )
        assert "instrumental track titled Silent" in prompt


# ---------------------------------------------------------------------------
# ReplicateProvider – availability
# ---------------------------------------------------------------------------


class TestReplicateProviderAvailability:
    """Tests for the provider's is_available check."""

    def test_available_with_explicit_token(self):
        provider = ReplicateProvider(api_token="r8_test_token")
        assert provider.is_available() is True

    def test_not_available_without_token(self, monkeypatch):
        monkeypatch.delenv("REPLICATE_API_TOKEN", raising=False)
        provider = ReplicateProvider(api_token=None)
        assert provider.is_available() is False

    def test_available_from_env(self, monkeypatch):
        monkeypatch.setenv("REPLICATE_API_TOKEN", "r8_from_env")
        provider = ReplicateProvider()
        assert provider.is_available() is True


# ---------------------------------------------------------------------------
# ReplicateProvider – generate (mocked)
# ---------------------------------------------------------------------------


class TestReplicateProviderGenerate:
    """Tests for the generate method with a mocked replicate client."""

    @pytest.mark.asyncio
    async def test_generate_returns_completed(self, monkeypatch):
        """Successful generation returns COMPLETED with an audio URL."""
        fake_client = MagicMock()
        fake_client.run.return_value = "https://replicate.delivery/audio/test.mp3"

        provider = ReplicateProvider(api_token="r8_test")
        provider._client = fake_client

        request = AudioGenRequest(prompt="chill lo-fi beat", duration_seconds=15)
        result = await provider.generate(request)

        assert result.status == AudioGenStatus.COMPLETED
        assert result.audio_url == "https://replicate.delivery/audio/test.mp3"
        assert result.error is None
        assert result.model_id == "musicgen"
        assert result.metadata["prompt"] == "chill lo-fi beat"
        fake_client.run.assert_called_once()

    @pytest.mark.asyncio
    async def test_generate_handles_list_output(self, monkeypatch):
        """Replicate sometimes returns a list of URLs."""
        fake_client = MagicMock()
        fake_client.run.return_value = [
            "https://replicate.delivery/audio/first.mp3",
            "https://replicate.delivery/audio/second.mp3",
        ]

        provider = ReplicateProvider(api_token="r8_test")
        provider._client = fake_client

        request = AudioGenRequest(prompt="orchestral intro")
        result = await provider.generate(request)

        assert result.status == AudioGenStatus.COMPLETED
        assert result.audio_url == "https://replicate.delivery/audio/first.mp3"

    @pytest.mark.asyncio
    async def test_generate_fails_without_token(self, monkeypatch):
        """Without a token the provider returns FAILED immediately."""
        monkeypatch.delenv("REPLICATE_API_TOKEN", raising=False)
        provider = ReplicateProvider(api_token=None)

        request = AudioGenRequest(prompt="anything")
        result = await provider.generate(request)

        assert result.status == AudioGenStatus.FAILED
        assert "REPLICATE_API_TOKEN" in (result.error or "")

    @pytest.mark.asyncio
    async def test_generate_catches_exception(self):
        """Runtime errors from the client are caught and returned as FAILED."""
        fake_client = MagicMock()
        fake_client.run.side_effect = RuntimeError("API quota exceeded")

        provider = ReplicateProvider(api_token="r8_test")
        provider._client = fake_client

        request = AudioGenRequest(prompt="heavy metal riff")
        result = await provider.generate(request)

        assert result.status == AudioGenStatus.FAILED
        assert "API quota exceeded" in (result.error or "")

    @pytest.mark.asyncio
    async def test_generate_passes_temperature_for_musicgen(self):
        """Temperature is included in input_params only for musicgen."""
        fake_client = MagicMock()
        fake_client.run.return_value = "https://example.com/audio.mp3"

        provider = ReplicateProvider(api_token="r8_test")
        provider._client = fake_client

        request = AudioGenRequest(prompt="test", model_id="musicgen", temperature=0.8)
        await provider.generate(request)

        call_kwargs = fake_client.run.call_args
        input_params = call_kwargs.kwargs.get("input") or call_kwargs[1].get("input")
        assert input_params["temperature"] == 0.8

    @pytest.mark.asyncio
    async def test_generate_omits_temperature_for_stable_audio(self):
        """Temperature is NOT sent for non-musicgen models."""
        fake_client = MagicMock()
        fake_client.run.return_value = "https://example.com/audio.mp3"

        provider = ReplicateProvider(api_token="r8_test")
        provider._client = fake_client

        request = AudioGenRequest(prompt="test", model_id="stable-audio")
        await provider.generate(request)

        call_kwargs = fake_client.run.call_args
        input_params = call_kwargs.kwargs.get("input") or call_kwargs[1].get("input")
        assert "temperature" not in input_params


# ---------------------------------------------------------------------------
# ReplicateProvider – check_status (mocked)
# ---------------------------------------------------------------------------


class TestReplicateProviderCheckStatus:
    """Tests for the check_status method."""

    @pytest.mark.asyncio
    async def test_check_status_completed(self):
        fake_prediction = SimpleNamespace(
            status="succeeded",
            output="https://replicate.delivery/audio/done.mp3",
            error=None,
            model="meta/musicgen",
        )
        fake_client = MagicMock()
        fake_client.predictions.get.return_value = fake_prediction

        provider = ReplicateProvider(api_token="r8_test")
        provider._client = fake_client

        result = await provider.check_status("pred_abc123")

        assert result.status == AudioGenStatus.COMPLETED
        assert result.audio_url == "https://replicate.delivery/audio/done.mp3"
        assert result.error is None

    @pytest.mark.asyncio
    async def test_check_status_failed(self):
        fake_prediction = SimpleNamespace(
            status="failed",
            output=None,
            error="NSFW content detected",
            model="meta/musicgen",
        )
        fake_client = MagicMock()
        fake_client.predictions.get.return_value = fake_prediction

        provider = ReplicateProvider(api_token="r8_test")
        provider._client = fake_client

        result = await provider.check_status("pred_xyz789")

        assert result.status == AudioGenStatus.FAILED
        assert "NSFW" in (result.error or "")

    @pytest.mark.asyncio
    async def test_check_status_processing(self):
        fake_prediction = SimpleNamespace(
            status="processing",
            output=None,
            error=None,
            model="meta/musicgen",
        )
        fake_client = MagicMock()
        fake_client.predictions.get.return_value = fake_prediction

        provider = ReplicateProvider(api_token="r8_test")
        provider._client = fake_client

        result = await provider.check_status("pred_running")

        assert result.status == AudioGenStatus.PROCESSING
        assert result.audio_url is None

    @pytest.mark.asyncio
    async def test_check_status_handles_exception(self):
        fake_client = MagicMock()
        fake_client.predictions.get.side_effect = ConnectionError("timeout")

        provider = ReplicateProvider(api_token="r8_test")
        provider._client = fake_client

        result = await provider.check_status("pred_bad")

        assert result.status == AudioGenStatus.FAILED
        assert "timeout" in (result.error or "")


# ---------------------------------------------------------------------------
# AudioGenResult / AudioGenRequest dataclass sanity
# ---------------------------------------------------------------------------


class TestDataclasses:
    """Basic sanity checks for the data structures."""

    def test_request_defaults(self):
        req = AudioGenRequest(prompt="test")
        assert req.duration_seconds == 30
        assert req.model_id == "musicgen"
        assert req.temperature == 1.0
        assert req.guidance_scale == 3.0
        assert req.output_format == "mp3"

    def test_result_defaults(self):
        res = AudioGenResult(status=AudioGenStatus.PENDING)
        assert res.audio_url is None
        assert res.local_path is None
        assert res.error is None
        assert res.model_id == ""
        assert res.duration_seconds == 0.0
        assert res.metadata == {}

    def test_status_enum_values(self):
        assert AudioGenStatus.PENDING == "pending"
        assert AudioGenStatus.PROCESSING == "processing"
        assert AudioGenStatus.COMPLETED == "completed"
        assert AudioGenStatus.FAILED == "failed"
