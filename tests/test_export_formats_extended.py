"""Tests for AlbumExporter and ExportFormat (formats.py)."""

import sys
from pathlib import Path

import pytest

from album_conceptualizer.export.formats import AlbumExporter, ExportFormat, ExportResult
from album_conceptualizer.models.album import Album, Section, SectionType, Song
from album_conceptualizer.models.music_theory import Chord, ChordProgression, ChordQuality


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_song(title="Test Song", track_number=1, **kwargs) -> Song:
    song = Song(title=title, track_number=track_number, key="G major", tempo=120, **kwargs)
    song.sections = [
        Section(section_type=SectionType.VERSE, order=1, lyrics="Hello world")
    ]
    return song


def _make_album(song_count=1) -> Album:
    songs = [_make_song(title=f"Song {i+1}", track_number=i + 1) for i in range(song_count)]
    return Album(title="Test Album", artist="Test Artist", songs=songs)


def _make_progression() -> ChordProgression:
    return ChordProgression(
        name="My Progression",
        chords=[
            Chord(root="C", quality=ChordQuality.MAJOR),
            Chord(root="G", quality=ChordQuality.MAJOR),
            Chord(root="A", quality=ChordQuality.MINOR),
            Chord(root="F", quality=ChordQuality.MAJOR),
        ],
    )


# ---------------------------------------------------------------------------
# AlbumExporter.export_song
# ---------------------------------------------------------------------------


class TestExportSong:
    def test_json_export_creates_file(self, tmp_path):
        exporter = AlbumExporter(output_dir=tmp_path)
        results = exporter.export_song(_make_song(), [ExportFormat.JSON])
        assert results["json"][0].success is True
        assert results["json"][0].path.exists()

    def test_json_file_contains_song_data(self, tmp_path):
        exporter = AlbumExporter(output_dir=tmp_path)
        song = _make_song(title="Special Song")
        results = exporter.export_song(song, [ExportFormat.JSON])
        content = results["json"][0].path.read_text()
        assert "Special Song" in content

    def test_text_export_creates_file(self, tmp_path):
        exporter = AlbumExporter(output_dir=tmp_path)
        results = exporter.export_song(_make_song(), [ExportFormat.TEXT])
        assert results["text"][0].success is True
        assert results["text"][0].path.exists()

    def test_text_file_contains_lyrics(self, tmp_path):
        exporter = AlbumExporter(output_dir=tmp_path)
        results = exporter.export_song(_make_song(), [ExportFormat.TEXT])
        content = results["text"][0].path.read_text()
        assert "Hello world" in content

    def test_chordpro_export_creates_file(self, tmp_path):
        exporter = AlbumExporter(output_dir=tmp_path)
        results = exporter.export_song(_make_song(), [ExportFormat.CHORDPRO])
        assert results["chordpro"][0].success is True
        assert results["chordpro"][0].path.exists()

    def test_chordpro_export_with_album_title(self, tmp_path):
        exporter = AlbumExporter(output_dir=tmp_path, artist_name="My Artist")
        results = exporter.export_song(_make_song(), [ExportFormat.CHORDPRO], album_title="My Album")
        assert results["chordpro"][0].success is True

    def test_midi_unavailable_produces_failure_result(self, tmp_path):
        """When pretty_midi is not installed, MIDI export should produce a failure result."""
        original = sys.modules.get("pretty_midi")
        sys.modules["pretty_midi"] = None  # type: ignore[assignment]
        try:
            exporter = AlbumExporter(output_dir=tmp_path)
            results = exporter.export_song(_make_song(), [ExportFormat.MIDI])
            assert "midi" in results
            assert results["midi"][0].success is False
            assert "MIDI export" in results["midi"][0].message or len(results["midi"]) >= 1
        finally:
            if original is not None:
                sys.modules["pretty_midi"] = original
            else:
                sys.modules.pop("pretty_midi", None)

    def test_export_multiple_formats(self, tmp_path):
        exporter = AlbumExporter(output_dir=tmp_path)
        results = exporter.export_song(
            _make_song(), [ExportFormat.JSON, ExportFormat.TEXT, ExportFormat.CHORDPRO]
        )
        assert results["json"][0].success is True
        assert results["text"][0].success is True
        assert results["chordpro"][0].success is True

    def test_custom_output_dir(self, tmp_path):
        exporter = AlbumExporter(output_dir=tmp_path / "base")
        custom_dir = tmp_path / "custom_dir"
        results = exporter.export_song(_make_song(), [ExportFormat.JSON], output_dir=custom_dir)
        assert results["json"][0].success is True
        # Output should be in the custom directory
        assert str(custom_dir) in str(results["json"][0].path)


# ---------------------------------------------------------------------------
# AlbumExporter.export_album
# ---------------------------------------------------------------------------


