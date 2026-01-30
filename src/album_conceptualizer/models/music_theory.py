"""Music theory data models."""

from enum import Enum
from typing import Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class ChordQuality(str, Enum):
    """Common chord qualities."""

    MAJOR = "major"
    MINOR = "minor"
    DIMINISHED = "diminished"
    AUGMENTED = "augmented"
    DOMINANT_7 = "dominant_7"
    MAJOR_7 = "major_7"
    MINOR_7 = "minor_7"
    HALF_DIMINISHED = "half_diminished"
    DIMINISHED_7 = "diminished_7"
    SUS2 = "sus2"
    SUS4 = "sus4"
    ADD9 = "add9"
    POWER = "power"


class ScaleType(str, Enum):
    """Common scale types."""

    MAJOR = "major"
    NATURAL_MINOR = "natural_minor"
    HARMONIC_MINOR = "harmonic_minor"
    MELODIC_MINOR = "melodic_minor"
    DORIAN = "dorian"
    PHRYGIAN = "phrygian"
    LYDIAN = "lydian"
    MIXOLYDIAN = "mixolydian"
    LOCRIAN = "locrian"
    PENTATONIC_MAJOR = "pentatonic_major"
    PENTATONIC_MINOR = "pentatonic_minor"
    BLUES = "blues"


class Chord(BaseModel):
    """A musical chord."""

    root: str = Field(description="Root note (e.g., 'C', 'F#', 'Bb')")
    quality: ChordQuality = Field(default=ChordQuality.MAJOR)
    bass_note: Optional[str] = Field(default=None, description="Bass note for slash chords")
    extensions: list[str] = Field(default_factory=list, description="Extensions like '9', '#11'")

    # Roman numeral analysis
    roman_numeral: Optional[str] = Field(
        default=None, description="Roman numeral in context (e.g., 'IV', 'vi', 'V/V')"
    )
    function: Optional[str] = Field(
        default=None, description="Harmonic function (tonic, subdominant, dominant)"
    )

    def to_symbol(self) -> str:
        """Convert to chord symbol (e.g., 'Cmaj7', 'Am', 'G/B')."""
        quality_symbols = {
            ChordQuality.MAJOR: "",
            ChordQuality.MINOR: "m",
            ChordQuality.DIMINISHED: "dim",
            ChordQuality.AUGMENTED: "aug",
            ChordQuality.DOMINANT_7: "7",
            ChordQuality.MAJOR_7: "maj7",
            ChordQuality.MINOR_7: "m7",
            ChordQuality.HALF_DIMINISHED: "m7b5",
            ChordQuality.DIMINISHED_7: "dim7",
            ChordQuality.SUS2: "sus2",
            ChordQuality.SUS4: "sus4",
            ChordQuality.ADD9: "add9",
            ChordQuality.POWER: "5",
        }

        symbol = f"{self.root}{quality_symbols[self.quality]}"
        if self.extensions:
            symbol += "".join(self.extensions)
        if self.bass_note:
            symbol += f"/{self.bass_note}"
        return symbol

    @classmethod
    def from_symbol(cls, symbol: str) -> "Chord":
        """Parse a chord symbol into a Chord object."""
        # Basic parsing - can be extended
        symbol = symbol.strip()

        # Handle slash chords
        bass_note = None
        if "/" in symbol:
            parts = symbol.split("/")
            symbol = parts[0]
            bass_note = parts[1]

        # Extract root note
        root = symbol[0].upper()
        idx = 1
        if len(symbol) > 1 and symbol[1] in "#b":
            root += symbol[1]
            idx = 2

        remainder = symbol[idx:]

        # Determine quality
        quality = ChordQuality.MAJOR
        if remainder.startswith("m7b5"):
            quality = ChordQuality.HALF_DIMINISHED
        elif remainder.startswith("maj7"):
            quality = ChordQuality.MAJOR_7
        elif remainder.startswith("dim7"):
            quality = ChordQuality.DIMINISHED_7
        elif remainder.startswith("dim"):
            quality = ChordQuality.DIMINISHED
        elif remainder.startswith("aug"):
            quality = ChordQuality.AUGMENTED
        elif remainder.startswith("m7"):
            quality = ChordQuality.MINOR_7
        elif remainder.startswith("m"):
            quality = ChordQuality.MINOR
        elif remainder.startswith("7"):
            quality = ChordQuality.DOMINANT_7
        elif remainder.startswith("sus2"):
            quality = ChordQuality.SUS2
        elif remainder.startswith("sus4"):
            quality = ChordQuality.SUS4
        elif remainder.startswith("add9"):
            quality = ChordQuality.ADD9
        elif remainder == "5":
            quality = ChordQuality.POWER

        return cls(root=root, quality=quality, bass_note=bass_note)


