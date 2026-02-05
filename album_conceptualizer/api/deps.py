"""API dependencies and shared utilities."""

from fastapi import Header, HTTPException, status

from album_conceptualizer.config import get_settings
from album_conceptualizer.logging import get_logger


logger = get_logger("album_conceptualizer.audit")


def require_api_key(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> None:
    """Require API key if configured."""
    settings = get_settings()
    allowed_keys = settings.api_keys or ([settings.api_key] if settings.api_key else [])
    if not allowed_keys:
        return

    token = x_api_key
    if not token and authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]

    if token not in allowed_keys:
        logger.warning(
            "api_key_invalid",
            extra={"has_key": bool(token)},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key",
        )
