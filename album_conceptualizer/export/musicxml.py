"""MusicXML export functionality using music21."""

from pathlib import Path
from typing import Any

from album_conceptualizer.models.album import Song
from album_conceptualizer.models.music_theory import Chord, ChordProgression, ChordQuality


class MusicXMLExporter:
    """
    Export songs to MusicXML format using music21.

    MusicXML is the standard interchange format for notation software
    like MuseScore, Finale, Sibelius, and Dorico.
    """

    def __init__(self):
        """Initialize the MusicXML exporter."""
        # Lazy import music21 as it's heavy
        self._music21 = None

    @property
    def music21(self):
        """Lazy load music21."""
        if self._music21 is None:
            import music21

            self._music21 = music21
        return self._music21

    def chord_to_music21(self, chord: Chord) -> Any:
        """Convert our Chord model to a music21 Chord."""
        m21 = self.music21

        # Build pitch list
        pitches = []
        root = chord.root

        # Map chord quality to intervals
        quality_intervals = {
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

        intervals = quality_intervals.get(chord.quality, [0, 4, 7])

        # Create root pitch
        root_pitch = m21.pitch.Pitch(root + "4")

        # Build chord pitches
        for interval in intervals:
            p = m21.pitch.Pitch()
            p.midi = root_pitch.midi + interval
            pitches.append(p)

        # Handle bass note
        if chord.bass_note:
            bass_pitch = m21.pitch.Pitch(chord.bass_note + "3")
            pitches.insert(0, bass_pitch)

        return m21.chord.Chord(pitches)

    def export_progression(
        self,
        progression: ChordProgression,
        output_path: Path,
        beats_per_chord: float = 4.0,
        time_signature: str = "4/4",
    ) -> Path:
        """
        Export a chord progression to MusicXML.

        Args:
            progression: ChordProgression to export
            output_path: Output file path
            beats_per_chord: Duration of each chord in beats
            time_signature: Time signature string

        Returns:
            Path to created file
        """
        m21 = self.music21

        # Create score
        score = m21.stream.Score()
        part = m21.stream.Part()

        # Add time signature
        ts_parts = time_signature.split("/")
        ts = m21.meter.TimeSignature(f"{ts_parts[0]}/{ts_parts[1]}")
        part.append(ts)

        # Add key if specified
        if progression.key:
            ks = m21.key.Key(progression.key.tonic, progression.key.mode)
            part.append(ks)

        # Add chords
        for chord in progression.chords:
            m21_chord = self.chord_to_music21(chord)
            m21_chord.duration = m21.duration.Duration(beats_per_chord)

            # Add chord symbol
            cs = m21.harmony.ChordSymbol(chord.to_symbol())
            part.append(cs)
            part.append(m21_chord)

        score.append(part)

        # Write to file
        output_path = Path(output_path)
        score.write("musicxml", fp=str(output_path))
        return output_path

    def export_song(
        self,
        song: Song,
        output_path: Path,
        include_lyrics: bool = True,
    ) -> Path:
        """
        Export a song to MusicXML.

        Args:
            song: Song to export
            output_path: Output file path
            include_lyrics: Whether to include lyrics

        Returns:
            Path to created file
        """
        m21 = self.music21

        # Create score
        score = m21.stream.Score()
        score.metadata = m21.metadata.Metadata()
        score.metadata.title = song.title

        part = m21.stream.Part()
        part.partName = "Chords"

        # Add time signature
        if song.time_signature:
            ts_parts = song.time_signature.split("/")
            ts = m21.meter.TimeSignature(f"{ts_parts[0]}/{ts_parts[1]}")
        else:
            ts = m21.meter.TimeSignature("4/4")
        part.append(ts)

        # Add tempo
        if song.tempo:
            mm = m21.tempo.MetronomeMark(number=song.tempo)
            part.append(mm)

        # Add key
        if song.key:
            # Parse key string (e.g., "C major", "A minor", "D")
            key_parts = song.key.split()
            tonic = key_parts[0]
            mode = key_parts[1] if len(key_parts) > 1 else "major"
            ks = m21.key.Key(tonic, mode)
            part.append(ks)

        # Add sections
        for section in song.sections:
            # Add section marker
            marker = m21.expressions.TextExpression(section.section_type.upper())
            part.append(marker)

            if section.chord_progression:
                for chord_symbol in section.chord_progression:
                    chord = Chord.from_symbol(chord_symbol)
                    m21_chord = self.chord_to_music21(chord)
                    m21_chord.duration = m21.duration.Duration(4.0)

                    # Add chord symbol annotation
                    cs = m21.harmony.ChordSymbol(chord_symbol)
                    part.append(cs)
                    part.append(m21_chord)

        score.append(part)

        # Add lyrics as a text part if requested
        if include_lyrics:
            lyrics_text = song.get_full_lyrics()
            if lyrics_text:
                score.metadata.addContributor(
                    m21.metadata.Contributor(name="Lyrics", role="lyricist")
                )

        output_path = Path(output_path)
        score.write("musicxml", fp=str(output_path))
        return output_path

    def export_from_symbols(
        self,
        chord_symbols: list[str],
        output_path: Path,
        title: str = "Chord Progression",
        beats_per_chord: float = 4.0,
    ) -> Path:
        """
        Export a list of chord symbols to MusicXML.

        Args:
            chord_symbols: List of chord symbols
            output_path: Output file path
            title: Title for the score
            beats_per_chord: Duration per chord in beats

        Returns:
            Path to created file
        """
        m21 = self.music21

        score = m21.stream.Score()
        score.metadata = m21.metadata.Metadata()
        score.metadata.title = title

        part = m21.stream.Part()
        ts = m21.meter.TimeSignature("4/4")
        part.append(ts)

        for symbol in chord_symbols:
            chord = Chord.from_symbol(symbol)
            m21_chord = self.chord_to_music21(chord)
            m21_chord.duration = m21.duration.Duration(beats_per_chord)

            cs = m21.harmony.ChordSymbol(symbol)
            part.append(cs)
            part.append(m21_chord)

        score.append(part)

        output_path = Path(output_path)
        score.write("musicxml", fp=str(output_path))
        return output_path


def analyze_with_music21(chord_symbols: list[str], key: str | None = None) -> dict[str, Any]:
    """
    Analyze chord progression using music21.

    Args:
        chord_symbols: List of chord symbols
        key: Optional key context

    Returns:
        Analysis dictionary
    """
    import music21 as m21

    # Create a stream with the chords
    s: Any = m21.stream.Stream()

    if key:
        key_parts = key.split()
        tonic = key_parts[0]
        mode = key_parts[1] if len(key_parts) > 1 else "major"
        ks = m21.key.Key(tonic, mode)
        s.append(ks)

    for symbol in chord_symbols:
        cs = m21.harmony.ChordSymbol(symbol)
        s.append(cs)

    # Analyze
    roman_numerals: list[str] = []
    analysis_notes: list[str] = []
    result: dict[str, Any] = {
        "chord_symbols": chord_symbols,
        "key": key,
        "roman_numerals": roman_numerals,
        "analysis_notes": analysis_notes,
    }

    # Get Roman numeral analysis if key is provided
    if key:
        for cs in s.recurse().getElementsByClass("ChordSymbol"):
            try:
                rn = m21.roman.romanNumeralFromChord(cs, ks)
                roman_numerals.append(str(rn.figure))
            except Exception:
                roman_numerals.append("?")

    # Detect key if not provided
    if not key:
        try:
            analysis = s.analyze("key")
            result["detected_key"] = f"{analysis.tonic.name} {analysis.mode}"
            result["key_correlation"] = analysis.correlationCoefficient
        except Exception:
            analysis_notes.append("Unable to detect key")

    return result
