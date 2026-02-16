"""AI audio generation integration.

Provides an abstract provider interface and a concrete Replicate implementation
supporting MusicGen and Stable Audio models.  The ``replicate`` package is
imported lazily so the rest of the application works even when the dependency
is not installed.
"""

from __future__ import annotations

import abc
import asyncio
import logging
import os
from dataclasses import dataclass, field
from enum import StrEnum
from pathlib import Path

logger = logging.getLogger("album_conceptualizer.integrations.audio_gen")


# ---------------------------------------------------------------------------
# Data types
# ---------------------------------------------------------------------------


class AudioGenStatus(StrEnum):
    """Lifecycle status of an audio generation request."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class AudioGenRequest:
    """Parameters for an audio generation request."""

    prompt: str
    duration_seconds: int = 30
    model_id: str = "musicgen"
    temperature: float = 1.0
    guidance_scale: float = 3.0
    output_format: str = "mp3"


@dataclass
class AudioGenResult:
    """Result of an audio generation request."""

    status: AudioGenStatus
    audio_url: str | None = None
    local_path: Path | None = None
    error: str | None = None
    model_id: str = ""
    duration_seconds: float = 0.0
    metadata: dict = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Abstract provider
# ---------------------------------------------------------------------------


class AudioGenerationProvider(abc.ABC):
    """Abstract base for audio generation providers."""

    @abc.abstractmethod
    async def generate(self, request: AudioGenRequest) -> AudioGenResult: ...

    @abc.abstractmethod
    async def check_status(self, prediction_id: str) -> AudioGenResult: ...

    @abc.abstractmethod
    def is_available(self) -> bool: ...


# ---------------------------------------------------------------------------
# Replicate provider
# ---------------------------------------------------------------------------


class ReplicateProvider(AudioGenerationProvider):
    """Replicate API provider supporting MusicGen and Stable Audio.

    Model version strings change frequently on Replicate.  Update the values
    in ``MODELS`` when newer versions are published.
    """

    # NOTE: Replace the version hashes below with the latest available on
    # https://replicate.com when deploying.
    MODELS: dict[str, str] = {
        "musicgen": "meta/musicgen:b05b1dff1d8c6dc63d14b0cdb42135571e41c36ba2865ab1c0f35a4b2472de13",
        "stable-audio": "stability-ai/stable-audio-open-1.0",
    }

    def __init__(self, api_token: str | None = None) -> None:
        self._token = api_token or os.environ.get("REPLICATE_API_TOKEN")
        self._client: object | None = None

    # -- internal helpers ---------------------------------------------------

    def _get_client(self):  # noqa: ANN202
        """Lazily instantiate the Replicate client."""
        if self._client is None:
            try:
                import replicate  # type: ignore[import-untyped]

                self._client = replicate.Client(api_token=self._token)
            except ImportError:
                raise ImportError(
                    "The 'replicate' package is required for audio generation. "
                    "Install it with: pip install replicate"
                ) from None
        return self._client

    # -- public interface ---------------------------------------------------

    def is_available(self) -> bool:
        """Return *True* when an API token has been configured."""
        return bool(self._token)

    async def generate(self, request: AudioGenRequest) -> AudioGenResult:
        """Submit a generation request to Replicate and wait for the result."""
        if not self.is_available():
            return AudioGenResult(
                status=AudioGenStatus.FAILED,
                error="REPLICATE_API_TOKEN not set",
            )

        try:
            client = self._get_client()
            model_version = self.MODELS.get(request.model_id, self.MODELS["musicgen"])

            input_params: dict[str, object] = {
                "prompt": request.prompt,
                "duration": request.duration_seconds,
                "output_format": request.output_format,
            }
            if request.model_id == "musicgen":
                input_params["temperature"] = request.temperature

            logger.info(
                "submitting audio generation",
                extra={"model": request.model_id, "prompt": request.prompt[:100]},
            )

            output = await asyncio.to_thread(
                client.run,
                model_version,
                input=input_params,
            )

            # Replicate may return a URL string or a list of URL strings.
            audio_url = output if isinstance(output, str) else (output[0] if output else None)

            return AudioGenResult(
                status=AudioGenStatus.COMPLETED,
                audio_url=str(audio_url) if audio_url else None,
                model_id=request.model_id,
                duration_seconds=request.duration_seconds,
                metadata={"prompt": request.prompt},
            )
        except Exception as exc:
            logger.error("audio generation failed: %s", exc)
            return AudioGenResult(
                status=AudioGenStatus.FAILED,
                error=str(exc),
                model_id=request.model_id,
            )

    async def check_status(self, prediction_id: str) -> AudioGenResult:
        """Check status of a previously submitted prediction."""
        try:
            client = self._get_client()
            prediction = await asyncio.to_thread(client.predictions.get, prediction_id)

            status_map: dict[str, AudioGenStatus] = {
                "starting": AudioGenStatus.PENDING,
                "processing": AudioGenStatus.PROCESSING,
                "succeeded": AudioGenStatus.COMPLETED,
                "failed": AudioGenStatus.FAILED,
                "canceled": AudioGenStatus.FAILED,
            }
            result_status = status_map.get(prediction.status, AudioGenStatus.PENDING)

            audio_url = None
            if prediction.output:
                audio_url = (
                    prediction.output
                    if isinstance(prediction.output, str)
                    else prediction.output[0]
                )

            return AudioGenResult(
                status=result_status,
                audio_url=str(audio_url) if audio_url else None,
                error=prediction.error if prediction.status == "failed" else None,
                model_id=getattr(prediction, "model", "") or "",
            )
        except Exception as exc:
            return AudioGenResult(status=AudioGenStatus.FAILED, error=str(exc))


# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------


def build_song_prompt(
    song_title: str,
    genre_tags: list[str] | None = None,
    mood_tags: list[str] | None = None,
    instrumentation: list[str] | None = None,
    tempo: int | None = None,
    key: str | None = None,
    concept_summary: str | None = None,
) -> str:
    """Build a text prompt for audio generation from song metadata.

    Each non-empty attribute is turned into a human-readable clause and joined
    with ``". "`` to form a coherent prompt string suitable for models like
    MusicGen or Stable Audio.
    """
    parts: list[str] = []
    if genre_tags:
        parts.append(", ".join(genre_tags))
    if mood_tags:
        parts.append(f"mood: {', '.join(mood_tags)}")
    if instrumentation:
        parts.append(f"instruments: {', '.join(instrumentation)}")
    if tempo:
        parts.append(f"{tempo} BPM")
    if key:
        parts.append(f"key of {key}")
    if concept_summary:
        parts.append(concept_summary[:200])
    if not parts:
        parts.append(f"instrumental track titled {song_title}")
    return ". ".join(parts)
