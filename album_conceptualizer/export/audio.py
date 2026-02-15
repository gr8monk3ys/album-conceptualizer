"""Audio rendering helpers.

These utilities are optional and rely on system binaries like `fluidsynth` and `ffmpeg`.
They are kept behind feature checks so the core API remains dependency-light.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path


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

    fluidsynth = _which("fluidsynth")
    if not fluidsynth:
        raise AudioRenderError("fluidsynth not found in PATH.")

    ffmpeg = _which("ffmpeg")
    if not ffmpeg:
        raise AudioRenderError("ffmpeg not found in PATH.")

    if not soundfont_path.exists():
        raise AudioRenderError(f"SoundFont not found: {soundfont_path}")

    midi_path = Path(midi_path)
    mp3_path = Path(mp3_path)

    with tempfile.TemporaryDirectory(prefix="ac_audio_") as tmpdir:
        wav_path = Path(tmpdir) / "render.wav"

        try:
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
            raise AudioRenderError(f"fluidsynth failed: {stderr or 'unknown error'}") from exc

        try:
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
            raise AudioRenderError(f"ffmpeg failed: {stderr or 'unknown error'}") from exc

