"""Album Bible management endpoints."""

from typing import Any, cast

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
from album_conceptualizer.storage import BibleStore


router = APIRouter()


class ThemeCreate(BaseModel):
    """Request model for creating a theme."""

    name: str = Field(..., min_length=1, max_length=100)
    description: str
    keywords: list[str] = Field(default_factory=list)
    valence: float | None = Field(default=None, ge=-1.0, le=1.0)
    arousal: float | None = Field(default=None, ge=-1.0, le=1.0)
    primary_songs: list[int] = Field(default_factory=list)
    secondary_songs: list[int] = Field(default_factory=list)
    arc_description: str | None = None


class CharacterCreate(BaseModel):
    """Request model for creating a character."""

    name: str = Field(..., min_length=1, max_length=100)
    role: str
    description: str
    traits: list[str] = Field(default_factory=list)
    arc_summary: str | None = None
    associated_key: str | None = None
    associated_motif: str | None = None
    vocal_style_notes: str | None = None
    appears_in: list[int] = Field(default_factory=list)
    perspective_songs: list[int] = Field(default_factory=list)


class MotifCreate(BaseModel):
    """Request model for creating a motif."""

    name: str = Field(..., min_length=1, max_length=100)
    motif_type: str = "lyrical"
    description: str
    chord_pattern: list[str] | None = None
    melodic_contour: str | None = None
    rhythm_pattern: str | None = None
    key_phrases: list[str] = Field(default_factory=list)
    imagery: list[str] = Field(default_factory=list)
    appearances: list[dict[str, Any]] = Field(default_factory=list)
    evolution_notes: str | None = None


class StyleProfileCreate(BaseModel):
    """Request model for creating a style profile."""

    primary_genre: str
    subgenres: list[str] = Field(default_factory=list)
    genre_blend_notes: str | None = None
    era_influence: str | None = None
    reference_artists: list[str] = Field(default_factory=list)
    reference_albums: list[str] = Field(default_factory=list)
    typical_tempo_range: tuple[int, int] | None = None
    typical_keys: list[str] = Field(default_factory=list)
    harmonic_tendencies: str | None = None
    instrumentation_core: list[str] = Field(default_factory=list)
    instrumentation_accents: list[str] = Field(default_factory=list)
    production_notes: str | None = None
    lyrical_tone: str | None = None
    lyrical_devices: list[str] = Field(default_factory=list)
    vocabulary_notes: str | None = None


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
    keywords: list[str]
    valence: float | None
    arousal: float | None
    primary_songs: list[int]
    secondary_songs: list[int]
    arc_description: str | None


class CharacterResponse(BaseModel):
    """Response model for character data."""

    id: str
    name: str
    role: str
    description: str
    traits: list[str]
    arc_summary: str | None
    associated_key: str | None
    associated_motif: str | None
    vocal_style_notes: str | None
    appears_in: list[int]
    perspective_songs: list[int]


