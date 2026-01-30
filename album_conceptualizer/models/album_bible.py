"""Album Bible - the central reference document for concept album creation."""

from datetime import datetime
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class Theme(BaseModel):
    """A thematic element that runs through the album."""

    id: UUID = Field(default_factory=uuid4)
    name: str
    description: str
    keywords: list[str] = Field(default_factory=list)

    # Emotional associations
    valence: float | None = Field(
        default=None, ge=-1.0, le=1.0, description="Emotional valence (-1 negative to 1 positive)"
    )
    arousal: float | None = Field(
        default=None, ge=-1.0, le=1.0, description="Energy level (-1 calm to 1 intense)"
    )

    # Track appearances
    primary_songs: list[int] = Field(
        default_factory=list, description="Track numbers where theme is primary"
    )
    secondary_songs: list[int] = Field(
        default_factory=list, description="Track numbers where theme appears secondarily"
    )

    # Development
    arc_description: str | None = Field(default=None, description="How theme evolves across album")


class Motif(BaseModel):
    """A recurring musical or lyrical element."""

    id: UUID = Field(default_factory=uuid4)
    name: str
    motif_type: str = Field(description="Type: 'musical', 'lyrical', 'structural'")
    description: str

    # Musical characteristics (for musical motifs)
    chord_pattern: list[str] | None = None
    melodic_contour: str | None = None
    rhythm_pattern: str | None = None

    # Lyrical characteristics (for lyrical motifs)
    key_phrases: list[str] = Field(default_factory=list)
    imagery: list[str] = Field(default_factory=list)

    # Appearances and evolution
    appearances: list[dict] = Field(
        default_factory=list, description="List of {track_number, section, variation_notes}"
    )
    evolution_notes: str | None = Field(
        default=None, description="How motif transforms across album"
    )


class Character(BaseModel):
    """A character or persona in the album narrative."""

    id: UUID = Field(default_factory=uuid4)
    name: str
    role: str = Field(description="Role in narrative (protagonist, antagonist, etc.)")
    description: str

    # Character traits
    traits: list[str] = Field(default_factory=list)
    arc_summary: str | None = Field(default=None, description="Character's journey")

    # Musical associations
    associated_key: str | None = None
    associated_motif: str | None = None
    vocal_style_notes: str | None = None

    # Appearances
    appears_in: list[int] = Field(default_factory=list, description="Track numbers")
    perspective_songs: list[int] = Field(
        default_factory=list, description="Songs from this character's POV"
    )


class NarrativeArc(BaseModel):
    """The overall narrative structure of the album."""

    structure_type: str = Field(
        description="Type: 'three_act', 'heros_journey', 'circular', 'episodic', 'custom'"
    )
    description: str

    # Story beats
    beats: list[dict] = Field(
        default_factory=list, description="List of {name, description, track_numbers}"
    )

    # Timeline
    is_chronological: bool = Field(
        default=True, description="Whether track order matches story chronology"
    )
    timeline_notes: str | None = Field(default=None, description="Notes on non-linear timeline")

    # Key moments
    inciting_incident: int | None = Field(default=None, description="Track number")
    midpoint: int | None = Field(default=None, description="Track number")
    climax: int | None = Field(default=None, description="Track number")
    resolution: int | None = Field(default=None, description="Track number")


class StyleProfile(BaseModel):
    """Musical and lyrical style guidelines."""

    # Genre
    primary_genre: str
    subgenres: list[str] = Field(default_factory=list)
    genre_blend_notes: str | None = None

    # Era/influences
    era_influence: str | None = None
    reference_artists: list[str] = Field(default_factory=list)
    reference_albums: list[str] = Field(default_factory=list)

    # Musical characteristics
    typical_tempo_range: tuple[int, int] | None = None
    typical_keys: list[str] = Field(default_factory=list)
    harmonic_tendencies: str | None = Field(
        default=None, description="E.g., 'modal interchange', 'jazz voicings'"
    )

    # Production style
    instrumentation_core: list[str] = Field(default_factory=list)
    instrumentation_accents: list[str] = Field(default_factory=list)
    production_notes: str | None = None

    # Lyrical style
    lyrical_tone: str | None = Field(default=None, description="E.g., 'poetic', 'conversational'")
    lyrical_devices: list[str] = Field(
        default_factory=list, description="E.g., 'metaphor', 'alliteration'"
    )
    vocabulary_notes: str | None = None


