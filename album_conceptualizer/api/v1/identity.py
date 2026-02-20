"""Account/workspace identity endpoints."""

from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta
from typing import cast
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Request, status
from pydantic import BaseModel, Field

from album_conceptualizer.api.deps import extract_auth_token, hash_token, resolve_workspace_session
from album_conceptualizer.config import get_settings
from album_conceptualizer.emailing import EmailSender
from album_conceptualizer.identity_state import IdentityStateStore
from album_conceptualizer.logging import get_logger
from album_conceptualizer.models.identity import (
    Account,
    EmailChallenge,
    IdentityChallengeIntent,
    Workspace,
    WorkspaceInvite,
    WorkspaceMember,
    WorkspaceRole,
    WorkspaceSession,
)


router = APIRouter()
logger = get_logger("album_conceptualizer.identity")


class RegisterRequest(BaseModel):
    """Create or reuse an account and issue a workspace session token."""

    email: str = Field(..., min_length=3, max_length=320)
    display_name: str | None = Field(default=None, max_length=120)
    workspace_name: str | None = Field(default=None, min_length=1, max_length=120)


class WorkspaceSummary(BaseModel):
    """Workspace summary with caller role."""

    id: str
    name: str
    role: WorkspaceRole
    member_count: int = Field(ge=1)


class IdentityTokenResponse(BaseModel):
    """Workspace bearer token payload."""

    token: str
    workspace_id: str


class RegisterResponse(BaseModel):
    """Register/login response payload."""

    account_id: str
    email: str
    email_verified: bool
    display_name: str | None
    workspace: WorkspaceSummary
    token: str


class MeResponse(BaseModel):
    """Current caller identity payload."""

    account_id: str
    email: str
    email_verified: bool
    display_name: str | None
    workspace: WorkspaceSummary


class WorkspaceListResponse(BaseModel):
    """List workspaces for account."""

    items: list[WorkspaceSummary]
    total: int


class CreateWorkspaceRequest(BaseModel):
    """Create a workspace for the authenticated account."""

    name: str = Field(..., min_length=1, max_length=120)


class CreateWorkspaceResponse(BaseModel):
    """Create workspace response payload."""

    workspace: WorkspaceSummary
    token: str


class IssueTokenRequest(BaseModel):
    """Issue a token for an existing workspace membership."""

    expires_in_hours: int | None = Field(default=None, ge=1, le=24 * 365)


class MagicLinkRequest(BaseModel):
    """Request a sign-in magic link."""

    email: str = Field(..., min_length=3, max_length=320)


class MagicLinkRequestResponse(BaseModel):
    """Magic link request acknowledgement."""

    sent: bool
    expires_at: datetime
    debug_token: str | None = None


class MagicLinkConsumeRequest(BaseModel):
    """Consume a previously requested magic link token."""

    token: str = Field(..., min_length=8)
    display_name: str | None = Field(default=None, max_length=120)


class CreateInviteRequest(BaseModel):
    """Create an invite for a workspace."""

    email: str = Field(..., min_length=3, max_length=320)
    role: WorkspaceRole = WorkspaceRole.EDITOR
    expires_in_hours: int | None = Field(default=None, ge=1, le=24 * 30)


class CreateInviteResponse(BaseModel):
    """Invite creation response."""

    invite_id: str
    workspace_id: str
    invited_email: str
    role: WorkspaceRole
    expires_at: datetime
    debug_token: str | None = None


class AcceptInviteRequest(BaseModel):
    """Accept a workspace invite via its token."""

    token: str = Field(..., min_length=8)
    display_name: str | None = Field(default=None, max_length=120)


class InviteSummary(BaseModel):
    """Workspace invite summary item."""

    id: str
    invited_email: str
    role: WorkspaceRole
    status: str
    expires_at: datetime


class WorkspaceInviteListResponse(BaseModel):
    """List invites for a workspace."""

    items: list[InviteSummary]
    total: int


def _normalize_email(email: str) -> str:
    normalized = email.strip().lower()
    if "@" not in normalized:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid email"
        )
    return normalized


def _workspace_role(workspace: Workspace, account_id: UUID) -> WorkspaceRole | None:
    for member in workspace.members:
        if member.account_id == account_id:
            return member.role
    return None


def _workspace_summary(workspace: Workspace, account_id: UUID) -> WorkspaceSummary:
    role = _workspace_role(workspace, account_id)
    if role is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a workspace member")
    return WorkspaceSummary(
        id=str(workspace.id),
        name=workspace.name,
        role=role,
        member_count=max(1, len(workspace.members)),
    )


def _get_store(request: Request) -> IdentityStateStore:
    store = getattr(request.app.state, "identity_store", None)
    if not store:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Identity store unavailable",
        )
    return cast("IdentityStateStore", store)


