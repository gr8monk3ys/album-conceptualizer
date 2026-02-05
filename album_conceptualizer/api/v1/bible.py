"""Album Bible management endpoints."""

from fastapi import APIRouter, HTTPException, Path, Request
from pydantic import BaseModel, Field

from album_conceptualizer.api.v1.albums import get_album_store
from album_conceptualizer.models.album_bible import (
    AlbumBible,
    Character,
    Motif,
    StyleProfile,
    Theme,
)


router = APIRouter()


class ThemeCreate(BaseModel):
    """Request model for creating a theme."""

    name: str = Field(..., min_length=1, max_length=100)
    description: str
    importance: str = "primary"
    primary_songs: list[int] = Field(default_factory=list)
    related_motifs: list[str] = Field(default_factory=list)


class CharacterCreate(BaseModel):
    """Request model for creating a character."""

    name: str = Field(..., min_length=1, max_length=100)
    role: str
    description: str
    arc_summary: str | None = None
    appears_in_songs: list[int] = Field(default_factory=list)
    relationships: dict[str, str] = Field(default_factory=dict)


class MotifCreate(BaseModel):
    """Request model for creating a motif."""

    name: str = Field(..., min_length=1, max_length=100)
    motif_type: str = "lyrical"
    description: str
    key_phrases: list[str] = Field(default_factory=list)
    musical_elements: list[str] = Field(default_factory=list)
    appears_in_songs: list[int] = Field(default_factory=list)
    evolution_notes: str | None = None


class StyleProfileCreate(BaseModel):
    """Request model for creating a style profile."""

    primary_genre: str
    subgenres: list[str] = Field(default_factory=list)
    era_influences: list[str] = Field(default_factory=list)
    reference_artists: list[str] = Field(default_factory=list)
    reference_albums: list[str] = Field(default_factory=list)
    sonic_palette: list[str] = Field(default_factory=list)
    production_notes: str | None = None
    lyrical_style: str | None = None
    vocal_approach: str | None = None


class BibleCreate(BaseModel):
    """Request model for creating an album bible."""

    logline: str = Field(..., min_length=10, max_length=500)
    synopsis: str
    setting: str | None = None


class BibleUpdate(BaseModel):
    """Request model for updating an album bible."""

    logline: str | None = Field(default=None, min_length=10, max_length=500)
    synopsis: str | None = None
    setting: str | None = None


class ThemeResponse(BaseModel):
    """Response model for theme data."""

    id: str
    name: str
    description: str
    importance: str
    primary_songs: list[int]


class CharacterResponse(BaseModel):
    """Response model for character data."""

    id: str
    name: str
    role: str
    description: str
    arc_summary: str | None
    appears_in_songs: list[int]


class MotifResponse(BaseModel):
    """Response model for motif data."""

    id: str
    name: str
    motif_type: str
    description: str
    key_phrases: list[str]
    appears_in_songs: list[int]


class BibleResponse(BaseModel):
    """Response model for album bible data."""

    album_id: str
    album_title: str
    logline: str
    synopsis: str
    setting: str | None
    themes: list[ThemeResponse]
    characters: list[CharacterResponse]
    motifs: list[MotifResponse]
    summary: str


def _get_or_create_bible(request: Request, album_id: str) -> AlbumBible:
    """Get existing bible or create new one."""
    store = get_album_store(request)
    album = store.get(album_id)
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")

    bible_store = request.app.state.bible_store
    existing = bible_store.get(album_id)
    if existing:
        return existing

    bible = AlbumBible(
        album_title=album.title,
        logline="",
        synopsis="",
    )
    bible_store.save(album_id, bible)
    return bible


def _save_bible(request: Request, album_id: str, bible: AlbumBible) -> None:
    request.app.state.bible_store.save(album_id, bible)

def _bible_to_response(album_id: str, bible: AlbumBible) -> BibleResponse:
    """Convert AlbumBible to response."""
    return BibleResponse(
        album_id=album_id,
        album_title=bible.album_title,
        logline=bible.logline,
        synopsis=bible.synopsis,
        setting=bible.setting,
        themes=[
            ThemeResponse(
                id=str(t.id),
                name=t.name,
                description=t.description,
                importance=t.importance,
                primary_songs=t.primary_songs,
            )
            for t in bible.themes
        ],
        characters=[
            CharacterResponse(
                id=str(c.id),
                name=c.name,
                role=c.role,
                description=c.description,
                arc_summary=c.arc_summary,
                appears_in_songs=c.appears_in_songs,
            )
            for c in bible.characters
        ],
        motifs=[
            MotifResponse(
                id=str(m.id),
                name=m.name,
                motif_type=m.motif_type,
                description=m.description,
                key_phrases=m.key_phrases,
                appears_in_songs=m.appears_in_songs,
            )
            for m in bible.motifs
        ],
        summary=bible.to_summary(),
    )


@router.get("", response_model=BibleResponse)
async def get_bible(request: Request, album_id: str = Path(...)) -> BibleResponse:
    """
    Get the album bible for an album.

    Creates an empty bible if one doesn't exist.
    """
    bible = _get_or_create_bible(request, album_id)
    return _bible_to_response(album_id, bible)


