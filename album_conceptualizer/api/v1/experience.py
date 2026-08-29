"""Product experience endpoints — aggregated from focused sub-routers."""

from fastapi import APIRouter

from .experience_gamification import router as gamification_router

# Re-exports for backward compatibility
from .experience_realtime import (
    CollabRealtimeEvent,
    CollabRealtimeHub,
    RedisCollabRealtimeHub,
    _get_collab_realtime_hub,
)
from .experience_release import router as release_router
from .experience_social import router as social_router
from .experience_studio import router as studio_router


router = APIRouter()
router.include_router(studio_router)
router.include_router(release_router)
router.include_router(social_router)
router.include_router(gamification_router)

__all__ = [
    "CollabRealtimeEvent",
    "CollabRealtimeHub",
    "RedisCollabRealtimeHub",
    "_get_collab_realtime_hub",
    "router",
]
