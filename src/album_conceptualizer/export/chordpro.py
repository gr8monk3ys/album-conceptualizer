"""ChordPro export functionality."""

from pathlib import Path
from typing import Optional

from album_conceptualizer.models.album import Song, Section, SectionType


def format_chordpro(
    title: str,
    lyrics: str,
    chords: Optional[list[str]] = None,
    key: Optional[str] = None,
    tempo: Optional[int] = None,
    artist: Optional[str] = None,
    capo: Optional[int] = None,
) -> str:
    """
    Format a song in ChordPro format.

    ChordPro is a simple text format for songs with chord annotations.
    It's widely supported by apps like OnSong, SongBook, and many others.

    Args:
        title: Song title
        lyrics: Lyrics text (can include [Chord] annotations)
        chords: Optional list of chords to add to metadata
        key: Key of the song
        tempo: Tempo in BPM
        artist: Artist name
        capo: Capo position

    Returns:
        ChordPro formatted string
    """
    lines = []

    # Metadata directives
    lines.append(f"{{title: {title}}}")
    if artist:
        lines.append(f"{{artist: {artist}}}")
    if key:
        lines.append(f"{{key: {key}}}")
    if tempo:
        lines.append(f"{{tempo: {tempo}}}")
    if capo:
        lines.append(f"{{capo: {capo}}}")

    lines.append("")  # Blank line after metadata

    # Add lyrics (assuming they already have [Chord] annotations if needed)
    lines.append(lyrics)

    return "\n".join(lines)


def inline_chords_to_lyrics(lyrics: str, chords: list[str], positions: list[int]) -> str:
    """
    Insert chords into lyrics at specified positions.

    Args:
        lyrics: The lyrics line
        chords: List of chord symbols
        positions: Character positions where chords should appear

    Returns:
        Lyrics with inline [Chord] annotations
    """
    if not chords or not positions:
        return lyrics

    # Sort by position in reverse to not affect earlier positions
    sorted_pairs = sorted(zip(positions, chords), reverse=True)

    result = lyrics
    for pos, chord in sorted_pairs:
        pos = min(pos, len(result))
        result = result[:pos] + f"[{chord}]" + result[pos:]

    return result


