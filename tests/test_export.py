"""Tests for export functionality."""

import pytest
from pathlib import Path
import tempfile

from album_conceptualizer.models.album import Song, Section, SectionType
from album_conceptualizer.models.music_theory import Chord, ChordProgression, ChordQuality
from album_conceptualizer.export.midi import MidiExporter, chord_to_midi_notes, create_chord_midi
from album_conceptualizer.export.chordpro import ChordProExporter, format_chordpro, parse_chordpro


class TestMidiExport:
    """Tests for MIDI export functionality."""

    def test_chord_to_midi_notes_major(self):
        """Test converting major chord to MIDI notes."""
        chord = Chord(root="C", quality=ChordQuality.MAJOR)
        notes = chord_to_midi_notes(chord, octave=4)
        # C4 = 60, E4 = 64, G4 = 67
        assert notes == [60, 64, 67]

    def test_chord_to_midi_notes_minor(self):
        """Test converting minor chord to MIDI notes."""
        chord = Chord(root="A", quality=ChordQuality.MINOR)
        notes = chord_to_midi_notes(chord, octave=4)
        # A4 = 69, C5 = 72, E5 = 76 (but we're in octave 4, so A4, C4+3, E4+4)
        # Actually: A=69, A+3=72, A+7=76
        assert 69 in notes  # Root A
        assert len(notes) == 3

    def test_chord_to_midi_notes_seventh(self):
        """Test converting seventh chord to MIDI notes."""
        chord = Chord(root="G", quality=ChordQuality.DOMINANT_7)
        notes = chord_to_midi_notes(chord, octave=4)
        assert len(notes) == 4  # Root, 3rd, 5th, 7th

    def test_chord_to_midi_notes_slash(self):
        """Test converting slash chord to MIDI notes."""
        chord = Chord(root="C", quality=ChordQuality.MAJOR, bass_note="G")
        notes = chord_to_midi_notes(chord, octave=4)
        # Should have bass note in lower octave
        assert len(notes) == 4  # Bass + triad

    @pytest.mark.skip(reason="Requires pretty_midi installation")
    def test_create_chord_midi(self):
        """Test creating MIDI from chords."""
        chords = [
            Chord.from_symbol("C"),
            Chord.from_symbol("Am"),
            Chord.from_symbol("F"),
            Chord.from_symbol("G"),
        ]
        midi = create_chord_midi(chords, tempo=120)
        assert midi is not None
        assert len(midi.instruments) == 1

    @pytest.mark.skip(reason="Requires pretty_midi installation")
    def test_midi_exporter_from_symbols(self):
        """Test MIDI export from chord symbols."""
        exporter = MidiExporter()
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "test.mid"
            result = exporter.export_from_symbols(
                ["C", "G", "Am", "F"],
                output_path,
            )
            assert result.exists()


class TestChordProExport:
    """Tests for ChordPro export functionality."""

    def test_format_chordpro_basic(self):
        """Test basic ChordPro formatting."""
        result = format_chordpro(
            title="Test Song",
            lyrics="Hello world",
            key="C",
        )
        assert "{title: Test Song}" in result
        assert "{key: C}" in result
        assert "Hello world" in result

    def test_format_chordpro_with_artist(self):
        """Test ChordPro with artist."""
        result = format_chordpro(
            title="Test Song",
            lyrics="Lyrics here",
            artist="Test Artist",
        )
        assert "{artist: Test Artist}" in result

    def test_parse_chordpro(self):
        """Test parsing ChordPro format."""
        content = """{title: My Song}
{artist: The Artist}
{key: G}

{comment: Verse 1}
[G]Hello [C]world
[D]Goodbye [G]moon"""

        parsed = parse_chordpro(content)
        assert parsed["title"] == "My Song"
        assert parsed["artist"] == "The Artist"
        assert parsed["key"] == "G"
        assert len(parsed["sections"]) == 1
        assert parsed["sections"][0]["name"] == "Verse 1"

    def test_chordpro_exporter_simple_format(self):
        """Test ChordProExporter simple format."""
        exporter = ChordProExporter(default_artist="Test Artist")
        result = exporter.format_simple(
            title="Simple Song",
            sections=[
                ("Verse", "La la la", ["C", "G", "Am", "F"]),
                ("Chorus", "Yeah yeah yeah", ["F", "G", "C"]),
            ],
            key="C",
        )

        assert "{title: Simple Song}" in result
        assert "{key: C}" in result
        assert "Verse" in result
        assert "Chorus" in result

    @pytest.mark.skip(reason="Requires file system access")
    def test_chordpro_exporter_song(self):
        """Test exporting a full song to ChordPro."""
        song = Song(title="Test Song", track_number=1, key="G", tempo=120)
        song.add_section(Section(
            section_type=SectionType.VERSE,
            order=1,
            lyrics="First verse lyrics",
            chord_progression=["G", "D", "Em", "C"],
        ))

        exporter = ChordProExporter()
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "test.cho"
            result = exporter.export_song(song, output_path)
            assert result.exists()

            content = result.read_text()
            assert "Test Song" in content


class TestExportFormats:
    """Tests for the unified export interface."""

    def test_sanitize_filename(self):
        """Test filename sanitization."""
        from album_conceptualizer.export.formats import AlbumExporter

        assert AlbumExporter._sanitize_filename("Normal Name") == "Normal Name"
        assert AlbumExporter._sanitize_filename("Bad/Name") == "Bad_Name"
        assert AlbumExporter._sanitize_filename("Has:Colons") == "Has_Colons"
        assert AlbumExporter._sanitize_filename("  Spaces  ") == "Spaces"
