"""Music theory utilities endpoints."""

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from album_conceptualizer.models.music_theory import (
    Chord,
    ChordQuality,
    Key,
    Scale,
    ScaleType,
)


router = APIRouter()


class ChordAnalysisRequest(BaseModel):
    """Request for chord analysis."""

    symbol: str = Field(..., description="Chord symbol like 'Am7', 'Cmaj7', 'F/C'")


class ChordAnalysisResponse(BaseModel):
    """Response for chord analysis."""

    input: str
    root: str
    quality: str
    bass_note: str | None
    normalized_symbol: str
    intervals: list[str]


class ScaleRequest(BaseModel):
    """Request for scale generation."""

    root: str = Field(..., description="Root note like 'C', 'F#', 'Bb'")
    scale_type: str = Field(default="major", description="Scale type")


class ScaleResponse(BaseModel):
    """Response for scale data."""

    root: str
    scale_type: str
    notes: list[str]


class KeyAnalysisResponse(BaseModel):
    """Response for key analysis."""

    tonic: str
    mode: str
    diatonic_chords: list[str]
    common_progressions: list[list[str]]
    relative_key: dict[str, str]


class ProgressionAnalysisRequest(BaseModel):
    """Request for progression analysis."""

    chords: list[str] = Field(..., description="List of chord symbols")
    key: str | None = Field(default=None, description="Key context like 'C major'")


class ProgressionAnalysisResponse(BaseModel):
    """Response for progression analysis."""

    chords: list[str]
    key: str | None
    roman_numerals: list[str]
    analysis: str


class ChordSuggestionResponse(BaseModel):
    """Response for chord suggestions."""

    current_chord: str
    suggestions: list[dict[str, str]]
    context: str


@router.post("/chord/analyze", response_model=ChordAnalysisResponse)
async def analyze_chord(data: ChordAnalysisRequest) -> ChordAnalysisResponse:
    """
    Analyze a chord symbol.

    Parses the chord and returns its components.
    """
    chord = Chord.from_symbol(data.symbol)

    # Define intervals for each quality
    interval_map = {
        ChordQuality.MAJOR: ["1", "3", "5"],
        ChordQuality.MINOR: ["1", "b3", "5"],
        ChordQuality.DIMINISHED: ["1", "b3", "b5"],
        ChordQuality.AUGMENTED: ["1", "3", "#5"],
        ChordQuality.DOMINANT_7: ["1", "3", "5", "b7"],
        ChordQuality.MAJOR_7: ["1", "3", "5", "7"],
        ChordQuality.MINOR_7: ["1", "b3", "5", "b7"],
        ChordQuality.HALF_DIMINISHED: ["1", "b3", "b5", "b7"],
        ChordQuality.DIMINISHED_7: ["1", "b3", "b5", "bb7"],
        ChordQuality.SUS2: ["1", "2", "5"],
        ChordQuality.SUS4: ["1", "4", "5"],
        ChordQuality.ADD9: ["1", "3", "5", "9"],
        ChordQuality.POWER: ["1", "5"],
    }

    return ChordAnalysisResponse(
        input=data.symbol,
        root=chord.root,
        quality=chord.quality.value,
        bass_note=chord.bass_note,
        normalized_symbol=chord.to_symbol(),
        intervals=interval_map.get(chord.quality, ["1", "3", "5"]),
    )


@router.get("/scale", response_model=ScaleResponse)
async def get_scale(
    root: str = Query(..., description="Root note"),
    scale_type: str = Query("major", description="Scale type"),
) -> ScaleResponse:
    """
    Generate a scale.

    Returns the notes in the specified scale.
    """
    # Map string to enum
    try:
        st = ScaleType(scale_type)
    except ValueError:
        st = ScaleType.MAJOR

    scale = Scale(root=root, scale_type=st)

    return ScaleResponse(
        root=root,
        scale_type=scale_type,
        notes=scale.get_notes(),
    )


@router.get("/scale/types", response_model=list[str])
async def list_scale_types() -> list[str]:
    """List all available scale types."""
    return [st.value for st in ScaleType]


@router.get("/key/{tonic}/{mode}", response_model=KeyAnalysisResponse)
async def analyze_key(tonic: str, mode: str = "major") -> KeyAnalysisResponse:
    """
    Analyze a musical key.

    Returns diatonic chords, common progressions, and relative key.
    """
    key = Key(tonic=tonic, mode=mode)
    relative = key.relative_key()

    return KeyAnalysisResponse(
        tonic=tonic,
        mode=mode,
        diatonic_chords=key.get_diatonic_chords(),
        common_progressions=key.get_common_progressions(),
        relative_key={"tonic": relative.tonic, "mode": relative.mode},
    )


