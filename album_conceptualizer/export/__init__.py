"""Export formats for Album Conceptualizer."""

# ChordPro is pure Python, always available
from album_conceptualizer.export.chordpro import ChordProExporter, format_chordpro


__all__ = [
    "ChordProExporter",
    "format_chordpro",
]

# Optional: MIDI export (requires pretty_midi)
try:
    from album_conceptualizer.export.midi import MidiExporter, create_chord_midi

    __all__.extend(["MidiExporter", "create_chord_midi"])
except ImportError:
    MidiExporter = None
    create_chord_midi = None

# Optional: MusicXML export (requires music21)
try:
    from album_conceptualizer.export.musicxml import MusicXMLExporter

    __all__.append("MusicXMLExporter")
except ImportError:
    MusicXMLExporter = None

# Optional: Full export formats (requires multiple deps)
try:
    from album_conceptualizer.export.formats import (
        AlbumExporter,
        ExportFormat,
        ExportResult,
    )

    __all__.extend(["AlbumExporter", "ExportFormat", "ExportResult"])
except ImportError:
    ExportFormat = None
    ExportResult = None
    AlbumExporter = None
