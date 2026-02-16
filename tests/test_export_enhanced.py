"""Tests for enhanced MIDI export (multi-instrument, dynamics) and export validation."""

from pathlib import Path

import pytest

pytest.importorskip("pretty_midi")

import pretty_midi

from album_conceptualizer.export.formats import (
    AlbumExporter,
    ExportFormat,
    ExportValidation,
)
from album_conceptualizer.export.midi import (
    INSTRUMENT_MAP,
    SECTION_DYNAMICS,
    MidiExporter,
    get_section_velocity,
    resolve_program,
)
from album_conceptualizer.models.album import Album, Section, SectionType, Song


# ---------------------------------------------------------------------------
# resolve_program
# ---------------------------------------------------------------------------


class TestResolveProgram:
    """Tests for the instrument-name -> MIDI program resolver."""

    def test_exact_match(self):
        assert resolve_program("piano") == 0
        assert resolve_program("electric guitar") == 27
        assert resolve_program("bass") == 33
        assert resolve_program("strings") == 48
        assert resolve_program("trumpet") == 56
        assert resolve_program("synth") == 80

    def test_case_insensitive(self):
        assert resolve_program("Piano") == 0
        assert resolve_program("ELECTRIC GUITAR") == 27
        assert resolve_program("  Bass  ") == 33

    def test_fuzzy_substring_match(self):
        """When no exact key matches, the first substring match wins."""
        # "piano" is the first key in the map that appears in these strings
        assert resolve_program("grand acoustic piano") == INSTRUMENT_MAP["piano"]
        # "guitar" appears before "electric guitar" in iteration order
        assert resolve_program("fingerpicked acoustic guitar") == INSTRUMENT_MAP["guitar"]
        # "synth" matches before "synth pad"
        assert resolve_program("warm synth pad atmosphere") == INSTRUMENT_MAP["synth"]
        # "bass" is a substring of "slap bass line"
        assert resolve_program("slap bass line") == INSTRUMENT_MAP["bass"]

    def test_unknown_defaults_to_piano(self):
        assert resolve_program("theremin") == 0
        assert resolve_program("didgeridoo") == 0
        assert resolve_program("") == 0

    def test_all_map_entries_resolve(self):
        """Every key in INSTRUMENT_MAP should resolve to its own value."""
        for name, expected in INSTRUMENT_MAP.items():
            assert resolve_program(name) == expected, f"Failed for {name!r}"


# ---------------------------------------------------------------------------
# get_section_velocity
# ---------------------------------------------------------------------------


class TestGetSectionVelocity:
    """Tests for section-based dynamics."""

    def test_known_section_types(self):
        for section_type, dynamics in SECTION_DYNAMICS.items():
            vel = get_section_velocity(section_type)
            assert vel == dynamics["velocity"]
            assert 1 <= vel <= 127

    def test_unknown_section_uses_base_velocity(self):
        vel = get_section_velocity("unknown_section", base_velocity=90)
        assert vel == 90

    def test_clamped_to_valid_range(self):
        """Velocity should never exceed 1-127."""
        vel = get_section_velocity("chorus")  # 105
        assert 1 <= vel <= 127

        vel = get_section_velocity("breakdown")  # 65
        assert 1 <= vel <= 127

    def test_chorus_louder_than_verse(self):
        chorus_vel = get_section_velocity("chorus")
        verse_vel = get_section_velocity("verse")
        assert chorus_vel > verse_vel

    def test_intro_softer_than_chorus(self):
        intro_vel = get_section_velocity("intro")
        chorus_vel = get_section_velocity("chorus")
        assert intro_vel < chorus_vel


# ---------------------------------------------------------------------------
# Multi-instrument export_song
# ---------------------------------------------------------------------------


def _make_song(
    instrumentation: list[str] | None = None,
    tempo: int = 120,
) -> Song:
    """Helper to create a song with two sections and chords."""
    sections = [
        Section(
            section_type=SectionType.VERSE,
            order=1,
            lyrics="Verse lyrics here",
            chord_progression=["C", "Am", "F", "G"],
        ),
        Section(
            section_type=SectionType.CHORUS,
            order=2,
            lyrics="Chorus lyrics here",
            chord_progression=["F", "G", "C", "Am"],
        ),
    ]
    return Song(
        title="Test Song",
        track_number=1,
        tempo=tempo,
        key="C major",
        sections=sections,
        instrumentation=instrumentation or [],
    )


