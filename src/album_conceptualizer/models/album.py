"""Album and song data models."""

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class SectionType(str, Enum):
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


class Section(BaseModel):
    """A section within a song (verse, chorus, etc.)."""

    id: UUID = Field(default_factory=uuid4)
    section_type: SectionType
    order: int = Field(ge=0, description="Position in the song")
    lyrics: Optional[str] = None
    chord_progression: Optional[list[str]] = None
    notes: Optional[str] = None

    # Narrative elements
    narrative_function: Optional[str] = Field(
        default=None, description="Role in the story (e.g., 'introduces conflict')"
    )
    emotional_arc: Optional[str] = Field(
        default=None, description="Emotional trajectory (e.g., 'hopeful -> uncertain')"
    )

    # Music theory
    key: Optional[str] = None
    tempo_modifier: Optional[str] = Field(
        default=None, description="Relative tempo (e.g., 'slightly faster')"
    )
    dynamics: Optional[str] = Field(default=None, description="Dynamic marking (e.g., 'building')")

    class Config:
        use_enum_values = True


class Song(BaseModel):
    """A song within the concept album."""

    id: UUID = Field(default_factory=uuid4)
    title: str
    track_number: int = Field(ge=1)
    sections: list[Section] = Field(default_factory=list)

    # Metadata
    duration_estimate: Optional[str] = None  # e.g., "4:30"
    key: Optional[str] = None
    tempo: Optional[int] = Field(default=None, gt=0)
    time_signature: Optional[str] = None

    # Narrative elements
    narrative_position: Optional[str] = Field(
        default=None, description="Position in album narrative (e.g., 'inciting incident')"
    )
    narrative_summary: Optional[str] = Field(
        default=None, description="Brief summary of what happens in this song"
    )
    chronological_order: Optional[int] = Field(
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
    production_notes: Optional[str] = None
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
    artist: Optional[str] = None
    songs: list[Song] = Field(default_factory=list)

    # Metadata
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    # Album-level narrative
    concept_summary: Optional[str] = Field(
        default=None, description="Overall concept/story of the album"
    )
    narrative_structure: Optional[str] = Field(
        default=None, description="Structure type (e.g., 'hero's journey', 'three-act')"
    )

    # Album-level style
    primary_genre: Optional[str] = None
    subgenres: list[str] = Field(default_factory=list)
    era_influence: Optional[str] = Field(
        default=None, description="Time period influence (e.g., '1970s prog rock')"
    )

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

    def get_song_by_title(self, title: str) -> Optional[Song]:
        """Find a song by title."""
        for song in self.songs:
            if song.title.lower() == title.lower():
                return song
        return None

    def get_song_by_track_number(self, track_number: int) -> Optional[Song]:
        """Find a song by track number."""
        for song in self.songs:
            if song.track_number == track_number:
                return song
        return None

    def get_chronological_order(self) -> list[Song]:
        """Get songs in narrative chronological order."""
        songs_with_order = [s for s in self.songs if s.chronological_order is not None]
        songs_without_order = [s for s in self.songs if s.chronological_order is None]
        sorted_songs = sorted(songs_with_order, key=lambda s: s.chronological_order)
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