class Scale(BaseModel):
    """A musical scale."""

    root: str = Field(description="Root note")
    scale_type: ScaleType = Field(default=ScaleType.MAJOR)

    def get_notes(self) -> list[str]:
        """Get the notes in the scale."""
        chromatic = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

        # Convert flats to sharps for calculation
        root_normalized = self.root.replace("b", "#")
        if root_normalized.endswith("##"):
            # Handle double sharps by moving up
            idx = chromatic.index(root_normalized[0])
            root_normalized = chromatic[(idx + 2) % 12]
        elif len(root_normalized) > 1 and root_normalized not in chromatic:
            # Handle enharmonics
            enharmonics = {"Db": "C#", "Eb": "D#", "Gb": "F#", "Ab": "G#", "Bb": "A#"}
            root_normalized = enharmonics.get(self.root, self.root)

        try:
            root_idx = chromatic.index(root_normalized)
        except ValueError:
            root_idx = chromatic.index(self.root[0])

        intervals = {
            ScaleType.MAJOR: [0, 2, 4, 5, 7, 9, 11],
            ScaleType.NATURAL_MINOR: [0, 2, 3, 5, 7, 8, 10],
            ScaleType.HARMONIC_MINOR: [0, 2, 3, 5, 7, 8, 11],
            ScaleType.MELODIC_MINOR: [0, 2, 3, 5, 7, 9, 11],
            ScaleType.DORIAN: [0, 2, 3, 5, 7, 9, 10],
            ScaleType.PHRYGIAN: [0, 1, 3, 5, 7, 8, 10],
            ScaleType.LYDIAN: [0, 2, 4, 6, 7, 9, 11],
            ScaleType.MIXOLYDIAN: [0, 2, 4, 5, 7, 9, 10],
            ScaleType.LOCRIAN: [0, 1, 3, 5, 6, 8, 10],
            ScaleType.PENTATONIC_MAJOR: [0, 2, 4, 7, 9],
            ScaleType.PENTATONIC_MINOR: [0, 3, 5, 7, 10],
            ScaleType.BLUES: [0, 3, 5, 6, 7, 10],
        }

        scale_intervals = intervals[self.scale_type]
        return [chromatic[(root_idx + i) % 12] for i in scale_intervals]


