"""Export endpoints for generating files in various formats."""

import shutil
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


class AlbumZipExportRequest(BaseModel):
    """Request for exporting an album bundle as a zip archive."""

    album: dict = Field(..., description="Album JSON payload compatible with the Album model.")
    formats: list[str] = Field(
        default_factory=lambda: ["json"],
        description="List of formats: midi, chordpro, musicxml, json, text",
    )
    include_production_notes: bool = Field(
        default=True,
        description="Include production notes when supported by exporters.",
    )


def _cleanup_temp_dir(path: str) -> None:
    shutil.rmtree(path, ignore_errors=True)


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


@router.post("/album/zip")
async def export_album_zip(
    data: AlbumZipExportRequest,
    background_tasks: BackgroundTasks,
) -> FileResponse:
    """
    Export a full album bundle to a downloadable zip archive.

    This endpoint is stateless: it accepts the album JSON and runs exporters without relying on
    server-side project storage. Useful for the Next.js dashboard.
    """
    try:
        from album_conceptualizer.models.album import Album
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Album model unavailable: {exc}") from exc

    try:
        from album_conceptualizer.export.formats import AlbumExporter, ExportFormat
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="Export formats unavailable. Install with: pip install -e '.[music]'",
        ) from None

    try:
        album = Album.model_validate(data.album)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid album payload: {exc}") from exc

    formats: list[ExportFormat] = []
    try:
        for fmt in data.formats:
            formats.append(ExportFormat(fmt))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid export format.") from None

    # Create a temp export folder and zip. Both are cleaned up after the response is sent.
    temp_dir = tempfile.mkdtemp(prefix="album_export_")
    output_dir = Path(temp_dir)

    exporter = AlbumExporter(output_dir=output_dir, artist_name=album.artist)
    results = exporter.export_album(album, formats)
    try:
        import json as _json

        report_path = output_dir / "export_report.json"
        report_path.write_text(
            _json.dumps(
                {
                    "album_title": album.title,
                    "formats": {
                        fmt: [
                            {
                                "path": str(r.path.relative_to(output_dir)),
                                "success": r.success,
                                "message": r.message,
                            }
                            for r in result_list
                        ]
                        for fmt, result_list in results.items()
                    },
                },
                indent=2,
            )
        )
    except Exception:
        # Export is still useful even if the report can't be written.
        pass

    safe_title = "".join(c for c in album.title if c.isalnum() or c in (" ", "_", "-")).strip()
    safe_title = "_".join(safe_title.split()) or "album"
    zip_name = f"{safe_title}_export.zip"

    zip_path = output_dir / zip_name
    try:
        import zipfile

        # Exporter writes into <output_dir>/<album_title_sanitized>/...
        # Zip the whole temp directory to preserve exporter folder structure.
        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            for file_path in output_dir.rglob("*"):
                if file_path.is_dir() or file_path == zip_path:
                    continue
                zf.write(file_path, arcname=str(file_path.relative_to(output_dir)))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to build zip: {exc}") from exc

    background_tasks.add_task(_cleanup_temp_dir, temp_dir)
    response = FileResponse(
        path=str(zip_path),
        filename=zip_name,
        media_type="application/zip",
    )
    response.background = background_tasks
    return response


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