class MotifResponse(BaseModel):
    """Response model for motif data."""

    id: str
    name: str
    motif_type: str
    description: str
    key_phrases: list[str]
    imagery: list[str]
    appearances: list[dict[str, Any]]


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

    bible_store = cast("BibleStore", request.app.state.bible_store)
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
                keywords=t.keywords,
                valence=t.valence,
                arousal=t.arousal,
                primary_songs=t.primary_songs,
                secondary_songs=t.secondary_songs,
                arc_description=t.arc_description,
            )
            for t in bible.themes
        ],
        characters=[
            CharacterResponse(
                id=str(c.id),
                name=c.name,
                role=c.role,
                description=c.description,
                traits=c.traits,
                arc_summary=c.arc_summary,
                associated_key=c.associated_key,
                associated_motif=c.associated_motif,
                vocal_style_notes=c.vocal_style_notes,
                appears_in=c.appears_in,
                perspective_songs=c.perspective_songs,
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
                imagery=m.imagery,
                appearances=m.appearances,
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
    *,
    data: BibleCreate,
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
    *,
    data: BibleUpdate,
) -> BibleResponse:
    """Partially update the album bible."""
    bible = _get_or_create_bible(request, album_id)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(bible, field, value)

    _save_bible(request, album_id, bible)
    return _bible_to_response(album_id, bible)


# Theme endpoints
@router.post("/themes", response_model=ThemeResponse, status_code=201)
async def add_theme(
    request: Request,
    album_id: str = Path(...),
    *,
    data: ThemeCreate,
) -> ThemeResponse:
    """Add a theme to the album bible."""
    bible = _get_or_create_bible(request, album_id)

    theme = Theme(
        name=data.name,
        description=data.description,
        keywords=data.keywords,
        valence=data.valence,
        arousal=data.arousal,
        primary_songs=data.primary_songs,
        secondary_songs=data.secondary_songs,
        arc_description=data.arc_description,
    )
    bible.add_theme(theme)

    _save_bible(request, album_id, bible)
    return ThemeResponse(
        id=str(theme.id),
        name=theme.name,
        description=theme.description,
        keywords=theme.keywords,
        valence=theme.valence,
        arousal=theme.arousal,
        primary_songs=theme.primary_songs,
        secondary_songs=theme.secondary_songs,
        arc_description=theme.arc_description,
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
    request: Request,
    album_id: str = Path(...),
    *,
    data: CharacterCreate,
) -> CharacterResponse:
    """Add a character to the album bible."""
    bible = _get_or_create_bible(request, album_id)

    character = Character(
        name=data.name,
        role=data.role,
        description=data.description,
        traits=data.traits,
        arc_summary=data.arc_summary,
        associated_key=data.associated_key,
        associated_motif=data.associated_motif,
        vocal_style_notes=data.vocal_style_notes,
        appears_in=data.appears_in,
        perspective_songs=data.perspective_songs,
    )
    bible.add_character(character)

    _save_bible(request, album_id, bible)
    return CharacterResponse(
        id=str(character.id),
        name=character.name,
        role=character.role,
        description=character.description,
        traits=character.traits,
        arc_summary=character.arc_summary,
        associated_key=character.associated_key,
        associated_motif=character.associated_motif,
        vocal_style_notes=character.vocal_style_notes,
        appears_in=character.appears_in,
        perspective_songs=character.perspective_songs,
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
    request: Request,
    album_id: str = Path(...),
    *,
    data: MotifCreate,
) -> MotifResponse:
    """Add a motif to the album bible."""
    bible = _get_or_create_bible(request, album_id)

    motif = Motif(
        name=data.name,
        motif_type=data.motif_type,
        description=data.description,
        chord_pattern=data.chord_pattern,
        melodic_contour=data.melodic_contour,
        rhythm_pattern=data.rhythm_pattern,
        key_phrases=data.key_phrases,
        imagery=data.imagery,
        appearances=data.appearances,
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
        imagery=motif.imagery,
        appearances=motif.appearances,
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
    request: Request,
    album_id: str = Path(...),
    *,
    data: StyleProfileCreate,
) -> dict[str, Any]:
    """Set the style profile for the album."""
    bible = _get_or_create_bible(request, album_id)

    style = StyleProfile(
        primary_genre=data.primary_genre,
        subgenres=data.subgenres,
        genre_blend_notes=data.genre_blend_notes,
        era_influence=data.era_influence,
        reference_artists=data.reference_artists,
        reference_albums=data.reference_albums,
        typical_tempo_range=data.typical_tempo_range,
        typical_keys=data.typical_keys,
        harmonic_tendencies=data.harmonic_tendencies,
        instrumentation_core=data.instrumentation_core,
        instrumentation_accents=data.instrumentation_accents,
        production_notes=data.production_notes,
        lyrical_tone=data.lyrical_tone,
        lyrical_devices=data.lyrical_devices,
        vocabulary_notes=data.vocabulary_notes,
    )
    bible.style_profile = style
    _save_bible(request, album_id, bible)

    return style.model_dump()