class ChordProExporter:
    """
    Export songs to ChordPro format.

    ChordPro is the standard format for live performance apps like
    OnSong, SongBook, and many church/worship software packages.
    It's a simple text format that's easy to read and edit.
    """

    def __init__(self, default_artist: Optional[str] = None):
        """
        Initialize the ChordPro exporter.

        Args:
            default_artist: Default artist name for exports
        """
        self.default_artist = default_artist

    def export_song(
        self,
        song: Song,
        output_path: Path,
        album_title: Optional[str] = None,
    ) -> Path:
        """
        Export a song to ChordPro format.

        Args:
            song: Song to export
            output_path: Output file path
            album_title: Optional album title for metadata

        Returns:
            Path to created file
        """
        lines = []

        # Metadata
        lines.append(f"{{title: {song.title}}}")
        if self.default_artist:
            lines.append(f"{{artist: {self.default_artist}}}")
        if album_title:
            lines.append(f"{{album: {album_title}}}")
        if song.key:
            lines.append(f"{{key: {song.key}}}")
        if song.tempo:
            lines.append(f"{{tempo: {song.tempo}}}")
        if song.time_signature:
            lines.append(f"{{time: {song.time_signature}}}")

        lines.append("")

        # Sections
        for section in song.sections:
            lines.append(self._format_section(section))
            lines.append("")

        content = "\n".join(lines)

        output_path = Path(output_path)
        output_path.write_text(content)
        return output_path

    def _format_section(self, section: Section) -> str:
        """Format a single section in ChordPro format."""
        lines = []

        # Section header
        section_names = {
            SectionType.INTRO: "Intro",
            SectionType.VERSE: "Verse",
            SectionType.PRE_CHORUS: "Pre-Chorus",
            SectionType.CHORUS: "Chorus",
            SectionType.POST_CHORUS: "Post-Chorus",
            SectionType.BRIDGE: "Bridge",
            SectionType.BREAKDOWN: "Breakdown",
            SectionType.SOLO: "Solo",
            SectionType.INTERLUDE: "Interlude",
            SectionType.OUTRO: "Outro",
            SectionType.TAG: "Tag",
        }

        section_name = section_names.get(section.section_type, "Section")
        lines.append(f"{{comment: {section_name}}}")

        # Add chord line if we have chords but no lyrics
        if section.chord_progression and not section.lyrics:
            chord_line = " ".join([f"[{c}]" for c in section.chord_progression])
            lines.append(chord_line)
        elif section.lyrics:
            # Try to intelligently place chords with lyrics
            lyrics_lines = section.lyrics.split("\n")

            if section.chord_progression:
                # Distribute chords across lyrics lines
                chords_per_line = max(1, len(section.chord_progression) // max(1, len(lyrics_lines)))
                chord_idx = 0

                for lyric_line in lyrics_lines:
                    if lyric_line.strip() and chord_idx < len(section.chord_progression):
                        # Add chord at the start of the line
                        chord = section.chord_progression[chord_idx]
                        lines.append(f"[{chord}]{lyric_line}")
                        chord_idx += chords_per_line
                    else:
                        lines.append(lyric_line)
            else:
                lines.extend(lyrics_lines)

        return "\n".join(lines)

    def export_section(
        self,
        section: Section,
        song_title: str,
        output_path: Path,
    ) -> Path:
        """
        Export a single section to ChordPro format.

        Args:
            section: Section to export
            song_title: Title of the parent song
            output_path: Output file path

        Returns:
            Path to created file
        """
        section_name = f"{section.section_type} {section.order}"

        lines = [
            f"{{title: {song_title} - {section_name}}}",
            "",
            self._format_section(section),
        ]

        content = "\n".join(lines)

        output_path = Path(output_path)
        output_path.write_text(content)
        return output_path

    def format_simple(
        self,
        title: str,
        sections: list[tuple[str, str, list[str]]],
        key: Optional[str] = None,
    ) -> str:
        """
        Create a simple ChordPro formatted string.

        Args:
            title: Song title
            sections: List of (section_name, lyrics, chords) tuples
            key: Optional key

        Returns:
            ChordPro formatted string
        """
        lines = [f"{{title: {title}}}"]
        if key:
            lines.append(f"{{key: {key}}}")
        lines.append("")

        for section_name, lyrics, chords in sections:
            lines.append(f"{{comment: {section_name}}}")

            if not lyrics and chords:
                # Chord-only section (like intro)
                lines.append(" ".join([f"[{c}]" for c in chords]))
            elif lyrics:
                lyrics_lines = lyrics.split("\n")
                chord_idx = 0
                for line in lyrics_lines:
                    if line.strip() and chord_idx < len(chords):
                        lines.append(f"[{chords[chord_idx]}]{line}")
                        chord_idx += 1
                    else:
                        lines.append(line)
            lines.append("")

        return "\n".join(lines)


def parse_chordpro(content: str) -> dict:
    """
    Parse a ChordPro formatted string.

    Args:
        content: ChordPro formatted text

    Returns:
        Dictionary with metadata and sections
    """
    result = {
        "title": "",
        "artist": "",
        "key": "",
        "tempo": None,
        "sections": [],
    }

    current_section = {"name": "", "content": []}

    for line in content.split("\n"):
        line = line.strip()

        # Parse directives
        if line.startswith("{") and line.endswith("}"):
            directive = line[1:-1]
            if ":" in directive:
                key, value = directive.split(":", 1)
                key = key.strip().lower()
                value = value.strip()

                if key == "title":
                    result["title"] = value
                elif key == "artist":
                    result["artist"] = value
                elif key == "key":
                    result["key"] = value
                elif key == "tempo":
                    try:
                        result["tempo"] = int(value)
                    except ValueError:
                        pass
                elif key == "comment" or key == "c":
                    # Start new section
                    if current_section["content"]:
                        result["sections"].append(current_section)
                    current_section = {"name": value, "content": []}
        elif line:
            current_section["content"].append(line)

    # Add final section
    if current_section["content"]:
        result["sections"].append(current_section)

    return result
