"""API v1 router aggregation."""

from fastapi import APIRouter, Depends

from album_conceptualizer.api.deps import require_active_subscription, require_api_key
from album_conceptualizer.api.v1.albums import router as albums_router
from album_conceptualizer.api.v1.bible import router as bible_router
from album_conceptualizer.api.v1.billing import (
    protected_router as billing_protected_router,
)
from album_conceptualizer.api.v1.billing import (
    public_router as billing_public_router,
)
from album_conceptualizer.api.v1.experience import router as experience_router
from album_conceptualizer.api.v1.export import router as export_router
from album_conceptualizer.api.v1.health import router as health_router
from album_conceptualizer.api.v1.identity import router as identity_router
from album_conceptualizer.api.v1.songs import router as songs_router
from album_conceptualizer.api.v1.theory import router as theory_router


router = APIRouter()
api_key_router = APIRouter(dependencies=[Depends(require_api_key)])
subscription_router = APIRouter(
    dependencies=[Depends(require_api_key), Depends(require_active_subscription)]
)

# Include all v1 routers
router.include_router(health_router, tags=["health"])
router.include_router(identity_router, prefix="/identity", tags=["identity"])
router.include_router(billing_public_router, prefix="/billing", tags=["billing"])

subscription_router.include_router(albums_router, prefix="/albums", tags=["albums"])
subscription_router.include_router(songs_router, prefix="/albums/{album_id}/songs", tags=["songs"])
subscription_router.include_router(bible_router, prefix="/albums/{album_id}/bible", tags=["bible"])
subscription_router.include_router(theory_router, prefix="/theory", tags=["theory"])
subscription_router.include_router(export_router, prefix="/export", tags=["export"])
subscription_router.include_router(experience_router, tags=["experience"])
api_key_router.include_router(billing_protected_router, prefix="/billing", tags=["billing"])

router.include_router(api_key_router)
router.include_router(subscription_router)

__all__ = ["router"]
