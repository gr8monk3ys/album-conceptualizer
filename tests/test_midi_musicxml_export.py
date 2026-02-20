"""Tests for MIDI and MusicXML export paths — covers uncovered formats.py and midi.py lines."""

from album_conceptualizer.export.formats import AlbumExporter, ExportFormat
from album_conceptualizer.export.midi import MidiExporter
from album_conceptualizer.models.album import Section, SectionType, Song
from album_conceptualizer.models.music_theory import Chord, ChordProgression, ChordQuality


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_song_with_chords(title="Chord Song", track_number=1) -> Song:
    """Make a song with a section that has chord progressions."""
    song = Song(title=title, track_number=track_number, key="G major", tempo=120)
    song.sections = [
        Section(
            section_type=SectionType.VERSE,
            order=1,
            lyrics="Hello world",
            chord_progression=["G", "C", "D", "G"],
        )
    ]
    return song


def _make_progression() -> ChordProgression:
    return ChordProgression(
        name="Test Prog",
        chords=[
            Chord(root="C", quality=ChordQuality.MAJOR),
            Chord(root="G", quality=ChordQuality.MAJOR),
            Chord(root="A", quality=ChordQuality.MINOR),
            Chord(root="F", quality=ChordQuality.MAJOR),
        ],
    )


# ---------------------------------------------------------------------------
# MidiExporter direct tests (covers midi.py lines 167-178, 199-212, 243-262)
# ---------------------------------------------------------------------------


class TestMidiExporterDirect:
    def test_export_progression_creates_midi_file(self, tmp_path):
        """Covers lines 167-178: MidiExporter.export_progression."""
        exporter = MidiExporter(default_tempo=120)
        progression = _make_progression()
        path = tmp_path / "prog.mid"
        result = exporter.export_progression(progression, path)
        assert result == path
        assert path.exists()
        assert path.stat().st_size > 0

    def test_export_section_with_chords(self, tmp_path):
        """Covers lines 199-212: MidiExporter.export_section with chord_progression."""
        exporter = MidiExporter(default_tempo=120)
        section = Section(
            section_type=SectionType.VERSE,
            order=1,
            lyrics="La la la",
            chord_progression=["Am", "F", "C", "G"],
        )
        path = tmp_path / "section.mid"
        result = exporter.export_section(section, path, tempo=110)
        assert result == path
        assert path.exists()

    def test_export_section_without_chords_returns_none(self, tmp_path):
        """Covers line 199: early return None when no chords."""
        exporter = MidiExporter()
        section = Section(
            section_type=SectionType.VERSE, order=1, lyrics="Words", chord_progression=[]
        )
        result = exporter.export_section(section, tmp_path / "empty.mid")
        assert result is None

    def test_export_song_with_chord_sections(self, tmp_path):
        """Covers lines 243-262: MidiExporter.export_song with sections having chords."""
        exporter = MidiExporter(default_tempo=120)
        song = _make_song_with_chords()
        results = exporter.export_song(song, tmp_path / "midi_out")
        # Should have at least section file and combined file
        assert len(results) >= 1
        # All result paths should exist
        for path in results.values():
            assert path.exists()

    def test_export_song_creates_combined_file(self, tmp_path):
        """Covers lines 252-262: combined MIDI file creation."""
        exporter = MidiExporter()
        song = _make_song_with_chords()
        results = exporter.export_song(song, tmp_path / "midi_out", create_combined=True)
        assert "combined" in results
        assert results["combined"].exists()

    def test_export_song_no_chords_returns_empty(self, tmp_path):
        """Song with no chord_progressions returns empty dict."""
        exporter = MidiExporter()
        song = Song(title="No Chords", track_number=1)
        song.sections = [Section(section_type=SectionType.VERSE, order=1, lyrics="Words")]
        results = exporter.export_song(song, tmp_path)
        assert results == {}


