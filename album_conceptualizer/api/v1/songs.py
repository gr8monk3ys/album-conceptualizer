"""Song management endpoints."""

from fastapi import APIRouter, HTTPException, Path, Request
from pydantic import BaseModel, Field

from album_conceptualizer.api.v1.albums import get_album_store
from album_conceptualizer.models.album import Section, SectionType, Song


router = APIRouter()


class SectionCreate(BaseModel):
    """Request model for creating a section."""

    section_type: str = Field(..., description="Type: verse, chorus, bridge, etc.")
    order: int = Field(..., ge=1)
    lyrics: str | None = None
    chord_progression: list[str] = Field(default_factory=list)
    duration_bars: int | None = Field(default=None, ge=1)
    narrative_function: str | None = None
    emotional_arc: str | None = None


class SongCreate(BaseModel):
    """Request model for creating a song."""

    title: str = Field(..., min_length=1, max_length=200)
    track_number: int = Field(..., ge=1)
    key: str | None = None
    tempo: int | None = Field(default=None, ge=20, le=300)
    time_signature: str = "4/4"
    duration_seconds: int | None = Field(default=None, ge=1)
    narrative_position: str | None = None
    narrative_summary: str | None = None
    themes: list[str] = Field(default_factory=list)
    mood_tags: list[str] = Field(default_factory=list)
    sections: list[SectionCreate] = Field(default_factory=list)