def _create_workspace(store: IdentityStateStore, *, account_id: UUID, name: str) -> Workspace:
    workspace = Workspace(
        name=name.strip(),
        created_by=account_id,
        members=[WorkspaceMember(account_id=account_id, role=WorkspaceRole.OWNER)],
    )
    store.save_workspace(workspace)
    return workspace


def _issue_workspace_token(
    store: IdentityStateStore,
    *,
    account_id: UUID,
    workspace_id: UUID,
) -> str:
    token = secrets.token_urlsafe(32)
    store.save_session(
        WorkspaceSession(
            token_hash=hash_token(token),
            account_id=account_id,
            workspace_id=workspace_id,
        )
    )
    return token


def _resolve_caller(
    request: Request,
    authorization: str | None,
) -> tuple[Account, Workspace]:
    token = extract_auth_token(None, authorization)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    session = resolve_workspace_session(request, token)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token"
        )

    store = _get_store(request)
    account = store.get_account(session.account_id)
    workspace = store.get_workspace(session.workspace_id)
    if not account or not workspace:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")

    if _workspace_role(workspace, account.id) is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a workspace member")

    return account, workspace


def _upsert_account(
    store: IdentityStateStore,
    *,
    email: str,
    display_name: str | None = None,
    verified: bool = False,
) -> Account:
    account = store.get_account_by_email(email)
    if account is None:
        account = Account(email=email, display_name=display_name)
    elif display_name and account.display_name != display_name:
        account.display_name = display_name

    if verified and account.email_verified_at is None:
        account.email_verified_at = datetime.now(UTC)

    store.save_account(account)
    return account


def _issue_email_challenge(
    store: IdentityStateStore,
    *,
    email: str,
    intent: IdentityChallengeIntent,
    expires_in_hours: int,
    workspace_id: UUID | None = None,
    role: WorkspaceRole = WorkspaceRole.EDITOR,
) -> tuple[str, EmailChallenge]:
    token = secrets.token_urlsafe(32)
    challenge = EmailChallenge(
        token_hash=hash_token(token),
        email=email,
        intent=intent,
        workspace_id=workspace_id,
        role=role,
        expires_at=datetime.now(UTC) + timedelta(hours=expires_in_hours),
    )
    store.save_email_challenge(challenge)
    return token, challenge


def _issue_auth_response(
    store: IdentityStateStore,
    *,
    account: Account,
    workspace: Workspace,
) -> RegisterResponse:
    token = _issue_workspace_token(store, account_id=account.id, workspace_id=workspace.id)
    return RegisterResponse(
        account_id=str(account.id),
        email=account.email,
        email_verified=account.email_verified_at is not None,
        display_name=account.display_name,
        workspace=_workspace_summary(workspace, account.id),
        token=token,
    )


def _ensure_workspace_membership(
    store: IdentityStateStore,
    *,
    workspace: Workspace,
    account_id: UUID,
    role: WorkspaceRole,
) -> Workspace:
    existing = _workspace_role(workspace, account_id)
    if existing is None:
        workspace.members.append(WorkspaceMember(account_id=account_id, role=role))
        store.save_workspace(workspace)
    return workspace


def _invite_status(invite: WorkspaceInvite) -> str:
    now = datetime.now(UTC)
    if invite.revoked_at is not None:
        return "revoked"
    if invite.accepted_at is not None:
        return "accepted"
    if invite.expires_at <= now:
        return "expired"
    return "pending"


def _get_email_sender(request: Request) -> EmailSender:
    sender = getattr(request.app.state, "email_sender", None)
    if sender is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Email sender unavailable"
        )
    return cast("EmailSender", sender)


def _build_token_link(template: str, token: str) -> str:
    try:
        return template.format(token=token)
    except Exception:
        return token


def _send_identity_email(
    request: Request,
    *,
    to_email: str,
    subject: str,
    body: str,
) -> None:
    sender = _get_email_sender(request)
    try:
        sender.send(to_email=to_email, subject=subject, body=body)
    except Exception as exc:
        logger.error("identity_email_send_failed", extra={"to_email": to_email, "subject": subject})
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to send verification email",
        ) from exc


@router.post("/register", response_model=RegisterResponse)
async def register_identity(request: Request, data: RegisterRequest) -> RegisterResponse:
    """Create or load an account, ensure a workspace, and issue a bearer token."""
    store = _get_store(request)
    email = _normalize_email(data.email)
    display_name = data.display_name.strip() if data.display_name else None

    account = _upsert_account(
        store,
        email=email,
        display_name=display_name,
        verified=True,
    )

    workspace_name = data.workspace_name.strip() if data.workspace_name else None
    workspaces = store.list_workspaces_for_account(account.id)

    if workspace_name:
        workspace = _create_workspace(store, account_id=account.id, name=workspace_name)
    elif workspaces:
        workspace = workspaces[0]
    else:
        fallback_name = f"{(account.display_name or email.split('@')[0]).strip()}'s Workspace"
        workspace = _create_workspace(store, account_id=account.id, name=fallback_name)

    return _issue_auth_response(store, account=account, workspace=workspace)