# ---------------------------------------------------------------------------
# AlbumExporter.export_song — MIDI success path (formats.py 180-190)
# ---------------------------------------------------------------------------


class TestAlbumExporterMidiSuccess:
    def test_export_song_midi_with_chords_succeeds(self, tmp_path):
        """Covers formats.py lines 180-190: MIDI export with successful midi_results."""
        exporter = AlbumExporter(output_dir=tmp_path)
        song = _make_song_with_chords()
        results = exporter.export_song(song, [ExportFormat.MIDI])
        assert "midi" in results
        assert len(results["midi"]) > 0
        # At least one result should be successful
        assert any(r.success for r in results["midi"])

    def test_export_song_midi_unavailable_covers_runtime_error(self, tmp_path):
        """Covers formats.py line 163: raise RuntimeError when midi_exporter is None."""
        exporter = AlbumExporter(output_dir=tmp_path)
        exporter.midi_exporter = None  # Simulate midi not available
        song = _make_song_with_chords()  # Song WITH chords so the midi path is attempted
        results = exporter.export_song(song, [ExportFormat.MIDI])
        assert "midi" in results
        assert results["midi"][0].success is False
        assert "MIDI export" in results["midi"][0].message


# ---------------------------------------------------------------------------
# AlbumExporter.export_song — MusicXML path (formats.py 229-249)
# ---------------------------------------------------------------------------


class TestAlbumExporterMusicXML:
    def test_export_song_musicxml_succeeds(self, tmp_path):
        """Covers formats.py lines 229-249: MusicXML export path in export_song."""
        exporter = AlbumExporter(output_dir=tmp_path)
        song = _make_song_with_chords()
        results = exporter.export_song(song, [ExportFormat.MUSICXML])
        assert "musicxml" in results
        assert len(results["musicxml"]) > 0

    def test_export_song_musicxml_unavailable_covers_failure(self, tmp_path):
        """Covers formats.py lines 230-233: RuntimeError when musicxml_exporter is None."""
        exporter = AlbumExporter(output_dir=tmp_path)
        exporter.musicxml_exporter = None  # Simulate music21 not available
        song = _make_song_with_chords()
        results = exporter.export_song(song, [ExportFormat.MUSICXML])
        assert "musicxml" in results
        assert results["musicxml"][0].success is False


# ---------------------------------------------------------------------------
# AlbumExporter.export_progression — MIDI success path (formats.py line 338)
# and MusicXML progression (formats.py lines 352-361)
# ---------------------------------------------------------------------------


class TestAlbumExporterProgressionMidiSuccess:
    def test_export_progression_midi_success_path(self, tmp_path):
        """Covers formats.py line 338: MIDI progression ExportResult with success=True."""
        exporter = AlbumExporter(output_dir=tmp_path)
        progression = _make_progression()
        results = exporter.export_progression(
            progression, "test_prog", [ExportFormat.MIDI], output_dir=tmp_path
        )
        assert "midi" in results
        assert results["midi"].success is True
        assert results["midi"].path.exists()

    def test_export_progression_musicxml_success_path(self, tmp_path):
        """Covers formats.py lines 352-361: MusicXML progression export."""
        exporter = AlbumExporter(output_dir=tmp_path)
        progression = _make_progression()
        results = exporter.export_progression(
            progression, "test_prog", [ExportFormat.MUSICXML], output_dir=tmp_path
        )
        assert "musicxml" in results
        assert results["musicxml"].success is True

    def test_export_progression_musicxml_failure_path(self, tmp_path):
        """Covers formats.py lines 360-366: MusicXML progression failure (exception caught)."""
        exporter = AlbumExporter(output_dir=tmp_path)
        exporter.musicxml_exporter = None  # Simulate unavailable
        progression = _make_progression()
        results = exporter.export_progression(
            progression, "test", [ExportFormat.MUSICXML], output_dir=tmp_path
        )
        assert "musicxml" in results
        assert results["musicxml"].success is False