class SongUpdate(BaseModel):
    """Request model for updating a song."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    track_number: int | None = Field(default=None, ge=1)
    key: str | None = None
    tempo: int | None = Field(default=None, ge=20, le=300)
    time_signature: str | None = None
    duration_seconds: int | None = Field(default=None, ge=1)
    narrative_position: str | None = None
    narrative_summary: str | None = None
    themes: list[str] | None = None
    mood_tags: list[str] | None = None


class SectionResponse(BaseModel):
    """Response model for section data."""

    id: str
    section_type: str
    order: int
    lyrics: str | None
    chord_progression: list[str]
    duration_bars: int | None


class SongResponse(BaseModel):
    """Response model for song data."""

    id: str
    title: str
    track_number: int
    key: str | None
    tempo: int | None
    time_signature: str
    duration_seconds: int | None
    narrative_position: str | None
    narrative_summary: str | None
    themes: list[str]
    mood_tags: list[str]
    sections: list[SectionResponse]
    full_lyrics: str


class SongListResponse(BaseModel):
    """Response model for song list."""

    items: list[SongResponse]
    total: int


def _section_to_response(section: Section) -> SectionResponse:
    """Convert Section model to response."""
    # Handle both enum and string values (due to use_enum_values config)
    section_type = (
        section.section_type.value
        if hasattr(section.section_type, "value")
        else section.section_type
    )
    return SectionResponse(
        id=str(section.id),
        section_type=section_type,
        order=section.order,
        lyrics=section.lyrics,
        chord_progression=section.chord_progression or [],
        duration_bars=section.duration_bars,
    )


def _song_to_response(song: Song) -> SongResponse:
    """Convert Song model to response."""
    return SongResponse(
        id=str(song.id),
        title=song.title,
        track_number=song.track_number,
        key=song.key,
        tempo=song.tempo,
        time_signature=song.time_signature,
        duration_seconds=song.duration_seconds,
        narrative_position=song.narrative_position,
        narrative_summary=song.narrative_summary,
        themes=song.themes,
        mood_tags=song.mood_tags,
        sections=[_section_to_response(s) for s in song.sections],
        full_lyrics=song.get_full_lyrics(),
    )


def _get_album(request: Request, album_id: str):
    """Get album or raise 404."""
    store = get_album_store(request)
    album = store.get(album_id)
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    return album


@router.get("", response_model=SongListResponse)
async def list_songs(request: Request, album_id: str = Path(...)) -> SongListResponse:
    """
    List all songs in an album.

    Songs are returned in track order.
    """
    album = _get_album(request, album_id)
    songs = sorted(album.songs, key=lambda s: s.track_number)

    return SongListResponse(
        items=[_song_to_response(s) for s in songs],
        total=len(songs),
    )


@router.post("", response_model=SongResponse, status_code=201)
async def create_song(
    request: Request, album_id: str = Path(...), data: SongCreate = ...
) -> SongResponse:
    """
    Add a new song to an album.

    The song will be added with the specified track number.
    """
    album = _get_album(request, album_id)

    # Create song
    song = Song(
        title=data.title,
        track_number=data.track_number,
        key=data.key,
        tempo=data.tempo,
        time_signature=data.time_signature,
        duration_seconds=data.duration_seconds,
        narrative_position=data.narrative_position,
        narrative_summary=data.narrative_summary,
        themes=data.themes,
        mood_tags=data.mood_tags,
    )

    # Add sections
    for section_data in data.sections:
        try:
            section_type = SectionType(section_data.section_type)
        except ValueError:
            section_type = SectionType.OTHER

        section = Section(
            section_type=section_type,
            order=section_data.order,
            lyrics=section_data.lyrics,
            chord_progression=section_data.chord_progression,
            duration_bars=section_data.duration_bars,
            narrative_function=section_data.narrative_function,
            emotional_arc=section_data.emotional_arc,
        )
        song.add_section(section)

    album.add_song(song)
    get_album_store(request).save(album)
    return _song_to_response(song)


@router.get("/{song_id}", response_model=SongResponse)
async def get_song(
    request: Request, album_id: str = Path(...), song_id: str = Path(...)
) -> SongResponse:
    """
    Get a specific song by ID.

    Raises 404 if song not found in the album.
    """
    album = _get_album(request, album_id)

    for song in album.songs:
        if str(song.id) == song_id:
            return _song_to_response(song)

    raise HTTPException(status_code=404, detail="Song not found")


@router.patch("/{song_id}", response_model=SongResponse)
async def update_song(
    request: Request,
    album_id: str = Path(...),
    song_id: str = Path(...),
    data: SongUpdate = ...,
) -> SongResponse:
    """
    Update a song's metadata.

    Only provided fields will be updated.
    """
    album = _get_album(request, album_id)

    for song in album.songs:
        if str(song.id) == song_id:
            update_data = data.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                if value is not None:
                    setattr(song, field, value)
    get_album_store(request).save(album)
    return _song_to_response(song)

    raise HTTPException(status_code=404, detail="Song not found")


@router.delete("/{song_id}", status_code=204)
async def delete_song(request: Request, album_id: str = Path(...), song_id: str = Path(...)) -> None:
    """Delete a song from an album."""
    album = _get_album(request, album_id)

    for i, song in enumerate(album.songs):
        if str(song.id) == song_id:
            album.songs.pop(i)
            get_album_store(request).save(album)
            return

    raise HTTPException(status_code=404, detail="Song not found")


@router.post("/{song_id}/sections", response_model=SectionResponse, status_code=201)
async def add_section(
    album_id: str = Path(...),
    song_id: str = Path(...),
    data: SectionCreate = ...,
) -> SectionResponse:
    """Add a section to a song."""
    album = _get_album(album_id)

    for song in album.songs:
        if str(song.id) == song_id:
            try:
                section_type = SectionType(data.section_type)
            except ValueError:
                section_type = SectionType.OTHER

            section = Section(
                section_type=section_type,
                order=data.order,
                lyrics=data.lyrics,
                chord_progression=data.chord_progression,
                duration_bars=data.duration_bars,
                narrative_function=data.narrative_function,
                emotional_arc=data.emotional_arc,
            )
            song.add_section(section)
            return _section_to_response(section)

    raise HTTPException(status_code=404, detail="Song not found")


@router.put("/{song_id}/reorder", response_model=SongResponse)
async def reorder_song(
    album_id: str = Path(...),
    song_id: str = Path(...),
    new_track_number: int = ...,
) -> SongResponse:
    """
    Change a song's track number.

    Other songs will be reordered accordingly.
    """
    album = _get_album(album_id)

    target_song = None
    for song in album.songs:
        if str(song.id) == song_id:
            target_song = song
            break

    if not target_song:
        raise HTTPException(status_code=404, detail="Song not found")

    # Reorder songs
    old_number = target_song.track_number
    target_song.track_number = new_track_number

    for song in album.songs:
        if song.id != target_song.id:
            if old_number < new_track_number:
                # Moving down: shift songs between old and new up
                if old_number < song.track_number <= new_track_number:
                    song.track_number -= 1
            # Moving up: shift songs between new and old down
            elif new_track_number <= song.track_number < old_number:
                song.track_number += 1

    return _song_to_response(target_song)