class TestMultiInstrumentExport:
    """Tests for multi-instrument combined MIDI export."""

    def test_no_instrumentation_single_instrument(self, tmp_path: Path):
        """Without instrumentation metadata, export produces a single piano track."""
        song = _make_song(instrumentation=None)
        exporter = MidiExporter()
        results = exporter.export_song(song, tmp_path)

        assert "combined" in results
        midi = pretty_midi.PrettyMIDI(str(results["combined"]))
        assert len(midi.instruments) == 1
        assert midi.instruments[0].program == 0  # piano

    def test_single_instrument_in_metadata(self, tmp_path: Path):
        """A single non-bass instrument creates one track."""
        song = _make_song(instrumentation=["electric guitar"])
        exporter = MidiExporter()
        results = exporter.export_song(song, tmp_path)

        assert "combined" in results
        midi = pretty_midi.PrettyMIDI(str(results["combined"]))
        assert len(midi.instruments) == 1
        assert midi.instruments[0].program == resolve_program("electric guitar")

    def test_multiple_instruments_creates_multiple_tracks(self, tmp_path: Path):
        """Multiple instruments create one track each."""
        song = _make_song(instrumentation=["piano", "strings", "bass"])
        exporter = MidiExporter()
        results = exporter.export_song(song, tmp_path)

        assert "combined" in results
        midi = pretty_midi.PrettyMIDI(str(results["combined"]))
        # piano + strings + bass = 3 tracks
        assert len(midi.instruments) == 3

    def test_bass_track_plays_root_notes_only(self, tmp_path: Path):
        """Bass instrument track should have one note per chord (root only)."""
        song = _make_song(instrumentation=["piano", "bass guitar"])
        exporter = MidiExporter()
        results = exporter.export_song(song, tmp_path)

        midi = pretty_midi.PrettyMIDI(str(results["combined"]))
        bass_tracks = [i for i in midi.instruments if "bass" in i.name.lower()]
        assert len(bass_tracks) == 1

        bass_track = bass_tracks[0]
        # 4 chords in verse + 4 chords in chorus = 8 root notes
        total_chords = sum(
            len(s.chord_progression) for s in song.sections if s.chord_progression
        )
        assert len(bass_track.notes) == total_chords

    def test_bass_only_instrumentation_adds_default_piano(self, tmp_path: Path):
        """If only bass instruments are listed, a piano track is added for chords."""
        song = _make_song(instrumentation=["bass"])
        exporter = MidiExporter()
        results = exporter.export_song(song, tmp_path)

        midi = pretty_midi.PrettyMIDI(str(results["combined"]))
        # piano (default) + bass = 2
        assert len(midi.instruments) == 2
        programs = {i.program for i in midi.instruments}
        assert 0 in programs  # piano default
        assert resolve_program("bass") in programs

    def test_dynamics_vary_by_section(self, tmp_path: Path):
        """Verify that chorus notes are louder than verse notes."""
        song = _make_song(instrumentation=["piano"])
        exporter = MidiExporter()
        results = exporter.export_song(song, tmp_path)

        midi = pretty_midi.PrettyMIDI(str(results["combined"]))
        piano = midi.instruments[0]

        # The song has 4 chords per section.  Each chord is a triad (3 notes).
        # Verse notes come first (indices 0..11), chorus next (12..23).
        verse_velocity = get_section_velocity("verse")
        chorus_velocity = get_section_velocity("chorus")

        verse_notes = piano.notes[:12]  # 4 chords * 3 notes each
        chorus_notes = piano.notes[12:]

        assert all(n.velocity == verse_velocity for n in verse_notes)
        assert all(n.velocity == chorus_velocity for n in chorus_notes)
        assert chorus_velocity > verse_velocity

    def test_per_section_files_still_created(self, tmp_path: Path):
        """Individual per-section MIDI files are still created alongside combined."""
        song = _make_song(instrumentation=["piano", "bass"])
        exporter = MidiExporter()
        results = exporter.export_song(song, tmp_path)

        assert "verse_1" in results
        assert "chorus_2" in results
        assert "combined" in results
        for path in results.values():
            assert path.exists()

    def test_empty_instrumentation_list_same_as_none(self, tmp_path: Path):
        """An empty instrumentation list behaves like no instrumentation."""
        song = _make_song(instrumentation=[])
        exporter = MidiExporter()
        results = exporter.export_song(song, tmp_path)

        midi = pretty_midi.PrettyMIDI(str(results["combined"]))
        assert len(midi.instruments) == 1
        assert midi.instruments[0].program == 0


# ---------------------------------------------------------------------------
# ExportValidation
# ---------------------------------------------------------------------------


