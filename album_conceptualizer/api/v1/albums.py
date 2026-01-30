"""Album management endpoints."""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from album_conceptualizer.models.album import Album


router = APIRouter()

# In-memory storage for demo (replace with database in production)
_albums_db: dict[str, Album] = {}


class AlbumCreate(BaseModel):
    """Request model for creating an album."""

    title: str = Field(..., min_length=1, max_length=200)
    artist: str | None = None
    concept_summary: str | None = None
    primary_genre: str | None = None
    secondary_genres: list[str] = Field(default_factory=list)
    release_year: int | None = Field(default=None, ge=1900, le=2100)
    central_themes: list[str] = Field(default_factory=list)


class AlbumUpdate(BaseModel):
    """Request model for updating an album."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    artist: str | None = None
    concept_summary: str | None = None
    primary_genre: str | None = None
    secondary_genres: list[str] | None = None
    release_year: int | None = Field(default=None, ge=1900, le=2100)
    central_themes: list[str] | None = None


class AlbumResponse(BaseModel):
    """Response model for album data."""

    id: str
    title: str
    artist: str | None
    concept_summary: str | None
    primary_genre: str | None
    secondary_genres: list[str]
    release_year: int | None
    central_themes: list[str]
    song_count: int
    tracklist: str


class AlbumListResponse(BaseModel):
    """Response model for album list."""

    items: list[AlbumResponse]
    total: int
    page: int
    page_size: int


def _album_to_response(album: Album) -> AlbumResponse:
    """Convert Album model to response."""
    return AlbumResponse(
        id=str(album.id),
        title=album.title,
        artist=album.artist,
        concept_summary=album.concept_summary,
        primary_genre=album.primary_genre,
        secondary_genres=album.secondary_genres,
        release_year=album.release_year,
        central_themes=album.central_themes,
        song_count=len(album.songs),
        tracklist=album.to_tracklist(),
    )


@router.get("", response_model=AlbumListResponse)
async def list_albums(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: str | None = Query(None, description="Search in title/artist"),
) -> AlbumListResponse:
    """
    List all albums with pagination.

    Optionally filter by search term.
    """
    albums = list(_albums_db.values())

    # Filter by search term
    if search:
        search_lower = search.lower()
        albums = [
            a
            for a in albums
            if search_lower in a.title.lower() or (a.artist and search_lower in a.artist.lower())
        ]

    # Sort by title
    albums.sort(key=lambda a: a.title)

    # Paginate
    total = len(albums)
    start = (page - 1) * page_size
    end = start + page_size
    paginated = albums[start:end]

    return AlbumListResponse(
        items=[_album_to_response(a) for a in paginated],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=AlbumResponse, status_code=201)
async def create_album(data: AlbumCreate) -> AlbumResponse:
    """
    Create a new album.

    Returns the created album with its generated ID.
    """
    album = Album(
        title=data.title,
        artist=data.artist,
        concept_summary=data.concept_summary,
        primary_genre=data.primary_genre,
        secondary_genres=data.secondary_genres,
        release_year=data.release_year,
        central_themes=data.central_themes,
    )

    _albums_db[str(album.id)] = album
    return _album_to_response(album)


@router.get("/{album_id}", response_model=AlbumResponse)
async def get_album(album_id: str) -> AlbumResponse:
    """
    Get a specific album by ID.

    Raises 404 if album not found.
    """
    album = _albums_db.get(album_id)
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")

    return _album_to_response(album)


@router.patch("/{album_id}", response_model=AlbumResponse)
async def update_album(album_id: str, data: AlbumUpdate) -> AlbumResponse:
    """
    Update an album's metadata.

    Only provided fields will be updated.
    """
    album = _albums_db.get(album_id)
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")

    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(album, field, value)

    return _album_to_response(album)


@router.delete("/{album_id}", status_code=204)
async def delete_album(album_id: str) -> None:
    """
    Delete an album.

    This also deletes all songs in the album.
    """
    if album_id not in _albums_db:
        raise HTTPException(status_code=404, detail="Album not found")

    del _albums_db[album_id]


@router.post("/{album_id}/duplicate", response_model=AlbumResponse, status_code=201)
async def duplicate_album(album_id: str, new_title: str | None = None) -> AlbumResponse:
    """
    Create a copy of an album.

    Optionally provide a new title for the duplicate.
    """
    original = _albums_db.get(album_id)
    if not original:
        raise HTTPException(status_code=404, detail="Album not found")

    # Create a deep copy
    duplicate = Album(
        title=new_title or f"{original.title} (Copy)",
        artist=original.artist,
        concept_summary=original.concept_summary,
        primary_genre=original.primary_genre,
        secondary_genres=original.secondary_genres.copy(),
        release_year=original.release_year,
        central_themes=original.central_themes.copy(),
    )

    # Copy songs
    for song in original.songs:
        duplicate.add_song(song.model_copy(deep=True))

    _albums_db[str(duplicate.id)] = duplicate
    return _album_to_response(duplicate)


# Export the database for use by other routers
def get_albums_db() -> dict[str, Album]:
    """Get the albums database."""
    return _albums_db
