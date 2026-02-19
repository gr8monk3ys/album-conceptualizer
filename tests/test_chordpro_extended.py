"""Extended tests for ChordPro export — covers uncovered paths in chordpro.py."""

import tempfile
from pathlib import Path

import pytest

from album_conceptualizer.export.chordpro import (
    ChordProExporter,
    format_chordpro,
    inline_chords_to_lyrics,
    parse_chordpro,
)
from album_conceptualizer.models.album import Section, SectionType, Song


# ---------------------------------------------------------------------------
# format_chordpro — capo parameter (line 47)
# ---------------------------------------------------------------------------


class TestFormatChordProCapo:
    def test_capo_included_in_output(self):
        """Covers line 47: capo directive added when capo is set."""
        result = format_chordpro(
            title="My Song",
            lyrics="Some lyrics here",
            capo=3,
        )
        assert "{capo: 3}" in result

    def test_capo_not_included_when_none(self):
        result = format_chordpro(title="No Capo", lyrics="Lyrics")
        assert "capo" not in result


# ---------------------------------------------------------------------------
# inline_chords_to_lyrics — full function body (lines 69-80)
# ---------------------------------------------------------------------------


class TestInlineChordsToLyrics:
    def test_inserts_chords_at_positions(self):
        """Covers lines 73-80: the actual chord insertion logic."""
        result = inline_chords_to_lyrics(
            lyrics="Hello world",
            chords=["G", "D"],
            positions=[0, 6],
        )
        assert "[G]" in result
        assert "[D]" in result

    def test_empty_chords_returns_lyrics_unchanged(self):
        """Covers line 69-70: early return when chords empty."""
        result = inline_chords_to_lyrics("Hello world", [], [0, 6])
        assert result == "Hello world"

    def test_empty_positions_returns_lyrics_unchanged(self):
        """Covers line 69-70: early return when positions empty."""
        result = inline_chords_to_lyrics("Hello world", ["G", "D"], [])
        assert result == "Hello world"

    def test_position_beyond_lyrics_clamped(self):
        """pos = min(pos, len(result)) prevents IndexError."""
        result = inline_chords_to_lyrics("Hi", ["C"], [100])
        assert "[C]" in result

    def test_single_chord_at_start(self):
        result = inline_chords_to_lyrics("Love", ["Am"], [0])
        assert result.startswith("[Am]Love")


# ---------------------------------------------------------------------------
# ChordProExporter.export_song — song.time_signature, chord-only section
# ---------------------------------------------------------------------------


class TestChordProExporterExportSong:
    def test_export_song_with_time_signature(self, tmp_path):
        """Covers line 130->133 (time_signature truthy path when no time_sig)
        and also the time_signature set path."""
        song = Song(title="Metered Song", track_number=1, time_signature="6/8")
        song.sections = [
            Section(section_type=SectionType.VERSE, order=1, lyrics="La la la")
        ]
        exporter = ChordProExporter()
        path = exporter.export_song(song, tmp_path / "metered.cho")
        content = path.read_text()
        assert "{time: 6/8}" in content

    def test_export_song_chord_only_section(self, tmp_path):
        """Covers lines 170-171: section with chord_progression but no lyrics."""
        song = Song(title="Instrumental", track_number=1)
        song.sections = [
            Section(
                section_type=SectionType.INTRO,
                order=1,
                lyrics="",
                chord_progression=["Am", "F", "C", "G"],
            )
        ]
        exporter = ChordProExporter()
        path = exporter.export_song(song, tmp_path / "instrumental.cho")
        content = path.read_text()
        assert "[Am]" in content

    def test_export_song_section_with_no_lyrics_no_chords(self, tmp_path):
        """Covers lines 172->194: elif section.lyrics is False (empty section)."""
        song = Song(title="Empty Section Song", track_number=1)
        song.sections = [
            Section(section_type=SectionType.BRIDGE, order=1, lyrics="", chord_progression=[])
        ]
        exporter = ChordProExporter()
        path = exporter.export_song(song, tmp_path / "empty.cho")
        assert path.exists()

    def test_export_song_lyrics_with_empty_lines(self, tmp_path):
        """Covers line 190: empty lyric lines go to else branch."""
        song = Song(title="Multi Line", track_number=1)
        song.sections = [
            Section(
                section_type=SectionType.VERSE,
                order=1,
                lyrics="First line\n\nThird line",
                chord_progression=["G", "D"],
            )
        ]
        exporter = ChordProExporter()
        path = exporter.export_song(song, tmp_path / "multiline.cho")
        content = path.read_text()
        assert "First line" in content

    def test_export_song_with_artist(self, tmp_path):
        """Covers line 122-123: self.default_artist is set."""
        song = Song(title="Artist Song", track_number=1)
        song.sections = [Section(section_type=SectionType.VERSE, order=1, lyrics="words")]
        exporter = ChordProExporter(default_artist="Test Artist")
        path = exporter.export_song(song, tmp_path / "artist.cho")
        assert "{artist: Test Artist}" in path.read_text()

    def test_export_song_with_album_title(self, tmp_path):
        """Covers line 124-125: album_title is provided."""
        song = Song(title="Album Song", track_number=1)
        song.sections = [Section(section_type=SectionType.VERSE, order=1, lyrics="words")]
        exporter = ChordProExporter()
        path = exporter.export_song(song, tmp_path / "album.cho", album_title="Great Album")
        assert "{album: Great Album}" in path.read_text()


