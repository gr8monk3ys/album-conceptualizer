"""MIDI export functionality."""

from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path

import pretty_midi

from album_conceptualizer.models.album import Section, Song
from album_conceptualizer.models.music_theory import Chord, ChordProgression, ChordQuality


# ---------------------------------------------------------------------------
# Instrument mapping: common instrument names -> General MIDI program numbers
# ---------------------------------------------------------------------------

INSTRUMENT_MAP: dict[str, int] = {
    # Piano family
    "piano": 0,
    "acoustic piano": 0,
    "grand piano": 0,
    "electric piano": 4,
    "keys": 0,
    "keyboard": 0,
    "rhodes": 4,
    "wurlitzer": 4,
    # Guitar
    "guitar": 25,
    "acoustic guitar": 25,
    "electric guitar": 27,
    "clean guitar": 27,
    "distorted guitar": 30,
    "overdriven guitar": 29,
    "bass guitar": 33,
    "bass": 33,
    "electric bass": 33,
    "synth bass": 38,
    # Strings
    "strings": 48,
    "violin": 40,
    "viola": 41,
    "cello": 42,
    "orchestra": 48,
    "orchestral": 48,
    # Brass
    "trumpet": 56,
    "trombone": 57,
    "brass": 61,
    "horn": 60,
    "french horn": 60,
    # Woodwinds
    "flute": 73,
    "clarinet": 71,
    "saxophone": 65,
    "sax": 65,
    "oboe": 68,
    # Synth
    "synth": 80,
    "synthesizer": 80,
    "pad": 89,
    "synth pad": 89,
    "lead synth": 80,
    "synth lead": 80,
    # Organ
    "organ": 19,
    "church organ": 19,
    "hammond": 16,
}


def resolve_program(instrument_name: str) -> int:
    """Resolve an instrument name to a MIDI program number.

    Performs an exact lookup first, then falls back to substring matching
    against the keys in :data:`INSTRUMENT_MAP`.  Returns ``0`` (Acoustic
    Grand Piano) when no match is found.
    """
    name = instrument_name.strip().lower()
    if name in INSTRUMENT_MAP:
        return INSTRUMENT_MAP[name]
    # Fuzzy match: check if any key is contained in the name
    for key, program in INSTRUMENT_MAP.items():
        if key in name:
            return program
    return 0  # Default to piano


# ---------------------------------------------------------------------------
# Section-based dynamics
# ---------------------------------------------------------------------------

SECTION_DYNAMICS: dict[str, dict[str, int]] = {
    "intro": {"velocity": 70, "modifier": -15},
    "verse": {"velocity": 85, "modifier": 0},
    "pre_chorus": {"velocity": 90, "modifier": 5},
    "chorus": {"velocity": 105, "modifier": 10},
    "post_chorus": {"velocity": 95, "modifier": 5},
    "bridge": {"velocity": 80, "modifier": -5},
    "breakdown": {"velocity": 65, "modifier": -20},
    "solo": {"velocity": 100, "modifier": 8},
    "interlude": {"velocity": 70, "modifier": -15},
    "outro": {"velocity": 75, "modifier": -10},
}


def get_section_velocity(section_type: str, base_velocity: int = 100) -> int:
    """Return a velocity value for *section_type*, clamped to 1-127."""
    dynamics = SECTION_DYNAMICS.get(
        section_type, {"velocity": base_velocity, "modifier": 0}
    )
    return max(1, min(127, dynamics["velocity"]))


# ---------------------------------------------------------------------------
# Core helpers
# ---------------------------------------------------------------------------

# Note name to MIDI number mapping (octave 4)
NOTE_TO_MIDI = {
    "C": 60,
    "C#": 61,
    "Db": 61,
    "D": 62,
    "D#": 63,
    "Eb": 63,
    "E": 64,
    "F": 65,
    "F#": 66,
    "Gb": 66,
    "G": 67,
    "G#": 68,
    "Ab": 68,
    "A": 69,
    "A#": 70,
    "Bb": 70,
    "B": 71,
}