class Key(BaseModel):
    """A musical key."""

    tonic: str = Field(description="Tonic note")
    mode: str = Field(default="major", description="Mode (major, minor)")

    def get_diatonic_chords(self) -> list[str]:
        """Get the diatonic chords in Roman numerals."""
        if self.mode == "major":
            return ["I", "ii", "iii", "IV", "V", "vi", "vii°"]
        else:  # minor
            return ["i", "ii°", "III", "iv", "v", "VI", "VII"]

    def get_common_progressions(self) -> list[list[str]]:
        """Get common chord progressions in this key."""
        if self.mode == "major":
            return [
                ["I", "V", "vi", "IV"],  # Pop progression
                ["I", "IV", "V", "I"],  # Classic
                ["I", "vi", "IV", "V"],  # 50s progression
                ["ii", "V", "I"],  # Jazz turnaround
                ["I", "IV", "vi", "V"],  # Axis progression
            ]
        else:
            return [
                ["i", "VI", "III", "VII"],  # Andalusian cadence variation
                ["i", "iv", "v", "i"],  # Minor classic
                ["i", "VII", "VI", "VII"],  # Aeolian vamp
                ["i", "iv", "VII", "III"],  # Minor pop
            ]

    def relative_key(self) -> "Key":
        """Get the relative major or minor key."""
        chromatic = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

        try:
            tonic_idx = chromatic.index(self.tonic)
        except ValueError:
            # Handle flats
            enharmonics = {"Db": "C#", "Eb": "D#", "Gb": "F#", "Ab": "G#", "Bb": "A#"}
            tonic_idx = chromatic.index(enharmonics.get(self.tonic, self.tonic[0]))

        if self.mode == "major":
            # Relative minor is 3 semitones down
            new_idx = (tonic_idx - 3) % 12
            return Key(tonic=chromatic[new_idx], mode="minor")
        else:
            # Relative major is 3 semitones up
            new_idx = (tonic_idx + 3) % 12
            return Key(tonic=chromatic[new_idx], mode="major")


class TimeSignature(BaseModel):
    """A time signature."""

    numerator: int = Field(ge=1, description="Beats per measure")
    denominator: int = Field(ge=1, description="Note value of one beat")

    def __str__(self) -> str:
        return f"{self.numerator}/{self.denominator}"

    @classmethod
    def from_string(cls, s: str) -> "TimeSignature":
        """Parse a time signature string."""
        parts = s.split("/")
        return cls(numerator=int(parts[0]), denominator=int(parts[1]))


class ChordProgression(BaseModel):
    """A chord progression with analysis."""

    id: UUID = Field(default_factory=uuid4)
    name: Optional[str] = None
    chords: list[Chord] = Field(default_factory=list)
    key: Optional[Key] = None

    # Metadata
    genre: Optional[str] = None
    subgenre: Optional[str] = None
    era: Optional[str] = None
    section_type: Optional[str] = None

    # Analysis
    roman_numerals: list[str] = Field(default_factory=list)
    function_analysis: Optional[str] = None

    # Emotional mapping
    valence: Optional[float] = Field(default=None, ge=-1.0, le=1.0)
    arousal: Optional[float] = Field(default=None, ge=-1.0, le=1.0)
    emotional_descriptors: list[str] = Field(default_factory=list)

    def to_symbols(self) -> list[str]:
        """Get chord symbols."""
        return [c.to_symbol() for c in self.chords]

    def to_roman_numerals(self) -> list[str]:
        """Get Roman numeral analysis."""
        if self.roman_numerals:
            return self.roman_numerals
        return [c.roman_numeral for c in self.chords if c.roman_numeral]


class EmotionMapping(BaseModel):
    """Mapping between emotional states and musical characteristics."""

    id: UUID = Field(default_factory=uuid4)
    name: str = Field(description="Emotion name (e.g., 'melancholy', 'triumphant')")

    # Russell's circumplex model coordinates
    valence: float = Field(ge=-1.0, le=1.0, description="Negative to positive")
    arousal: float = Field(ge=-1.0, le=1.0, description="Calm to energetic")

    # Musical characteristics
    suggested_modes: list[str] = Field(default_factory=list)
    suggested_tempos: tuple[int, int] = Field(default=(60, 180))
    harmonic_character: Optional[str] = None
    dynamic_tendency: Optional[str] = None

    # Common progressions for this emotion
    typical_progressions: list[list[str]] = Field(default_factory=list)

    # Instrumentation suggestions
    instrument_suggestions: list[str] = Field(default_factory=list)

    # Example songs
    reference_songs: list[str] = Field(default_factory=list)
