"""Album and song data models."""

from datetime import datetime
from enum import StrEnum
from typing import cast
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field


class SectionType(StrEnum):
    """Types of song sections."""

    INTRO = "intro"
    VERSE = "verse"
    PRE_CHORUS = "pre_chorus"
    CHORUS = "chorus"
    POST_CHORUS = "post_chorus"
    BRIDGE = "bridge"
    BREAKDOWN = "breakdown"
    SOLO = "solo"
    INTERLUDE = "interlude"
    OUTRO = "outro"
    TAG = "tag"
    OTHER = "other"


class Section(BaseModel):
    """A section within a song (verse, chorus, etc.)."""

    id: UUID = Field(default_factory=uuid4)
    section_type: SectionType
    order: int = Field(ge=0, description="Position in the song")
    lyrics: str | None = None
    chord_progression: list[str] = Field(default_factory=list)
    notes: str | None = None
    duration_bars: int | None = Field(default=None, ge=1, description="Length in bars")

    # Narrative elements
    narrative_function: str | None = Field(
        default=None, description="Role in the story (e.g., 'introduces conflict')"
    )
    emotional_arc: str | None = Field(
        default=None, description="Emotional trajectory (e.g., 'hopeful -> uncertain')"
    )

    # Music theory
    key: str | None = None
    tempo_modifier: str | None = Field(
        default=None, description="Relative tempo (e.g., 'slightly faster')"
    )
    dynamics: str | None = Field(default=None, description="Dynamic marking (e.g., 'building')")

    model_config = ConfigDict(use_enum_values=True)


class Song(BaseModel):
    """A song within the concept album."""

    id: UUID = Field(default_factory=uuid4)
    title: str
    track_number: int = Field(ge=1)
    sections: list[Section] = Field(default_factory=list)

    # Metadata
    duration_estimate: str | None = None  # e.g., "4:30"
    duration_seconds: int | None = Field(default=None, ge=1, description="Duration in seconds")
    key: str | None = None
    tempo: int | None = Field(default=None, gt=0)
    time_signature: str | None = "4/4"

    # Narrative elements
    narrative_position: str | None = Field(
        default=None, description="Position in album narrative (e.g., 'inciting incident')"
    )
    narrative_summary: str | None = Field(
        default=None, description="Brief summary of what happens in this song"
    )
    chronological_order: int | None = Field(
        default=None, description="Order in story timeline (may differ from track_number)"
    )

    # Thematic connections
    themes: list[str] = Field(default_factory=list)
    motifs: list[str] = Field(default_factory=list, description="Recurring musical/lyrical motifs")
    characters: list[str] = Field(default_factory=list)

    # Style
    genre_tags: list[str] = Field(default_factory=list)
    mood_tags: list[str] = Field(default_factory=list)
    reference_tracks: list[str] = Field(
        default_factory=list, description="Reference songs for style"
    )

    # Production notes
    production_notes: str | None = None
    instrumentation: list[str] = Field(default_factory=list)

    def add_section(self, section: Section) -> None:
        """Add a section to the song."""
        self.sections.append(section)
        self.sections.sort(key=lambda s: s.order)

    def get_full_lyrics(self) -> str:
        """Get concatenated lyrics from all sections."""
        lyrics_parts = []
        for section in self.sections:
            if section.lyrics:
                lyrics_parts.append(f"[{section.section_type.upper()}]\n{section.lyrics}")
        return "\n\n".join(lyrics_parts)


class Album(BaseModel):
    """A concept album with narrative coherence."""

    id: UUID = Field(default_factory=uuid4)
    title: str
    artist: str | None = None
    songs: list[Song] = Field(default_factory=list)

    # Metadata
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    # Album-level narrative
    concept_summary: str | None = Field(
        default=None, description="Overall concept/story of the album"
    )
    narrative_structure: str | None = Field(
        default=None, description="Structure type (e.g., 'hero's journey', 'three-act')"
    )

    # Album-level style
    primary_genre: str | None = None
    secondary_genres: list[str] = Field(default_factory=list)
    era_influence: str | None = Field(
        default=None, description="Time period influence (e.g., '1970s prog rock')"
    )
    release_year: int | None = Field(default=None, ge=1900, le=2100)

    # Thematic elements (album-wide)
    central_themes: list[str] = Field(default_factory=list)
    recurring_motifs: list[str] = Field(default_factory=list)

    # Reference materials
    reference_albums: list[str] = Field(default_factory=list)
    visual_inspiration: list[str] = Field(default_factory=list)

    def add_song(self, song: Song) -> None:
        """Add a song to the album."""
        self.songs.append(song)
        self.songs.sort(key=lambda s: s.track_number)
        self.updated_at = datetime.now()

    def get_song_by_title(self, title: str) -> Song | None:
        """Find a song by title."""
        for song in self.songs:
            if song.title.lower() == title.lower():
                return song
        return None

    def get_song_by_track_number(self, track_number: int) -> Song | None:
        """Find a song by track number."""
        for song in self.songs:
            if song.track_number == track_number:
                return song
        return None

    def get_chronological_order(self) -> list[Song]:
        """Get songs in narrative chronological order."""
        songs_with_order = [s for s in self.songs if s.chronological_order is not None]
        songs_without_order = [s for s in self.songs if s.chronological_order is None]
        sorted_songs = sorted(songs_with_order, key=lambda s: cast("int", s.chronological_order))
        return sorted_songs + songs_without_order

    def get_theme_connections(self, theme: str) -> list[Song]:
        """Get all songs that share a theme."""
        return [s for s in self.songs if theme.lower() in [t.lower() for t in s.themes]]

    def get_motif_usage(self, motif: str) -> list[tuple[Song, list[Section]]]:
        """Track where a motif appears across the album."""
        results = []
        for song in self.songs:
            if motif.lower() in [m.lower() for m in song.motifs]:
                results.append((song, song.sections))
        return results

    def to_tracklist(self) -> str:
        """Generate a formatted tracklist."""
        lines = [f"{self.title}", "=" * len(self.title), ""]
        if self.artist:
            lines.insert(1, f"by {self.artist}")
        for song in self.songs:
            duration = f" ({song.duration_estimate})" if song.duration_estimate else ""
            lines.append(f"{song.track_number:02d}. {song.title}{duration}")
        return "\n".join(lines)