# ---------------------------------------------------------------------------
# ChordProExporter.export_section (lines 213-225)
# ---------------------------------------------------------------------------


class TestChordProExporterExportSection:
    def test_export_section_creates_file(self, tmp_path):
        """Covers lines 213-225: export_section method."""
        section = Section(
            section_type=SectionType.CHORUS,
            order=2,
            lyrics="We are one",
            chord_progression=["G", "D"],
        )
        exporter = ChordProExporter()
        path = exporter.export_section(section, "Test Song", tmp_path / "chorus.cho")
        content = path.read_text()
        assert "Test Song" in content
        assert "We are one" in content

    def test_export_section_includes_section_type(self, tmp_path):
        section = Section(section_type=SectionType.VERSE, order=1, lyrics="Some text")
        exporter = ChordProExporter()
        path = exporter.export_section(section, "My Song", tmp_path / "verse.cho")
        content = path.read_text()
        assert "{comment:" in content


# ---------------------------------------------------------------------------
# ChordProExporter.format_simple — chord-only, empty, parse_chordpro coverage
# ---------------------------------------------------------------------------


class TestFormatSimpleExtended:
    def _make_exporter(self) -> ChordProExporter:
        return ChordProExporter()

    def test_chord_only_section(self):
        """Covers line 257: chord-only (no lyrics) section output."""
        exporter = self._make_exporter()
        result = exporter.format_simple(
            title="Instrumental",
            sections=[("Intro", "", ["G", "C", "D", "G"])],
        )
        assert "[G]" in result
        assert "{comment: Intro}" in result

    def test_section_with_no_lyrics_no_chords(self):
        """Covers 258->267: elif lyrics is False and chords is empty → no output."""
        exporter = self._make_exporter()
        result = exporter.format_simple(
            title="Empty",
            sections=[("Bridge", "", [])],
        )
        assert "{comment: Bridge}" in result

    def test_lyrics_with_empty_line(self):
        """Covers line 266: lines.append(line) when line is empty/blank in format_simple."""
        exporter = self._make_exporter()
        result = exporter.format_simple(
            title="Gapped Lyrics",
            sections=[("Verse", "First line\n\nThird line", ["Am"])],
        )
        assert "First line" in result
        assert "Third line" in result

    def test_format_simple_with_key_and_tempo(self):
        exporter = self._make_exporter()
        result = exporter.format_simple(
            title="Complete Song",
            sections=[("Verse", "Some words", ["G"])],
            key="G major",
            tempo=120,
        )
        assert "{key: G major}" in result
        assert "{tempo: 120}" in result


# ---------------------------------------------------------------------------
# parse_chordpro — section parsing and tempo (lines 293-329)
# ---------------------------------------------------------------------------


class TestParseChordPro:
    def test_parse_title_and_key(self):
        content = "{title: Test Song}\n{key: G}\n\nSome lyrics"
        result = parse_chordpro(content)
        assert result["title"] == "Test Song"
        assert result["key"] == "G"

    def test_parse_tempo(self):
        """Covers lines 311-312: tempo parsed as int."""
        content = "{title: Beat}\n{tempo: 120}\nLyrics here"
        result = parse_chordpro(content)
        assert result["tempo"] == 120

    def test_parse_sections_with_content(self):
        """Covers lines 317, 326-329: section accumulated and appended."""
        content = (
            "{title: Song}\n"
            "{comment: Verse}\n"
            "First line here\n"
            "Second line\n"
            "\n"
            "{comment: Chorus}\n"
            "Chorus line\n"
        )
        result = parse_chordpro(content)
        sections = result["sections"]
        assert len(sections) >= 1

    def test_parse_artist(self):
        content = "{title: Song}\n{artist: Artist Name}\nLyrics"
        result = parse_chordpro(content)
        assert result["artist"] == "Artist Name"

    def test_parse_section_at_end(self):
        """Covers lines 326-329: last section appended after for loop."""
        content = "{title: Final}\n{comment: Outro}\nFinal line\n"
        result = parse_chordpro(content)
        sections = result["sections"]
        assert any(s["name"] == "Outro" for s in sections)

    def test_parse_non_lyrics_line(self):
        """Covers lines 321-322: non-directive non-empty lines added to current section."""
        content = "{title: Test}\n{comment: Verse}\nHello world"
        result = parse_chordpro(content)
        sections = result["sections"]
        assert len(sections) >= 1
        content_list = sections[0]["content"]
        assert isinstance(content_list, list)
        assert "Hello world" in content_list