@router.put("", response_model=BibleResponse)
async def update_bible(
    request: Request,
    album_id: str = Path(...),
    data: BibleCreate = ...,
) -> BibleResponse:
    """
    Create or update the album bible core content.

    This sets the logline, synopsis, and setting.
    """
    store = get_album_store(request)
    album = store.get(album_id)
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")

    bible = _get_or_create_bible(request, album_id)
    bible.logline = data.logline
    bible.synopsis = data.synopsis
    bible.setting = data.setting
    _save_bible(request, album_id, bible)

    return _bible_to_response(album_id, bible)


@router.patch("", response_model=BibleResponse)
async def patch_bible(
    request: Request,
    album_id: str = Path(...),
    data: BibleUpdate = ...,
) -> BibleResponse:
    """Partially update the album bible."""
    bible = _get_or_create_bible(request, album_id)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(bible, field, value)

    _save_bible(request, album_id, bible)
    return _bible_to_response(album_id, bible)


# Theme endpoints
@router.post("/themes", response_model=ThemeResponse, status_code=201)
async def add_theme(
    request: Request, album_id: str = Path(...), data: ThemeCreate = ...
) -> ThemeResponse:
    """Add a theme to the album bible."""
    bible = _get_or_create_bible(request, album_id)

    theme = Theme(
        name=data.name,
        description=data.description,
        importance=data.importance,
        primary_songs=data.primary_songs,
        related_motifs=data.related_motifs,
    )
    bible.add_theme(theme)

    _save_bible(request, album_id, bible)
    return ThemeResponse(
        id=str(theme.id),
        name=theme.name,
        description=theme.description,
        importance=theme.importance,
        primary_songs=theme.primary_songs,
    )


@router.delete("/themes/{theme_id}", status_code=204)
async def remove_theme(
    request: Request, album_id: str = Path(...), theme_id: str = Path(...)
) -> None:
    """Remove a theme from the album bible."""
    bible = _get_or_create_bible(request, album_id)

    for i, theme in enumerate(bible.themes):
        if str(theme.id) == theme_id:
            bible.themes.pop(i)
            _save_bible(request, album_id, bible)
            return

    raise HTTPException(status_code=404, detail="Theme not found")


# Character endpoints
@router.post("/characters", response_model=CharacterResponse, status_code=201)
async def add_character(
    request: Request, album_id: str = Path(...), data: CharacterCreate = ...
) -> CharacterResponse:
    """Add a character to the album bible."""
    bible = _get_or_create_bible(request, album_id)

    character = Character(
        name=data.name,
        role=data.role,
        description=data.description,
        arc_summary=data.arc_summary,
        appears_in_songs=data.appears_in_songs,
        relationships=data.relationships,
    )
    bible.add_character(character)

    _save_bible(request, album_id, bible)
    return CharacterResponse(
        id=str(character.id),
        name=character.name,
        role=character.role,
        description=character.description,
        arc_summary=character.arc_summary,
        appears_in_songs=character.appears_in_songs,
    )


@router.delete("/characters/{character_id}", status_code=204)
async def remove_character(
    request: Request, album_id: str = Path(...), character_id: str = Path(...)
) -> None:
    """Remove a character from the album bible."""
    bible = _get_or_create_bible(request, album_id)

    for i, char in enumerate(bible.characters):
        if str(char.id) == character_id:
            bible.characters.pop(i)
            _save_bible(request, album_id, bible)
            return

    raise HTTPException(status_code=404, detail="Character not found")


# Motif endpoints
@router.post("/motifs", response_model=MotifResponse, status_code=201)
async def add_motif(
    request: Request, album_id: str = Path(...), data: MotifCreate = ...
) -> MotifResponse:
    """Add a motif to the album bible."""
    bible = _get_or_create_bible(request, album_id)

    motif = Motif(
        name=data.name,
        motif_type=data.motif_type,
        description=data.description,
        key_phrases=data.key_phrases,
        musical_elements=data.musical_elements,
        appears_in_songs=data.appears_in_songs,
        evolution_notes=data.evolution_notes,
    )
    bible.add_motif(motif)

    _save_bible(request, album_id, bible)
    return MotifResponse(
        id=str(motif.id),
        name=motif.name,
        motif_type=motif.motif_type,
        description=motif.description,
        key_phrases=motif.key_phrases,
        appears_in_songs=motif.appears_in_songs,
    )


@router.delete("/motifs/{motif_id}", status_code=204)
async def remove_motif(
    request: Request, album_id: str = Path(...), motif_id: str = Path(...)
) -> None:
    """Remove a motif from the album bible."""
    bible = _get_or_create_bible(request, album_id)

    for i, motif in enumerate(bible.motifs):
        if str(motif.id) == motif_id:
            bible.motifs.pop(i)
            _save_bible(request, album_id, bible)
            return

    raise HTTPException(status_code=404, detail="Motif not found")


# Style profile endpoint
@router.put("/style", response_model=dict)
async def set_style_profile(
    request: Request, album_id: str = Path(...), data: StyleProfileCreate = ...
) -> dict:
    """Set the style profile for the album."""
    bible = _get_or_create_bible(request, album_id)

    style = StyleProfile(
        primary_genre=data.primary_genre,
        subgenres=data.subgenres,
        era_influences=data.era_influences,
        reference_artists=data.reference_artists,
        reference_albums=data.reference_albums,
        sonic_palette=data.sonic_palette,
        production_notes=data.production_notes,
        lyrical_style=data.lyrical_style,
        vocal_approach=data.vocal_approach,
    )
    bible.style_profile = style
    _save_bible(request, album_id, bible)

    return style.model_dump()
