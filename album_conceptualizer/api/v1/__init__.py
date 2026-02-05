"""API v1 router aggregation."""

from fastapi import APIRouter, Depends

from album_conceptualizer.api.v1.albums import router as albums_router
from album_conceptualizer.api.v1.bible import router as bible_router
from album_conceptualizer.api.v1.export import router as export_router
from album_conceptualizer.api.v1.health import router as health_router
from album_conceptualizer.api.v1.songs import router as songs_router
from album_conceptualizer.api.v1.theory import router as theory_router
from album_conceptualizer.api.deps import require_api_key


router = APIRouter()
protected_router = APIRouter(dependencies=[Depends(require_api_key)])

# Include all v1 routers
router.include_router(health_router, tags=["health"])

protected_router.include_router(albums_router, prefix="/albums", tags=["albums"])
protected_router.include_router(songs_router, prefix="/albums/{album_id}/songs", tags=["songs"])
protected_router.include_router(bible_router, prefix="/albums/{album_id}/bible", tags=["bible"])
protected_router.include_router(theory_router, prefix="/theory", tags=["theory"])
protected_router.include_router(export_router, prefix="/export", tags=["export"])

router.include_router(protected_router)

__all__ = ["router"]