class AlbumBible(BaseModel):
    """
    The Album Bible - central reference document for concept album creation.

    Inspired by Sudowrite's Story Bible, this contains all the key information
    needed to maintain consistency across an entire concept album.
    """

    id: UUID = Field(default_factory=uuid4)
    album_title: str
    artist: str | None = None

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    # Core concept
    logline: str = Field(description="One-sentence summary of the album concept")
    synopsis: str = Field(description="Extended summary of the album's narrative/concept")

    # Thematic elements
    themes: list[Theme] = Field(default_factory=list)
    motifs: list[Motif] = Field(default_factory=list)

    # Characters (if applicable)
    characters: list[Character] = Field(default_factory=list)

    # Narrative structure
    narrative_arc: NarrativeArc | None = None

    # Style guidelines
    style_profile: StyleProfile | None = None

    # World-building (for more elaborate concept albums)
    setting: str | None = Field(default=None, description="Time/place of the story")
    world_rules: list[str] = Field(
        default_factory=list, description="Rules of the album's world/reality"
    )

    # Reference materials
    visual_references: list[str] = Field(default_factory=list)
    audio_references: list[str] = Field(default_factory=list)
    literary_references: list[str] = Field(default_factory=list)

    # Notes
    notes: list[str] = Field(default_factory=list, description="Miscellaneous notes")

    def add_theme(self, theme: Theme) -> None:
        """Add a theme to the bible."""
        self.themes.append(theme)
        self.updated_at = datetime.now()

    def add_motif(self, motif: Motif) -> None:
        """Add a motif to the bible."""
        self.motifs.append(motif)
        self.updated_at = datetime.now()

    def add_character(self, character: Character) -> None:
        """Add a character to the bible."""
        self.characters.append(character)
        self.updated_at = datetime.now()

    def get_theme_by_name(self, name: str) -> Theme | None:
        """Find a theme by name."""
        for theme in self.themes:
            if theme.name.lower() == name.lower():
                return theme
        return None

    def get_character_by_name(self, name: str) -> Character | None:
        """Find a character by name."""
        for char in self.characters:
            if char.name.lower() == name.lower():
                return char
        return None

    def get_motifs_for_track(self, track_number: int) -> list[Motif]:
        """Get all motifs that appear in a specific track."""
        return [
            m
            for m in self.motifs
            if any(app.get("track_number") == track_number for app in m.appearances)
        ]

    def to_summary(self) -> str:
        """Generate a text summary of the Album Bible."""
        lines = [
            f"# Album Bible: {self.album_title}",
            "",
            f"**Logline:** {self.logline}",
            "",
            "## Synopsis",
            self.synopsis,
            "",
        ]

        if self.themes:
            lines.extend(["## Themes", ""])
            for theme in self.themes:
                lines.append(f"- **{theme.name}**: {theme.description}")
            lines.append("")

        if self.characters:
            lines.extend(["## Characters", ""])
            for char in self.characters:
                lines.append(f"- **{char.name}** ({char.role}): {char.description}")
            lines.append("")

        if self.motifs:
            lines.extend(["## Recurring Motifs", ""])
            for motif in self.motifs:
                lines.append(f"- **{motif.name}** [{motif.motif_type}]: {motif.description}")
            lines.append("")

        if self.style_profile:
            lines.extend(
                [
                    "## Style Profile",
                    f"- **Genre:** {self.style_profile.primary_genre}",
                ]
            )
            if self.style_profile.reference_artists:
                lines.append(f"- **Influences:** {', '.join(self.style_profile.reference_artists)}")
            lines.append("")

        return "\n".join(lines)
