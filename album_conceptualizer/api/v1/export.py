"""Export endpoints for generating files in various formats."""

import tempfile
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request
from fastapi.responses import FileResponse, PlainTextResponse
from pydantic import BaseModel, Field

from album_conceptualizer.api.v1.albums import get_album_store
from album_conceptualizer.export.chordpro import ChordProExporter, format_chordpro


router = APIRouter()


def _cleanup_temp_file(path: str) -> None:
    Path(path).unlink(missing_ok=True)


class ChordProRequest(BaseModel):
    """Request for generating ChordPro format."""

    title: str
    artist: str | None = None
    key: str | None = None
    tempo: int | None = None
    sections: list[dict] = Field(
        default_factory=list,
        description="List of {name, lyrics, chords} objects",
    )


class ProgressionExportRequest(BaseModel):
    """Request for exporting a chord progression."""

    chords: list[str] = Field(..., description="List of chord symbols")
    tempo: int = Field(default=120, ge=20, le=300)
    bars_per_chord: int = Field(default=1, ge=1, le=8)
    key: str | None = None
    title: str | None = None


@router.post("/chordpro", response_class=PlainTextResponse)
async def generate_chordpro(data: ChordProRequest) -> str:
    """
    Generate ChordPro format from provided data.

    Returns plain text ChordPro format.
    """
    # Build lyrics with inline chords
    lyrics_parts = []
    for section in data.sections:
        name = section.get("name", "")
        lyrics = section.get("lyrics", "")
        chords = section.get("chords", [])

        if name:
            lyrics_parts.append(f"{{comment: {name}}}")

        # Simple chord placement at start of lines
        lines = lyrics.split("\n") if lyrics else []
        for i, line in enumerate(lines):
            if i < len(chords) and chords[i]:
                line = f"[{chords[i]}]{line}"
            lyrics_parts.append(line)

        lyrics_parts.append("")

    full_lyrics = "\n".join(lyrics_parts)

    return format_chordpro(
        title=data.title,
        lyrics=full_lyrics,
        key=data.key,
        tempo=data.tempo,
        artist=data.artist,
    )


@router.get("/album/{album_id}/chordpro", response_class=PlainTextResponse)
async def export_album_chordpro(
    request: Request,
    album_id: str,
    song_id: str | None = Query(None, description="Export specific song"),
) -> str:
    """
    Export album or song as ChordPro.

    If song_id is provided, exports only that song.
    Otherwise exports all songs concatenated.
    """
    album = get_album_store(request).get(album_id)
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")

    exporter = ChordProExporter(default_artist=album.artist)
    parts = []

    songs_to_export = album.songs
    if song_id:
        songs_to_export = [s for s in album.songs if str(s.id) == song_id]
        if not songs_to_export:
            raise HTTPException(status_code=404, detail="Song not found")

    for song in sorted(songs_to_export, key=lambda s: s.track_number):
        # Build sections for exporter
        sections = []
        for section in song.sections:
            section_type = (
                section.section_type.value
                if hasattr(section.section_type, "value")
                else str(section.section_type)
            )
            sections.append(
                (
                    section_type.replace("_", " ").title(),
                    section.lyrics or "",
                    section.chord_progression,
                )
            )

        chordpro = exporter.format_simple(
            title=song.title,
            sections=sections,
            key=song.key,
            tempo=song.tempo,
        )
        parts.append(chordpro)

    return "\n\n".join(parts)


@router.get("/album/{album_id}/json")
async def export_album_json(request: Request, album_id: str) -> dict:
    """
    Export album as JSON.

    Returns the full album data structure.
    """
    album = get_album_store(request).get(album_id)
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")

    return album.model_dump(mode="json")


@router.get("/album/{album_id}/tracklist", response_class=PlainTextResponse)
async def export_tracklist(request: Request, album_id: str) -> str:
    """
    Export album tracklist as plain text.

    Returns formatted tracklist with song titles.
    """
    album = get_album_store(request).get(album_id)
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")

    return album.to_tracklist()