# Chord quality to intervals mapping
CHORD_INTERVALS = {
    ChordQuality.MAJOR: [0, 4, 7],
    ChordQuality.MINOR: [0, 3, 7],
    ChordQuality.DIMINISHED: [0, 3, 6],
    ChordQuality.AUGMENTED: [0, 4, 8],
    ChordQuality.DOMINANT_7: [0, 4, 7, 10],
    ChordQuality.MAJOR_7: [0, 4, 7, 11],
    ChordQuality.MINOR_7: [0, 3, 7, 10],
    ChordQuality.HALF_DIMINISHED: [0, 3, 6, 10],
    ChordQuality.DIMINISHED_7: [0, 3, 6, 9],
    ChordQuality.SUS2: [0, 2, 7],
    ChordQuality.SUS4: [0, 5, 7],
    ChordQuality.ADD9: [0, 4, 7, 14],
    ChordQuality.POWER: [0, 7],
}


def note_to_midi(note: str, octave: int = 4) -> int:
    """Convert a note name to MIDI number."""
    base = NOTE_TO_MIDI.get(note, NOTE_TO_MIDI.get(note[0], 60))
    return base + (octave - 4) * 12


def chord_to_midi_notes(chord: Chord, octave: int = 4) -> list[int]:
    """Convert a Chord to MIDI note numbers."""
    root_midi = note_to_midi(chord.root, octave)
    intervals = CHORD_INTERVALS.get(chord.quality, [0, 4, 7])
    notes = [root_midi + interval for interval in intervals]

    # Handle bass note for slash chords
    if chord.bass_note:
        bass_midi = note_to_midi(chord.bass_note, octave - 1)
        notes = [bass_midi, *notes]

    return notes


def create_chord_midi(
    chords: Sequence[Chord | str],
    tempo: int = 120,
    chord_duration: float = 2.0,
    velocity: int = 100,
    instrument_program: int = 0,  # 0 = Acoustic Grand Piano
) -> pretty_midi.PrettyMIDI:
    """
    Create a MIDI file from a list of chords.

    Args:
        chords: List of Chord objects or chord symbol strings
        tempo: Tempo in BPM
        chord_duration: Duration of each chord in beats
        velocity: MIDI velocity (0-127)
        instrument_program: MIDI program number

    Returns:
        PrettyMIDI object
    """
    midi = pretty_midi.PrettyMIDI(initial_tempo=tempo)
    instrument = pretty_midi.Instrument(program=instrument_program)

    current_time = 0.0
    beat_duration = 60.0 / tempo
    chord_time = chord_duration * beat_duration

    for chord in chords:
        # Parse string chords
        if isinstance(chord, str):
            chord = Chord.from_symbol(chord)

        # Get MIDI notes
        notes = chord_to_midi_notes(chord)

        # Add notes to instrument
        for note_num in notes:
            note = pretty_midi.Note(
                velocity=velocity,
                pitch=note_num,
                start=current_time,
                end=current_time + chord_time,
            )
            instrument.notes.append(note)

        current_time += chord_time

    midi.instruments.append(instrument)
    return midi