@router.post("/magic-links/request", response_model=MagicLinkRequestResponse)
async def request_magic_link(request: Request, data: MagicLinkRequest) -> MagicLinkRequestResponse:
    """Request a sign-in magic link for an email address."""
    settings = get_settings()
    store = _get_store(request)
    email = _normalize_email(data.email)

    _upsert_account(store, email=email, verified=False)
    token, challenge = _issue_email_challenge(
        store,
        email=email,
        intent=IdentityChallengeIntent.SIGNIN,
        expires_in_hours=settings.identity_magic_link_ttl_hours,
    )

    magic_link = _build_token_link(settings.identity_magic_link_url_template, token)
    _send_identity_email(
        request,
        to_email=email,
        subject="Your Album Conceptualizer sign-in link",
        body=(
            "Use the sign-in link below to continue:\n"
            f"{magic_link}\n\n"
            f"If a link does not open automatically, use this one-time token: {token}"
        ),
    )

    return MagicLinkRequestResponse(
        sent=True,
        expires_at=challenge.expires_at,
        debug_token=token if settings.identity_debug_tokens else None,
    )


@router.post("/magic-links/consume", response_model=RegisterResponse)
async def consume_magic_link(request: Request, data: MagicLinkConsumeRequest) -> RegisterResponse:
    """Consume a sign-in magic link and issue a workspace token."""
    store = _get_store(request)
    challenge = store.get_email_challenge(hash_token(data.token))
    if challenge is None or not challenge.is_active():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired magic link"
        )

    display_name = data.display_name.strip() if data.display_name else None
    account = _upsert_account(
        store,
        email=challenge.email,
        display_name=display_name,
        verified=True,
    )

    if challenge.intent == IdentityChallengeIntent.INVITE:
        invite = store.get_invite_by_token_hash(challenge.token_hash)
        if invite is None or not invite.is_active():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Invite is no longer valid"
            )

        workspace = store.get_workspace(invite.workspace_id)
        if workspace is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

        workspace = _ensure_workspace_membership(
            store,
            workspace=workspace,
            account_id=account.id,
            role=invite.role,
        )
        invite.accepted_at = datetime.now(UTC)
        invite.accepted_account_id = account.id
        store.save_invite(invite)
    else:
        workspaces = store.list_workspaces_for_account(account.id)
        if workspaces:
            workspace = workspaces[0]
        else:
            fallback_name = (
                f"{(account.display_name or account.email.split('@')[0]).strip()}'s Workspace"
            )
            workspace = _create_workspace(store, account_id=account.id, name=fallback_name)

    challenge.consumed_at = datetime.now(UTC)
    store.save_email_challenge(challenge)

    return _issue_auth_response(store, account=account, workspace=workspace)