@router.post("/progression/analyze", response_model=ProgressionAnalysisResponse)
async def analyze_progression(data: ProgressionAnalysisRequest) -> ProgressionAnalysisResponse:
    """
    Analyze a chord progression.

    Provides Roman numeral analysis if key is specified.
    """
    roman_numerals = []
    analysis_parts = []

    if data.key:
        # Parse key
        key_parts = data.key.split()
        tonic = key_parts[0] if key_parts else "C"
        mode = key_parts[1] if len(key_parts) > 1 else "major"
        key = Key(tonic=tonic, mode=mode)

        # Get diatonic chords for reference
        diatonic = key.get_diatonic_chords()
        analysis_parts.append(f"Key: {tonic} {mode}")
        analysis_parts.append(f"Diatonic chords: {', '.join(diatonic)}")

        # Simple Roman numeral mapping (would need enhancement for full analysis)
        chromatic = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
        try:
            tonic_idx = chromatic.index(tonic)
        except ValueError:
            tonic_idx = 0

        for chord_symbol in data.chords:
            chord = Chord.from_symbol(chord_symbol)
            try:
                chord_idx = chromatic.index(chord.root)
            except ValueError:
                roman_numerals.append("?")
                continue

            interval = (chord_idx - tonic_idx) % 12
            degree_map = {0: "I", 2: "II", 4: "III", 5: "IV", 7: "V", 9: "VI", 11: "VII"}
            numeral = degree_map.get(interval, "?")

            if chord.quality == ChordQuality.MINOR:
                numeral = numeral.lower()
            elif chord.quality == ChordQuality.DIMINISHED:
                numeral = numeral.lower() + "°"

            roman_numerals.append(numeral)
    else:
        roman_numerals = ["?" for _ in data.chords]
        analysis_parts.append("No key specified - cannot determine Roman numerals")

    return ProgressionAnalysisResponse(
        chords=data.chords,
        key=data.key,
        roman_numerals=roman_numerals,
        analysis="\n".join(analysis_parts),
    )


@router.get("/progression/suggest", response_model=ChordSuggestionResponse)
async def suggest_next_chord(
    current: str = Query(..., description="Current chord"),
    key: str | None = Query(None, description="Key context"),
    style: str = Query("pop", description="Style: pop, jazz, rock, classical"),
) -> ChordSuggestionResponse:
    """
    Suggest next chords based on current chord and style.

    Uses common chord progression patterns.
    """
    suggestions = []
    context_parts = []

    chord = Chord.from_symbol(current)
    context_parts.append(f"Current chord: {chord.to_symbol()}")

    # Style-based suggestions
    if style == "pop":
        # Common pop progressions
        suggestions = [
            {"chord": "G", "reason": "V chord - strong resolution"},
            {"chord": "Am", "reason": "vi chord - emotional turn"},
            {"chord": "F", "reason": "IV chord - classic movement"},
            {"chord": "Dm", "reason": "ii chord - pre-dominant"},
        ]
        context_parts.append("Style: Pop - using common I-V-vi-IV patterns")

    elif style == "jazz":
        suggestions = [
            {"chord": "Dm7", "reason": "ii7 - jazz ii-V setup"},
            {"chord": "G7", "reason": "V7 - dominant resolution"},
            {"chord": "Cmaj7", "reason": "Imaj7 - tonic arrival"},
            {"chord": "Am7", "reason": "vi7 - relative minor color"},
        ]
        context_parts.append("Style: Jazz - using ii-V-I and extensions")

    elif style == "rock":
        suggestions = [
            {"chord": "G", "reason": "Power chord movement"},
            {"chord": "F", "reason": "bVII - rock cadence"},
            {"chord": "Am", "reason": "Relative minor"},
            {"chord": "D", "reason": "V - classic rock resolution"},
        ]
        context_parts.append("Style: Rock - using power chords and modal mixture")

    else:
        suggestions = [
            {"chord": "G", "reason": "Dominant resolution"},
            {"chord": "F", "reason": "Subdominant"},
            {"chord": "Am", "reason": "Relative minor"},
        ]
        context_parts.append("Style: Classical - using functional harmony")

    return ChordSuggestionResponse(
        current_chord=current,
        suggestions=suggestions,
        context="\n".join(context_parts),
    )


@router.get("/chord/qualities", response_model=list[str])
async def list_chord_qualities() -> list[str]:
    """List all supported chord qualities."""
    return [q.value for q in ChordQuality]