class TestExportValidation:
    """Tests for AlbumExporter.validate_album_for_export()."""

    def _make_exporter(self, tmp_path: Path) -> AlbumExporter:
        return AlbumExporter(output_dir=tmp_path)

    def test_valid_album_is_ready(self, tmp_path: Path):
        song = Song(
            title="Good Song",
            track_number=1,
            sections=[
                Section(
                    section_type=SectionType.VERSE,
                    order=1,
                    lyrics="Some lyrics",
                    chord_progression=["C", "G"],
                )
            ],
        )
        album = Album(title="Good Album", songs=[song])
        exporter = self._make_exporter(tmp_path)

        result = exporter.validate_album_for_export(
            album,
            [ExportFormat.MIDI, ExportFormat.CHORDPRO, ExportFormat.TEXT],
        )

        assert result.is_ready is True
        assert len(result.errors) == 0
        assert len(result.warnings) == 0

    def test_no_songs_is_error(self, tmp_path: Path):
        album = Album(title="Empty Album", songs=[])
        exporter = self._make_exporter(tmp_path)

        result = exporter.validate_album_for_export(album, [ExportFormat.MIDI])

        assert result.is_ready is False
        assert any("no songs" in e.lower() for e in result.errors)

    def test_no_sections_warning(self, tmp_path: Path):
        song = Song(title="No Sections", track_number=1, sections=[])
        album = Album(title="Album", songs=[song])
        exporter = self._make_exporter(tmp_path)

        result = exporter.validate_album_for_export(album, [ExportFormat.MIDI])

        assert result.is_ready is True
        assert any("no sections" in w.lower() for w in result.warnings)

    def test_no_chords_warns_for_midi(self, tmp_path: Path):
        song = Song(
            title="Lyrics Only",
            track_number=1,
            sections=[
                Section(
                    section_type=SectionType.VERSE,
                    order=1,
                    lyrics="Just words",
                    chord_progression=[],
                )
            ],
        )
        album = Album(title="Album", songs=[song])
        exporter = self._make_exporter(tmp_path)

        result = exporter.validate_album_for_export(album, [ExportFormat.MIDI])

        assert result.is_ready is True
        assert any("midi will be empty" in w.lower() for w in result.warnings)

    def test_no_lyrics_warns_for_text(self, tmp_path: Path):
        song = Song(
            title="Chords Only",
            track_number=1,
            sections=[
                Section(
                    section_type=SectionType.VERSE,
                    order=1,
                    chord_progression=["C", "G"],
                )
            ],
        )
        album = Album(title="Album", songs=[song])
        exporter = self._make_exporter(tmp_path)

        result = exporter.validate_album_for_export(album, [ExportFormat.TEXT])

        assert result.is_ready is True
        assert any("no lyrics" in w.lower() for w in result.warnings)

    def test_no_lyrics_no_chords_warns_for_chordpro(self, tmp_path: Path):
        song = Song(
            title="Empty Song",
            track_number=1,
            sections=[
                Section(section_type=SectionType.VERSE, order=1),
            ],
        )
        album = Album(title="Album", songs=[song])
        exporter = self._make_exporter(tmp_path)

        result = exporter.validate_album_for_export(album, [ExportFormat.CHORDPRO])

        assert result.is_ready is True
        assert any("chordpro will be empty" in w.lower() for w in result.warnings)

    def test_json_format_no_special_warnings(self, tmp_path: Path):
        """JSON export should not trigger chord/lyrics warnings."""
        song = Song(
            title="Metadata Song",
            track_number=1,
            sections=[Section(section_type=SectionType.VERSE, order=1)],
        )
        album = Album(title="Album", songs=[song])
        exporter = self._make_exporter(tmp_path)

        result = exporter.validate_album_for_export(album, [ExportFormat.JSON])

        assert result.is_ready is True
        # Only possible warning is "no sections" which won't fire since we have one
        assert not any("midi" in w.lower() for w in result.warnings)
        assert not any("chordpro" in w.lower() for w in result.warnings)
        assert not any("lyrics" in w.lower() for w in result.warnings)

    def test_multiple_songs_accumulate_warnings(self, tmp_path: Path):
        songs = [
            Song(
                title=f"Song {i}",
                track_number=i,
                sections=[Section(section_type=SectionType.VERSE, order=1)],
            )
            for i in range(1, 4)
        ]
        album = Album(title="Album", songs=songs)
        exporter = self._make_exporter(tmp_path)

        result = exporter.validate_album_for_export(
            album, [ExportFormat.MIDI, ExportFormat.TEXT]
        )

        assert result.is_ready is True
        # 3 songs x 2 warnings each (no chords for MIDI + no lyrics for TEXT)
        assert len(result.warnings) == 6
