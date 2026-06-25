"""Unit tests for export/audio.py audio-rendering helpers.

These cover the pure logic of SoundFont resolution and the binary/feature
gating in ``render_midi_to_mp3`` without requiring ``fluidsynth`` or ``ffmpeg``
to be installed (subprocess and ``shutil.which`` are monkeypatched).
"""

import subprocess
from pathlib import Path

import pytest

from album_conceptualizer.export.audio import (
    AudioRenderError,
    get_soundfont_path,
    render_midi_to_mp3,
)


class TestGetSoundfontPath:
    def test_returns_none_when_unset(self, monkeypatch):
        monkeypatch.delenv("AC_SOUNDFONT_PATH", raising=False)
        monkeypatch.delenv("SOUNDFONT_PATH", raising=False)
        assert get_soundfont_path() is None

    def test_prefers_ac_soundfont_path(self, monkeypatch, tmp_path):
        preferred = tmp_path / "preferred.sf2"
        fallback = tmp_path / "fallback.sf2"
        monkeypatch.setenv("AC_SOUNDFONT_PATH", str(preferred))
        monkeypatch.setenv("SOUNDFONT_PATH", str(fallback))
        assert get_soundfont_path() == preferred.resolve()

    def test_falls_back_to_soundfont_path(self, monkeypatch, tmp_path):
        fallback = tmp_path / "fallback.sf2"
        monkeypatch.delenv("AC_SOUNDFONT_PATH", raising=False)
        monkeypatch.setenv("SOUNDFONT_PATH", str(fallback))
        assert get_soundfont_path() == fallback.resolve()

    def test_expands_user_home(self, monkeypatch):
        monkeypatch.delenv("SOUNDFONT_PATH", raising=False)
        monkeypatch.setenv("AC_SOUNDFONT_PATH", "~/sf2/default.sf2")
        result = get_soundfont_path()
        assert result is not None
        assert "~" not in str(result)
        assert result.is_absolute()


class TestRenderMidiToMp3:
    def test_raises_when_fluidsynth_missing(self, monkeypatch, tmp_path):
        monkeypatch.setattr(
            "album_conceptualizer.export.audio.shutil.which",
            lambda name: None,
        )
        with pytest.raises(AudioRenderError, match="fluidsynth not found"):
            render_midi_to_mp3(
                tmp_path / "in.mid",
                tmp_path / "out.mp3",
                soundfont_path=tmp_path / "font.sf2",
            )

    def test_raises_when_ffmpeg_missing(self, monkeypatch, tmp_path):
        monkeypatch.setattr(
            "album_conceptualizer.export.audio.shutil.which",
            lambda name: "/usr/bin/fluidsynth" if name == "fluidsynth" else None,
        )
        with pytest.raises(AudioRenderError, match="ffmpeg not found"):
            render_midi_to_mp3(
                tmp_path / "in.mid",
                tmp_path / "out.mp3",
                soundfont_path=tmp_path / "font.sf2",
            )

    def test_raises_when_soundfont_missing(self, monkeypatch, tmp_path):
        monkeypatch.setattr(
            "album_conceptualizer.export.audio.shutil.which",
            lambda name: f"/usr/bin/{name}",
        )
        with pytest.raises(AudioRenderError, match="SoundFont not found"):
            render_midi_to_mp3(
                tmp_path / "in.mid",
                tmp_path / "out.mp3",
                soundfont_path=tmp_path / "missing.sf2",
            )

    def test_wraps_fluidsynth_failure(self, monkeypatch, tmp_path):
        soundfont = tmp_path / "font.sf2"
        soundfont.write_bytes(b"sf2")
        monkeypatch.setattr(
            "album_conceptualizer.export.audio.shutil.which",
            lambda name: f"/usr/bin/{name}",
        )

        def fake_run(cmd, *args, **kwargs):
            raise subprocess.CalledProcessError(returncode=1, cmd=cmd, stderr="bad soundfont")

        monkeypatch.setattr("album_conceptualizer.export.audio.subprocess.run", fake_run)
        with pytest.raises(AudioRenderError, match="fluidsynth failed: bad soundfont"):
            render_midi_to_mp3(
                tmp_path / "in.mid",
                tmp_path / "out.mp3",
                soundfont_path=soundfont,
            )

    def test_wraps_ffmpeg_failure(self, monkeypatch, tmp_path):
        soundfont = tmp_path / "font.sf2"
        soundfont.write_bytes(b"sf2")
        monkeypatch.setattr(
            "album_conceptualizer.export.audio.shutil.which",
            lambda name: f"/usr/bin/{name}",
        )

        calls = {"n": 0}

        def fake_run(cmd, *args, **kwargs):
            calls["n"] += 1
            # First call (fluidsynth) succeeds; second (ffmpeg) fails.
            if calls["n"] == 1:
                return subprocess.CompletedProcess(cmd, 0, "", "")
            raise subprocess.CalledProcessError(returncode=1, cmd=cmd, stderr="encode error")

        monkeypatch.setattr("album_conceptualizer.export.audio.subprocess.run", fake_run)
        with pytest.raises(AudioRenderError, match="ffmpeg failed: encode error"):
            render_midi_to_mp3(
                tmp_path / "in.mid",
                tmp_path / "out.mp3",
                soundfont_path=soundfont,
            )

    def test_success_invokes_both_binaries(self, monkeypatch, tmp_path):
        soundfont = tmp_path / "font.sf2"
        soundfont.write_bytes(b"sf2")
        midi_path = tmp_path / "in.mid"
        mp3_path = tmp_path / "out.mp3"
        monkeypatch.setattr(
            "album_conceptualizer.export.audio.shutil.which",
            lambda name: f"/usr/bin/{name}",
        )

        invoked: list[str] = []

        def fake_run(cmd, *args, **kwargs):
            assert kwargs.get("check") is True
            invoked.append(Path(cmd[0]).name)
            return subprocess.CompletedProcess(cmd, 0, "", "")

        monkeypatch.setattr("album_conceptualizer.export.audio.subprocess.run", fake_run)

        # Should not raise.
        render_midi_to_mp3(
            midi_path,
            mp3_path,
            soundfont_path=soundfont,
            sample_rate=22050,
        )

        assert invoked == ["fluidsynth", "ffmpeg"]
