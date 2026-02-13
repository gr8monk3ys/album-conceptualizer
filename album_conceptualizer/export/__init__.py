"""Export formats for Album Conceptualizer."""

from typing import Any

# ChordPro is pure Python, always available
from album_conceptualizer.export.chordpro import ChordProExporter, format_chordpro


__all__ = [
    "ChordProExporter",
    "format_chordpro",
]

MidiExporter: Any = None
create_chord_midi: Any = None
MusicXMLExporter: Any = None
ExportFormat: Any = None
ExportResult: Any = None
AlbumExporter: Any = None

# Optional: MIDI export (requires pretty_midi)
try:
    from album_conceptualizer.export.midi import MidiExporter, create_chord_midi

    __all__.extend(["MidiExporter", "create_chord_midi"])
except ImportError:
    pass

# Optional: MusicXML export (requires music21)
try:
    from album_conceptualizer.export.musicxml import MusicXMLExporter

    __all__.append("MusicXMLExporter")
except ImportError:
    pass

# Optional: Full export formats (requires multiple deps)
try:
    from album_conceptualizer.export.formats import (
        AlbumExporter,
        ExportFormat,
        ExportResult,
    )

    __all__.extend(["AlbumExporter", "ExportFormat", "ExportResult"])
except ImportError:
    pass