@router.get("/me", response_model=MeResponse)
async def get_me(
    request: Request,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> MeResponse:
    """Return current account/workspace identity for a workspace token."""
    account, workspace = _resolve_caller(request, authorization)
    return MeResponse(
        account_id=str(account.id),
        email=account.email,
        email_verified=account.email_verified_at is not None,
        display_name=account.display_name,
        workspace=_workspace_summary(workspace, account.id),
    )


@router.get("/workspaces", response_model=WorkspaceListResponse)
async def list_workspaces(
    request: Request,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> WorkspaceListResponse:
    """List all workspaces available to this account."""
    account, _ = _resolve_caller(request, authorization)
    store = _get_store(request)
    workspaces = store.list_workspaces_for_account(account.id)
    summaries = [_workspace_summary(workspace, account.id) for workspace in workspaces]
    return WorkspaceListResponse(items=summaries, total=len(summaries))


@router.post("/workspaces", response_model=CreateWorkspaceResponse)
async def create_workspace(
    request: Request,
    data: CreateWorkspaceRequest,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> CreateWorkspaceResponse:
    """Create a new workspace and issue a token for it."""
    account, _ = _resolve_caller(request, authorization)
    store = _get_store(request)

    workspace = _create_workspace(store, account_id=account.id, name=data.name)
    token = _issue_workspace_token(store, account_id=account.id, workspace_id=workspace.id)

    return CreateWorkspaceResponse(
        workspace=_workspace_summary(workspace, account.id),
        token=token,
    )


@router.post("/workspaces/{workspace_id}/tokens", response_model=IdentityTokenResponse)
async def issue_workspace_token(
    workspace_id: UUID,
    request: Request,
    data: IssueTokenRequest,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> IdentityTokenResponse:
    """Issue another bearer token for a workspace membership."""
    del data  # Placeholder for future TTL support without breaking request schema.

    account, _ = _resolve_caller(request, authorization)
    store = _get_store(request)

    workspace = store.get_workspace(workspace_id)
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    role = _workspace_role(workspace, account.id)
    if role is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a workspace member")

    token = _issue_workspace_token(store, account_id=account.id, workspace_id=workspace.id)
    return IdentityTokenResponse(token=token, workspace_id=str(workspace.id))


@router.post("/workspaces/{workspace_id}/invites", response_model=CreateInviteResponse)
async def create_workspace_invite(
    workspace_id: UUID,
    request: Request,
    data: CreateInviteRequest,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> CreateInviteResponse:
    """Create an email invite for a workspace and deliver an invite magic-link."""
    settings = get_settings()
    account, _ = _resolve_caller(request, authorization)
    store = _get_store(request)

    workspace = store.get_workspace(workspace_id)
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    caller_role = _workspace_role(workspace, account.id)
    if caller_role not in {WorkspaceRole.OWNER, WorkspaceRole.EDITOR}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owner/editor members can create invites",
        )

    if data.role == WorkspaceRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Owner role cannot be granted via invite",
        )

    invited_email = _normalize_email(data.email)
    if invited_email == account.email.strip().lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot invite yourself"
        )

    ttl_hours = data.expires_in_hours or settings.identity_invite_ttl_hours
    token, challenge = _issue_email_challenge(
        store,
        email=invited_email,
        intent=IdentityChallengeIntent.INVITE,
        expires_in_hours=ttl_hours,
        workspace_id=workspace_id,
        role=data.role,
    )
    invite = WorkspaceInvite(
        workspace_id=workspace_id,
        invited_email=invited_email,
        role=data.role,
        invited_by_account_id=account.id,
        token_hash=challenge.token_hash,
        expires_at=challenge.expires_at,
    )
    store.save_invite(invite)

    invite_link = _build_token_link(settings.identity_invite_url_template, token)
    _send_identity_email(
        request,
        to_email=invited_email,
        subject=f"You are invited to join {workspace.name}",
        body=(
            f"You have been invited to join workspace '{workspace.name}'.\n"
            f"Open this invite link:\n{invite_link}\n\n"
            f"If a link does not open automatically, use this one-time token: {token}"
        ),
    )

    return CreateInviteResponse(
        invite_id=str(invite.id),
        workspace_id=str(workspace_id),
        invited_email=invited_email,
        role=invite.role,
        expires_at=invite.expires_at,
        debug_token=token if settings.identity_debug_tokens else None,
    )


@router.post("/invites/accept", response_model=RegisterResponse)
async def accept_workspace_invite(request: Request, data: AcceptInviteRequest) -> RegisterResponse:
    """Accept an invite token and issue a workspace session token."""
    store = _get_store(request)
    token_hash = hash_token(data.token)

    invite = store.get_invite_by_token_hash(token_hash)
    challenge = store.get_email_challenge(token_hash)
    if invite is None or challenge is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid invite token")
    if not invite.is_active() or not challenge.is_active():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Invite is no longer valid"
        )

    workspace = store.get_workspace(invite.workspace_id)
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    display_name = data.display_name.strip() if data.display_name else None
    account = _upsert_account(
        store,
        email=invite.invited_email,
        display_name=display_name,
        verified=True,
    )
    workspace = _ensure_workspace_membership(
        store,
        workspace=workspace,
        account_id=account.id,
        role=invite.role,
    )

    invite.accepted_at = datetime.now(UTC)
    invite.accepted_account_id = account.id
    store.save_invite(invite)
    challenge.consumed_at = datetime.now(UTC)
    store.save_email_challenge(challenge)

    return _issue_auth_response(store, account=account, workspace=workspace)


@router.get("/workspaces/{workspace_id}/invites", response_model=WorkspaceInviteListResponse)
async def list_workspace_invites(
    workspace_id: UUID,
    request: Request,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> WorkspaceInviteListResponse:
    """List invites for one workspace."""
    account, _ = _resolve_caller(request, authorization)
    store = _get_store(request)

    workspace = store.get_workspace(workspace_id)
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    role = _workspace_role(workspace, account.id)
    if role not in {WorkspaceRole.OWNER, WorkspaceRole.EDITOR}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    invites = store.list_invites_for_workspace(workspace_id)
    items = [
        InviteSummary(
            id=str(invite.id),
            invited_email=invite.invited_email,
            role=invite.role,
            status=_invite_status(invite),
            expires_at=invite.expires_at,
        )
        for invite in invites
    ]
    return WorkspaceInviteListResponse(items=items, total=len(items))