@router.post("/progression/midi")
async def export_progression_midi(
    data: ProgressionExportRequest,
    background_tasks: BackgroundTasks,
) -> FileResponse:
    """
    Export chord progression as MIDI file.

    Returns a downloadable MIDI file.
    """
    try:
        from album_conceptualizer.export.midi import create_chord_midi
        from album_conceptualizer.models.music_theory import Chord
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="MIDI export not available. Install with: pip install -e '.[music]'",
        ) from None

    # Parse chords
    chords = [Chord.from_symbol(c) for c in data.chords]

    # Create MIDI
    midi = create_chord_midi(
        chords=chords,
        tempo=data.tempo,
        chord_duration=data.bars_per_chord * 4.0,  # Assuming 4/4
    )

    # Write to temp file
    with tempfile.NamedTemporaryFile(suffix=".mid", delete=False) as f:
        midi.write(f.name)
        temp_path = f.name

    filename = data.title or "progression"
    filename = filename.replace(" ", "_").lower()

    background_tasks.add_task(_cleanup_temp_file, temp_path)
    response = FileResponse(
        path=temp_path,
        filename=f"{filename}.mid",
        media_type="audio/midi",
    )
    response.background = background_tasks
    return response


@router.post("/progression/musicxml")
async def export_progression_musicxml(
    data: ProgressionExportRequest,
    background_tasks: BackgroundTasks,
) -> FileResponse:
    """
    Export chord progression as MusicXML file.

    Returns a downloadable MusicXML file.
    """
    try:
        from album_conceptualizer.export.musicxml import MusicXMLExporter
        from album_conceptualizer.models.music_theory import Chord, ChordProgression
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="MusicXML export not available. Install with: pip install -e '.[music]'",
        ) from None

    # Create progression
    progression = ChordProgression(
        chords=[Chord.from_symbol(c) for c in data.chords],
        name=data.title,
    )

    # Export
    exporter = MusicXMLExporter()

    with tempfile.NamedTemporaryFile(suffix=".musicxml", delete=False) as f:
        temp_path = Path(f.name)

    exporter.export_progression(progression, temp_path)

    filename = data.title or "progression"
    filename = filename.replace(" ", "_").lower()

    background_tasks.add_task(_cleanup_temp_file, str(temp_path))
    response = FileResponse(
        path=str(temp_path),
        filename=f"{filename}.musicxml",
        media_type="application/vnd.recordare.musicxml+xml",
    )
    response.background = background_tasks
    return response


@router.get("/formats")
async def list_export_formats() -> dict:
    """
    List available export formats and their status.

    Shows which formats are available based on installed dependencies.
    """
    formats = {
        "chordpro": {
            "available": True,
            "description": "ChordPro text format for lyrics with chords",
            "extension": ".cho",
        },
        "json": {
            "available": True,
            "description": "JSON data export",
            "extension": ".json",
        },
        "text": {
            "available": True,
            "description": "Plain text lyrics",
            "extension": ".txt",
        },
    }

    # Check optional formats
    try:
        import pretty_midi  # noqa: F401

        formats["midi"] = {
            "available": True,
            "description": "MIDI file for DAWs",
            "extension": ".mid",
        }
    except ImportError:
        formats["midi"] = {
            "available": False,
            "description": "MIDI file for DAWs (requires: pip install -e '.[music]')",
            "extension": ".mid",
        }

    try:
        import music21  # noqa: F401

        formats["musicxml"] = {
            "available": True,
            "description": "MusicXML for notation software",
            "extension": ".musicxml",
        }
    except ImportError:
        formats["musicxml"] = {
            "available": False,
            "description": "MusicXML for notation software (requires: pip install -e '.[music]')",
            "extension": ".musicxml",
        }

    return formats
