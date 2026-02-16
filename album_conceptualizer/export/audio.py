"""Audio rendering helpers.

These utilities are optional and rely on system binaries like `fluidsynth` and `ffmpeg`.
They are kept behind feature checks so the core API remains dependency-light.
"""

from __future__ import annotations

import asyncio
import logging
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

logger = logging.getLogger("album_conceptualizer.export.audio")


class AudioRenderError(RuntimeError):
    """Raised when server-side audio rendering fails."""


def _which(name: str) -> str | None:
    try:
        return shutil.which(name)
    except Exception:
        return None


def get_soundfont_path() -> Path | None:
    """Resolve the configured SoundFont path.

    Supported env vars (first wins):
    - AC_SOUNDFONT_PATH
    - SOUNDFONT_PATH
    """

    raw = os.environ.get("AC_SOUNDFONT_PATH") or os.environ.get("SOUNDFONT_PATH")
    if not raw:
        return None
    return Path(raw).expanduser().resolve()


def render_midi_to_mp3(
    midi_path: Path,
    mp3_path: Path,
    *,
    soundfont_path: Path,
    sample_rate: int = 44100,
) -> None:
    """Render a MIDI file into an MP3 using `fluidsynth` + `ffmpeg`.

    Args:
        midi_path: path to an input .mid file
        mp3_path: output .mp3 path
        soundfont_path: path to a .sf2 SoundFont (General MIDI recommended)
        sample_rate: output sample rate
    """

    logger.info(
        "starting MIDI-to-MP3 render",
        extra={"midi_path": str(midi_path), "mp3_path": str(mp3_path)},
    )

    fluidsynth = _which("fluidsynth")
    if not fluidsynth:
        logger.error("fluidsynth binary not found in PATH")
        raise AudioRenderError("fluidsynth not found in PATH.")

    ffmpeg = _which("ffmpeg")
    if not ffmpeg:
        logger.error("ffmpeg binary not found in PATH")
        raise AudioRenderError("ffmpeg not found in PATH.")

    if not soundfont_path.exists():
        logger.error("SoundFont not found at %s", soundfont_path)
        raise AudioRenderError(f"SoundFont not found: {soundfont_path}")

    midi_path = Path(midi_path)
    mp3_path = Path(mp3_path)

    with tempfile.TemporaryDirectory(prefix="ac_audio_") as tmpdir:
        wav_path = Path(tmpdir) / "render.wav"

        try:
            logger.debug("running fluidsynth: %s -> %s", midi_path, wav_path)
            subprocess.run(
                [
                    fluidsynth,
                    "-ni",
                    str(soundfont_path),
                    str(midi_path),
                    "-F",
                    str(wav_path),
                    "-r",
                    str(sample_rate),
                ],
                check=True,
                capture_output=True,
                text=True,
            )
        except subprocess.CalledProcessError as exc:
            stderr = (exc.stderr or "").strip()
            logger.error("fluidsynth failed: %s", stderr or "unknown error")
            raise AudioRenderError(f"fluidsynth failed: {stderr or 'unknown error'}") from exc

        try:
            logger.debug("running ffmpeg: %s -> %s", wav_path, mp3_path)
            subprocess.run(
                [
                    ffmpeg,
                    "-y",
                    "-i",
                    str(wav_path),
                    "-codec:a",
                    "libmp3lame",
                    "-qscale:a",
                    "4",
                    str(mp3_path),
                ],
                check=True,
                capture_output=True,
                text=True,
            )
        except subprocess.CalledProcessError as exc:
            stderr = (exc.stderr or "").strip()
            logger.error("ffmpeg failed: %s", stderr or "unknown error")
            raise AudioRenderError(f"ffmpeg failed: {stderr or 'unknown error'}") from exc

    logger.info("MIDI-to-MP3 render complete: %s", mp3_path)


async def render_midi_to_mp3_async(
    midi_path: Path,
    mp3_path: Path,
    *,
    soundfont_path: Path,
    sample_rate: int = 44100,
) -> None:
    """Async version of :func:`render_midi_to_mp3` using ``asyncio.create_subprocess_exec``."""

    logger.info(
        "starting async MIDI-to-MP3 render",
        extra={"midi_path": str(midi_path), "mp3_path": str(mp3_path)},
    )

    fluidsynth = _which("fluidsynth")
    if not fluidsynth:
        logger.error("fluidsynth binary not found in PATH")
        raise AudioRenderError("fluidsynth not found in PATH.")

    ffmpeg = _which("ffmpeg")
    if not ffmpeg:
        logger.error("ffmpeg binary not found in PATH")
        raise AudioRenderError("ffmpeg not found in PATH.")

    if not soundfont_path.exists():
        logger.error("SoundFont not found at %s", soundfont_path)
        raise AudioRenderError(f"SoundFont not found: {soundfont_path}")

    midi_path = Path(midi_path)
    mp3_path = Path(mp3_path)

    with tempfile.TemporaryDirectory(prefix="ac_audio_") as tmpdir:
        wav_path = Path(tmpdir) / "render.wav"

        logger.debug("running fluidsynth (async): %s -> %s", midi_path, wav_path)
        proc = await asyncio.create_subprocess_exec(
            fluidsynth,
            "-ni",
            str(soundfont_path),
            str(midi_path),
            "-F",
            str(wav_path),
            "-r",
            str(sample_rate),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr_bytes = await proc.communicate()
        if proc.returncode != 0:
            stderr = (stderr_bytes or b"").decode(errors="replace").strip()
            logger.error("fluidsynth failed (async): %s", stderr or "unknown error")
            raise AudioRenderError(f"fluidsynth failed: {stderr or 'unknown error'}")

        logger.debug("running ffmpeg (async): %s -> %s", wav_path, mp3_path)
        proc = await asyncio.create_subprocess_exec(
            ffmpeg,
            "-y",
            "-i",
            str(wav_path),
            "-codec:a",
            "libmp3lame",
            "-qscale:a",
            "4",
            str(mp3_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr_bytes = await proc.communicate()
        if proc.returncode != 0:
            stderr = (stderr_bytes or b"").decode(errors="replace").strip()
            logger.error("ffmpeg failed (async): %s", stderr or "unknown error")
            raise AudioRenderError(f"ffmpeg failed: {stderr or 'unknown error'}")

    logger.info("async MIDI-to-MP3 render complete: %s", mp3_path)

