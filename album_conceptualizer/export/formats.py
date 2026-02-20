"""Unified export interface for all formats."""

from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path

from album_conceptualizer.export.chordpro import ChordProExporter
from album_conceptualizer.models.album import Album, Song
from album_conceptualizer.models.music_theory import ChordProgression


class ExportFormat(StrEnum):
    """Supported export formats."""

    MIDI = "midi"
    CHORDPRO = "chordpro"
    MUSICXML = "musicxml"
    JSON = "json"
    TEXT = "text"


@dataclass
class ExportResult:
    """Result of an export operation."""

    format: ExportFormat
    path: Path
    success: bool
    message: str = ""


class AlbumExporter:
    """
    Unified exporter for albums and songs.

    Provides a single interface for exporting to all supported formats.
    """

    def __init__(
        self,
        output_dir: Path,
        default_tempo: int = 120,
        artist_name: str | None = None,
    ):
        """
        Initialize the album exporter.

        Args:
            output_dir: Base output directory
            default_tempo: Default tempo for exports
            artist_name: Default artist name
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.midi_exporter = None
        try:
            from album_conceptualizer.export.midi import MidiExporter

            self.midi_exporter = MidiExporter(default_tempo=default_tempo)
        except ImportError:
            self.midi_exporter = None

        self.chordpro_exporter = ChordProExporter(default_artist=artist_name)

        self.musicxml_exporter = None
        try:
            from album_conceptualizer.export.musicxml import MusicXMLExporter

            self.musicxml_exporter = MusicXMLExporter()
        except ImportError:
            self.musicxml_exporter = None

    def export_album(
        self,
        album: Album,
        formats: list[ExportFormat],
    ) -> dict[str, list[ExportResult]]:
        """
        Export an entire album to specified formats.

        Args:
            album: Album to export
            formats: List of formats to export to

        Returns:
            Dictionary mapping format names to lists of ExportResults
        """
        # Create album directory
        album_dir = self.output_dir / self._sanitize_filename(album.title)
        album_dir.mkdir(parents=True, exist_ok=True)

        results: dict[str, list[ExportResult]] = {f.value: [] for f in formats}

        for song in album.songs:
            song_results = self.export_song(
                song=song,
                formats=formats,
                output_dir=album_dir,
                album_title=album.title,
            )

            for fmt, result_list in song_results.items():
                results[fmt].extend(result_list)

        # Export album-level files
        if ExportFormat.JSON in formats:
            json_path = album_dir / "album.json"
            json_path.write_text(album.model_dump_json(indent=2))
            results[ExportFormat.JSON.value].append(
                ExportResult(
                    format=ExportFormat.JSON,
                    path=json_path,
                    success=True,
                    message="Album metadata exported",
                )
            )

        if ExportFormat.TEXT in formats:
            text_path = album_dir / "tracklist.txt"
            text_path.write_text(album.to_tracklist())
            results[ExportFormat.TEXT.value].append(
                ExportResult(
                    format=ExportFormat.TEXT,
                    path=text_path,
                    success=True,
                    message="Tracklist exported",
                )
            )

        return results

    def export_song(
        self,
        song: Song,
        formats: list[ExportFormat],
        output_dir: Path | None = None,
        album_title: str | None = None,
    ) -> dict[str, list[ExportResult]]:
        """
        Export a song to specified formats.

        Args:
            song: Song to export
            formats: List of formats to export to
            output_dir: Output directory (uses default if not specified)
            album_title: Optional album title for metadata

        Returns:
            Dictionary mapping format names to lists of ExportResults
        """
        output_dir = output_dir or self.output_dir
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        results: dict[str, list[ExportResult]] = {f.value: [] for f in formats}
        song_name = self._sanitize_filename(song.title)

        # MIDI export
        if ExportFormat.MIDI in formats:
            try:
                if not self.midi_exporter:
                    raise RuntimeError(
                        "MIDI export not available. Install with: pip install -e '.[music]'"
                    )
                midi_results = self.midi_exporter.export_song(
                    song=song,
                    output_dir=output_dir / "midi",
                )
                if not midi_results:
                    results[ExportFormat.MIDI.value].append(
                        ExportResult(
                            format=ExportFormat.MIDI,
                            path=output_dir / "midi" / f"{song_name}.mid",
                            success=False,
                            message="MIDI export skipped: no chord progressions found.",
                        )
                    )
                else:
                    for section_name, path in midi_results.items():
                        results[ExportFormat.MIDI.value].append(
                            ExportResult(
                                format=ExportFormat.MIDI,
                                path=path,
                                success=True,
                                message=f"MIDI exported: {section_name}",
                            )
                        )
            except Exception as e:
                results[ExportFormat.MIDI.value].append(
                    ExportResult(
                        format=ExportFormat.MIDI,
                        path=output_dir / "midi" / f"{song_name}.mid",
                        success=False,
                        message=f"MIDI export failed: {e!s}",
                    )
                )

        # ChordPro export
        if ExportFormat.CHORDPRO in formats:
            try:
                chordpro_path = output_dir / "chordpro" / f"{song_name}.cho"
                chordpro_path.parent.mkdir(parents=True, exist_ok=True)
                self.chordpro_exporter.export_song(
                    song=song,
                    output_path=chordpro_path,
                    album_title=album_title,
                )
                results[ExportFormat.CHORDPRO.value].append(
                    ExportResult(
                        format=ExportFormat.CHORDPRO,
                        path=chordpro_path,
                        success=True,
                        message="ChordPro exported",
                    )
                )
            except Exception as e:
                results[ExportFormat.CHORDPRO.value].append(
                    ExportResult(
                        format=ExportFormat.CHORDPRO,
                        path=output_dir / "chordpro" / f"{song_name}.cho",
                        success=False,
                        message=f"ChordPro export failed: {e!s}",
                    )
                )

        # MusicXML export
        if ExportFormat.MUSICXML in formats:
            try:
                if not self.musicxml_exporter:
                    raise RuntimeError(
                        "MusicXML export not available. Install with: pip install -e '.[music]'"
                    )
                xml_path = output_dir / "musicxml" / f"{song_name}.musicxml"
                xml_path.parent.mkdir(parents=True, exist_ok=True)
                self.musicxml_exporter.export_song(
                    song=song,
                    output_path=xml_path,
                )
                results[ExportFormat.MUSICXML.value].append(
                    ExportResult(
                        format=ExportFormat.MUSICXML,
                        path=xml_path,
                        success=True,
                        message="MusicXML exported",
                    )
                )
            except Exception as e:
                results[ExportFormat.MUSICXML.value].append(
                    ExportResult(
                        format=ExportFormat.MUSICXML,
                        path=output_dir / "musicxml" / f"{song_name}.musicxml",
                        success=False,
                        message=f"MusicXML export failed: {e!s}",
                    )
                )

        # JSON export
        if ExportFormat.JSON in formats:
            try:
                json_path = output_dir / "json" / f"{song_name}.json"
                json_path.parent.mkdir(parents=True, exist_ok=True)
                json_path.write_text(song.model_dump_json(indent=2))
                results[ExportFormat.JSON.value].append(
                    ExportResult(
                        format=ExportFormat.JSON,
                        path=json_path,
                        success=True,
                        message="JSON exported",
                    )
                )
            except Exception as e:
                results[ExportFormat.JSON.value].append(
                    ExportResult(
                        format=ExportFormat.JSON,
                        path=output_dir / "json" / f"{song_name}.json",
                        success=False,
                        message=f"JSON export failed: {e!s}",
                    )
                )

        # Text export (lyrics)
        if ExportFormat.TEXT in formats:
            try:
                text_path = output_dir / "lyrics" / f"{song_name}.txt"
                text_path.parent.mkdir(parents=True, exist_ok=True)
                text_path.write_text(song.get_full_lyrics())
                results[ExportFormat.TEXT.value].append(
                    ExportResult(
                        format=ExportFormat.TEXT,
                        path=text_path,
                        success=True,
                        message="Lyrics exported",
                    )
                )
            except Exception as e:
                results[ExportFormat.TEXT.value].append(
                    ExportResult(
                        format=ExportFormat.TEXT,
                        path=output_dir / "lyrics" / f"{song_name}.txt",
                        success=False,
                        message=f"Text export failed: {e!s}",
                    )
                )

        return results

    def export_progression(
        self,
        progression: ChordProgression,
        name: str,
        formats: list[ExportFormat],
        output_dir: Path | None = None,
    ) -> dict[str, ExportResult]:
        """
        Export a chord progression to specified formats.

        Args:
            progression: ChordProgression to export
            name: Name for the export files
            formats: List of formats to export to
            output_dir: Output directory

        Returns:
            Dictionary mapping format names to ExportResults
        """
        output_dir = output_dir or self.output_dir
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        filename = self._sanitize_filename(name)
        results: dict[str, ExportResult] = {}

        if ExportFormat.MIDI in formats:
            try:
                if not self.midi_exporter:
                    raise RuntimeError(
                        "MIDI export not available. Install with: pip install -e '.[music]'"
                    )
                midi_path = output_dir / f"{filename}.mid"
                self.midi_exporter.export_progression(progression, midi_path)
                results[ExportFormat.MIDI.value] = ExportResult(
                    format=ExportFormat.MIDI,
                    path=midi_path,
                    success=True,
                )
            except Exception as e:
                results[ExportFormat.MIDI.value] = ExportResult(
                    format=ExportFormat.MIDI,
                    path=output_dir / f"{filename}.mid",
                    success=False,
                    message=str(e),
                )

        if ExportFormat.MUSICXML in formats:
            try:
                if not self.musicxml_exporter:
                    raise RuntimeError(
                        "MusicXML export not available. Install with: pip install -e '.[music]'"
                    )
                xml_path = output_dir / f"{filename}.musicxml"
                self.musicxml_exporter.export_progression(progression, xml_path)
                results[ExportFormat.MUSICXML.value] = ExportResult(
                    format=ExportFormat.MUSICXML,
                    path=xml_path,
                    success=True,
                )
            except Exception as e:
                results[ExportFormat.MUSICXML.value] = ExportResult(
                    format=ExportFormat.MUSICXML,
                    path=output_dir / f"{filename}.musicxml",
                    success=False,
                    message=str(e),
                )

        if ExportFormat.JSON in formats:
            try:
                json_path = output_dir / f"{filename}.json"
                json_path.write_text(progression.model_dump_json(indent=2))
                results[ExportFormat.JSON.value] = ExportResult(
                    format=ExportFormat.JSON,
                    path=json_path,
                    success=True,
                )
            except Exception as e:
                results[ExportFormat.JSON.value] = ExportResult(
                    format=ExportFormat.JSON,
                    path=output_dir / f"{filename}.json",
                    success=False,
                    message=str(e),
                )

        return results

    @staticmethod
    def _sanitize_filename(name: str) -> str:
        """Sanitize a string for use as a filename."""
        # Replace problematic characters
        invalid_chars = '<>:"/\\|?*'
        for char in invalid_chars:
            name = name.replace(char, "_")
        # Remove leading/trailing whitespace and dots
        name = name.strip().strip(".")
        # Limit length
        return name[:100] if len(name) > 100 else name