class TestExportAlbum:
    def test_json_export_includes_album_level_file(self, tmp_path):
        exporter = AlbumExporter(output_dir=tmp_path)
        album = _make_album(song_count=2)
        results = exporter.export_album(album, [ExportFormat.JSON])
        # 2 song JSON files + 1 album.json
        assert len(results["json"]) == 3

    def test_text_export_includes_tracklist(self, tmp_path):
        exporter = AlbumExporter(output_dir=tmp_path)
        album = _make_album(song_count=1)
        results = exporter.export_album(album, [ExportFormat.TEXT])
        # 1 song lyrics + 1 tracklist.txt
        assert len(results["text"]) == 2

    def test_chordpro_export_creates_per_song_file(self, tmp_path):
        exporter = AlbumExporter(output_dir=tmp_path)
        album = _make_album(song_count=2)
        results = exporter.export_album(album, [ExportFormat.CHORDPRO])
        assert len(results["chordpro"]) == 2
        assert all(r.success for r in results["chordpro"])

    def test_multi_format_album_export(self, tmp_path):
        exporter = AlbumExporter(output_dir=tmp_path)
        album = _make_album(song_count=1)
        results = exporter.export_album(album, [ExportFormat.JSON, ExportFormat.TEXT])
        assert len(results["json"]) >= 2  # song + album
        assert len(results["text"]) >= 2  # song + tracklist

    def test_empty_album_no_songs_exported(self, tmp_path):
        exporter = AlbumExporter(output_dir=tmp_path)
        album = Album(title="Empty Album")
        results = exporter.export_album(album, [ExportFormat.JSON])
        # Only album.json, no song JSON files
        assert len(results["json"]) == 1


# ---------------------------------------------------------------------------
# AlbumExporter.export_progression
# ---------------------------------------------------------------------------


class TestExportProgression:
    def test_json_export_creates_file(self, tmp_path):
        exporter = AlbumExporter(output_dir=tmp_path)
        progression = _make_progression()
        results = exporter.export_progression(
            progression, "my_prog", [ExportFormat.JSON], output_dir=tmp_path
        )
        assert "json" in results
        assert results["json"].success is True
        assert results["json"].path.exists()

    def test_json_file_contains_chord_data(self, tmp_path):
        exporter = AlbumExporter(output_dir=tmp_path)
        progression = _make_progression()
        results = exporter.export_progression(
            progression, "prog", [ExportFormat.JSON], output_dir=tmp_path
        )
        content = results["json"].path.read_text()
        assert "chords" in content

    def test_default_output_dir_used_when_not_specified(self, tmp_path):
        exporter = AlbumExporter(output_dir=tmp_path / "exports")
        progression = _make_progression()
        results = exporter.export_progression(progression, "test", [ExportFormat.JSON])
        assert results["json"].success is True

    def test_midi_unavailable_produces_failure_result(self, tmp_path):
        """Simulate MIDI unavailable by setting midi_exporter=None."""
        exporter = AlbumExporter(output_dir=tmp_path)
        exporter.midi_exporter = None  # simulate pretty_midi not installed
        progression = _make_progression()
        results = exporter.export_progression(
            progression, "test", [ExportFormat.MIDI], output_dir=tmp_path
        )
        assert "midi" in results
        assert results["midi"].success is False


# ---------------------------------------------------------------------------
# AlbumExporter._sanitize_filename
# ---------------------------------------------------------------------------


class TestSanitizeFilename:
    def test_removes_angle_brackets(self):
        result = AlbumExporter._sanitize_filename("My <Song>")
        assert "<" not in result
        assert ">" not in result

    def test_removes_colon(self):
        result = AlbumExporter._sanitize_filename("Song: Subtitle")
        assert ":" not in result

    def test_removes_double_quotes(self):
        result = AlbumExporter._sanitize_filename('Song "Title"')
        assert '"' not in result

    def test_removes_slashes(self):
        result = AlbumExporter._sanitize_filename("path/to/song")
        assert "/" not in result

    def test_removes_backslash(self):
        result = AlbumExporter._sanitize_filename("path\\song")
        assert "\\" not in result

    def test_removes_pipe(self):
        result = AlbumExporter._sanitize_filename("song|track")
        assert "|" not in result

    def test_removes_question_mark(self):
        result = AlbumExporter._sanitize_filename("what?")
        assert "?" not in result

    def test_removes_asterisk(self):
        result = AlbumExporter._sanitize_filename("star*wars")
        assert "*" not in result

    def test_limits_length_to_100(self):
        long_name = "a" * 150
        result = AlbumExporter._sanitize_filename(long_name)
        assert len(result) <= 100

    def test_strips_leading_trailing_dots(self):
        result = AlbumExporter._sanitize_filename("...name...")
        assert not result.startswith(".")
        assert not result.endswith(".")

    def test_strips_surrounding_whitespace(self):
        result = AlbumExporter._sanitize_filename("  song  ")
        assert result == "song"

    def test_normal_name_unchanged(self):
        result = AlbumExporter._sanitize_filename("My Song Title")
        assert result == "My Song Title"

    def test_empty_string(self):
        result = AlbumExporter._sanitize_filename("")
        assert result == ""
