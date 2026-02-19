"""API dependencies and shared utilities."""

from __future__ import annotations

import hashlib
import secrets
from typing import TypeAlias

from fastapi import Header, HTTPException, Request, WebSocket, status

from album_conceptualizer.config import get_settings
from album_conceptualizer.identity_state import IdentityStateStore
from album_conceptualizer.logging import get_logger
from album_conceptualizer.models.identity import WorkspaceSession
from album_conceptualizer.storage import SubscriptionStore


logger = get_logger("album_conceptualizer.audit")
Connection: TypeAlias = Request | WebSocket


def hash_token(token: str) -> str:
    """Hash bearer tokens before persistence/lookup."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hash_api_key(token: str) -> str:
    """Backward-compatible token hash helper."""
    return hash_token(token)


def extract_auth_token(x_api_key: str | None, authorization: str | None) -> str | None:
    """Extract an auth token from either API key or bearer auth headers."""
    token = x_api_key
    if not token and authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]
    return token


def _get_identity_store(connection: Connection) -> IdentityStateStore | None:
    return getattr(connection.app.state, "identity_store", None)


def resolve_workspace_session(connection: Connection, token: str) -> WorkspaceSession | None:
    """Resolve an active workspace session from a bearer token."""
    store = _get_identity_store(connection)
    if not store:
        return None

    session = store.get_session(hash_token(token))
    if not session or not session.is_active():
        return None

    account = store.get_account(session.account_id)
    workspace = store.get_workspace(session.workspace_id)
    if not account or not workspace:
        return None
    settings = get_settings()
    if settings.identity_require_verified_email and account.email_verified_at is None:
        return None
    if not any(member.account_id == session.account_id for member in workspace.members):
        return None

    return session


def resolve_subscription_subject(connection: Connection, token: str) -> tuple[str, WorkspaceSession | None]:
    """Resolve subscription subject key for this token.

    Workspace sessions map to `workspace:<id>` subject keys while legacy API keys map
    to their hashed token for backward compatibility.
    """
    session = resolve_workspace_session(connection, token)
    if session:
        return f"workspace:{session.workspace_id}", session
    return hash_api_key(token), None


def require_api_key(
    request: Request = None,  # type: ignore[assignment]
    websocket: WebSocket = None,  # type: ignore[assignment]
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> None:
    """Require API key if configured, allowing valid workspace session tokens."""
    connection = request or websocket
    settings = get_settings()
    allowed_keys = settings.api_keys or ([settings.api_key] if settings.api_key else [])
    if not allowed_keys:
        return

    token = extract_auth_token(x_api_key, authorization)
    if token and any(secrets.compare_digest(token, key) for key in allowed_keys):
        return
    if token and connection and resolve_workspace_session(connection, token):
        return

    logger.warning(
        "api_key_invalid",
        extra={"has_key": bool(token)},
    )
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing API key",
    )


def require_active_subscription(
    request: Request = None,  # type: ignore[assignment]
    websocket: WebSocket = None,  # type: ignore[assignment]
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> None:
    """Require active paid subscription when billing gate is enabled."""
    settings = get_settings()
    if not settings.subscription_required:
        return

    connection = request or websocket
    if connection is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Request context unavailable for subscription check",
        )

    token = extract_auth_token(x_api_key, authorization)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API key for subscription check",
        )

    store: SubscriptionStore | None = getattr(connection.app.state, "subscription_store", None)
    if not store:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Subscription store unavailable",
        )

    subject_key, _ = resolve_subscription_subject(connection, token)
    record = store.get(subject_key)
    if not record or not record.is_active():
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Active subscription required",
        )