class MidiExporter:
    """
    Export songs and chord progressions to MIDI format.

    MIDI is the universal interchange format for music software.
    Every DAW (Ableton, Logic, FL Studio, etc.) can import MIDI.
    """

    def __init__(
        self,
        default_tempo: int = 120,
        default_velocity: int = 100,
        default_instrument: int = 0,
    ):
        """
        Initialize the MIDI exporter.

        Args:
            default_tempo: Default tempo in BPM
            default_velocity: Default note velocity (0-127)
            default_instrument: Default MIDI program number
        """
        self.default_tempo = default_tempo
        self.default_velocity = default_velocity
        self.default_instrument = default_instrument

    def export_progression(
        self,
        progression: ChordProgression,
        output_path: Path,
        chord_duration: float = 2.0,
        tempo: int | None = None,
    ) -> Path:
        """
        Export a chord progression to MIDI.

        Args:
            progression: ChordProgression to export
            output_path: Output file path
            chord_duration: Duration of each chord in beats
            tempo: Tempo (uses default if not specified)

        Returns:
            Path to the created file
        """
        tempo = tempo or self.default_tempo
        midi = create_chord_midi(
            chords=progression.chords,
            tempo=tempo,
            chord_duration=chord_duration,
            velocity=self.default_velocity,
            instrument_program=self.default_instrument,
        )

        output_path = Path(output_path)
        midi.write(str(output_path))
        return output_path

    def export_section(
        self,
        section: Section,
        output_path: Path,
        tempo: int | None = None,
        chord_duration: float = 2.0,
    ) -> Path | None:
        """
        Export a song section's chord progression to MIDI.

        Args:
            section: Section to export
            output_path: Output file path
            tempo: Tempo (uses default if not specified)
            chord_duration: Duration per chord in beats

        Returns:
            Path to created file, or None if no chords
        """
        if not section.chord_progression:
            return None

        chords = [Chord.from_symbol(c) for c in section.chord_progression]
        midi = create_chord_midi(
            chords=chords,
            tempo=tempo or self.default_tempo,
            chord_duration=chord_duration,
            velocity=self.default_velocity,
        )

        output_path = Path(output_path)
        midi.write(str(output_path))
        return output_path

    def export_song(
        self,
        song: Song,
        output_dir: Path,
        create_combined: bool = True,
    ) -> dict[str, Path]:
        """
        Export all chord progressions from a song to MIDI.

        Creates individual files per section and optionally a combined file.

        When the song has :pyattr:`Song.instrumentation` metadata the combined
        MIDI file will contain one track per unique instrument (resolved via
        :func:`resolve_program`) with section-aware dynamics.  A dedicated bass
        track is added automatically when the instrumentation list includes a
        bass-family instrument.

        If no instrumentation is provided the behaviour is identical to the
        original single-piano export for full backward compatibility.

        Args:
            song: Song to export
            output_dir: Output directory
            create_combined: Whether to create a combined MIDI file

        Returns:
            Dictionary mapping section names to file paths
        """
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        tempo = song.tempo or self.default_tempo
        results: dict[str, Path] = {}

        all_chords: list[str] = []

        for section in song.sections:
            if section.chord_progression:
                section_name = f"{section.section_type}_{section.order}"
                file_path = output_dir / f"{song.title}_{section_name}.mid"

                self.export_section(section, file_path, tempo=tempo)
                results[section_name] = file_path

                all_chords.extend(section.chord_progression)

        # Create combined file
        if create_combined and all_chords:
            combined_path = output_dir / f"{song.title}_full.mid"

            if song.instrumentation:
                midi = self._build_multi_instrument_midi(song, tempo)
            else:
                # Backward-compatible single-piano export
                chords = [Chord.from_symbol(c) for c in all_chords]
                midi = create_chord_midi(
                    chords=chords,
                    tempo=tempo,
                    chord_duration=2.0,
                    velocity=self.default_velocity,
                )

            midi.write(str(combined_path))
            results["combined"] = combined_path

        return results

    # ------------------------------------------------------------------
    # Multi-instrument helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _is_bass_instrument(name: str) -> bool:
        """Return *True* if *name* looks like a bass instrument."""
        lower = name.strip().lower()
        return "bass" in lower

    def _build_multi_instrument_midi(
        self,
        song: Song,
        tempo: int,
    ) -> pretty_midi.PrettyMIDI:
        """Build a PrettyMIDI object with one track per instrument.

        Instruments that map to a bass program (33-39) receive root-only
        notes one octave below the chord voicing.  All other instruments
        receive full chord voicings with section-appropriate velocity.
        """
        midi = pretty_midi.PrettyMIDI(initial_tempo=tempo)
        beat_duration = 60.0 / tempo
        chord_duration_beats = 2.0
        chord_time = chord_duration_beats * beat_duration

        # Separate bass instruments from melodic/harmonic ones
        bass_instruments: list[str] = []
        other_instruments: list[str] = []
        for inst_name in song.instrumentation:
            if self._is_bass_instrument(inst_name):
                bass_instruments.append(inst_name)
            else:
                other_instruments.append(inst_name)

        # If no non-bass instruments are listed, default to piano for chords
        if not other_instruments:
            other_instruments = ["piano"]

        # --- harmonic / melodic tracks ---
        for inst_name in other_instruments:
            program = resolve_program(inst_name)
            instrument = pretty_midi.Instrument(
                program=program,
                name=inst_name,
            )

            current_time = 0.0
            for section in song.sections:
                if not section.chord_progression:
                    continue

                velocity = get_section_velocity(
                    section.section_type,
                    base_velocity=self.default_velocity,
                )

                for chord_sym in section.chord_progression:
                    chord_obj = Chord.from_symbol(chord_sym)
                    notes = chord_to_midi_notes(chord_obj)

                    for note_num in notes:
                        note = pretty_midi.Note(
                            velocity=velocity,
                            pitch=note_num,
                            start=current_time,
                            end=current_time + chord_time,
                        )
                        instrument.notes.append(note)

                    current_time += chord_time

            midi.instruments.append(instrument)

        # --- bass track(s) ---
        for inst_name in bass_instruments:
            program = resolve_program(inst_name)
            instrument = pretty_midi.Instrument(
                program=program,
                name=inst_name,
            )

            current_time = 0.0
            for section in song.sections:
                if not section.chord_progression:
                    continue

                velocity = get_section_velocity(
                    section.section_type,
                    base_velocity=self.default_velocity,
                )

                for chord_sym in section.chord_progression:
                    chord_obj = Chord.from_symbol(chord_sym)
                    # Bass plays root note one octave below the chord voicing
                    root_midi = note_to_midi(chord_obj.root, octave=3)
                    note = pretty_midi.Note(
                        velocity=velocity,
                        pitch=root_midi,
                        start=current_time,
                        end=current_time + chord_time,
                    )
                    instrument.notes.append(note)

                    current_time += chord_time

            midi.instruments.append(instrument)

        return midi

    def export_from_symbols(
        self,
        chord_symbols: list[str],
        output_path: Path,
        tempo: int = 120,
        chord_duration: float = 2.0,
    ) -> Path:
        """
        Export a list of chord symbols directly to MIDI.

        Args:
            chord_symbols: List of chord symbols (e.g., ["C", "Am", "F", "G"])
            output_path: Output file path
            tempo: Tempo in BPM
            chord_duration: Duration per chord in beats

        Returns:
            Path to created file
        """
        chords = [Chord.from_symbol(c) for c in chord_symbols]
        midi = create_chord_midi(
            chords=chords,
            tempo=tempo,
            chord_duration=chord_duration,
            velocity=self.default_velocity,
        )

        output_path = Path(output_path)
        midi.write(str(output_path))
        return output_path


def midi_to_audio_info() -> str:
    """Return information about converting MIDI to audio."""
    return """
To convert MIDI to audio, you'll need:

1. A DAW (Digital Audio Workstation):
   - Ableton Live, Logic Pro, FL Studio, Reaper, etc.
   - Import the MIDI and assign instruments/sounds

2. Command-line tools:
   - FluidSynth: fluidsynth -F output.wav soundfont.sf2 input.mid
   - TiMidity: timidity -Ow -o output.wav input.mid

3. Online converters:
   - Various websites can convert MIDI to MP3/WAV
   - Quality depends on the soundfont/instrument samples used

The MIDI file contains the notes and timing, but you need
a synthesizer or sampler to create the actual audio.
"""
