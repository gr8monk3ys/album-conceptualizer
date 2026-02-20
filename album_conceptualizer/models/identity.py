"""Identity and workspace domain models."""

from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class WorkspaceRole(StrEnum):
    """Supported workspace membership roles."""

    OWNER = "owner"
    EDITOR = "editor"
    VIEWER = "viewer"


class Account(BaseModel):
    """End-user account."""

    id: UUID = Field(default_factory=uuid4)
    email: str
    display_name: str | None = None
    email_verified_at: datetime | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class WorkspaceMember(BaseModel):
    """Membership binding between account and workspace."""

    account_id: UUID
    role: WorkspaceRole = WorkspaceRole.EDITOR
    joined_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class Workspace(BaseModel):
    """Collaborative workspace."""

    id: UUID = Field(default_factory=uuid4)
    name: str
    created_by: UUID
    members: list[WorkspaceMember] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class WorkspaceSession(BaseModel):
    """Bearer-token session scoped to a workspace and account."""

    token_hash: str
    account_id: UUID
    workspace_id: UUID
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    expires_at: datetime | None = None

    def is_active(self, now: datetime | None = None) -> bool:
        """Return whether this session is currently active."""
        if self.expires_at is None:
            return True
        current = now or datetime.now(UTC)
        return self.expires_at > current


class IdentityChallengeIntent(StrEnum):
    """One-time challenge intent types."""

    SIGNIN = "signin"
    INVITE = "invite"


class EmailChallenge(BaseModel):
    """One-time email challenge used for magic-link auth and invite acceptance."""

    token_hash: str
    email: str
    intent: IdentityChallengeIntent = IdentityChallengeIntent.SIGNIN
    workspace_id: UUID | None = None
    role: WorkspaceRole = WorkspaceRole.EDITOR
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    expires_at: datetime
    consumed_at: datetime | None = None

    def is_active(self, now: datetime | None = None) -> bool:
        """Return whether this challenge can still be consumed."""
        current = now or datetime.now(UTC)
        return self.consumed_at is None and self.expires_at > current


class WorkspaceInvite(BaseModel):
    """Workspace invite linked to a magic-link token."""

    id: UUID = Field(default_factory=uuid4)
    workspace_id: UUID
    invited_email: str
    role: WorkspaceRole = WorkspaceRole.EDITOR
    invited_by_account_id: UUID
    token_hash: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    expires_at: datetime
    accepted_at: datetime | None = None
    accepted_account_id: UUID | None = None
    revoked_at: datetime | None = None

    def is_active(self, now: datetime | None = None) -> bool:
        """Return whether this invite can still be accepted."""
        current = now or datetime.now(UTC)
        return self.accepted_at is None and self.revoked_at is None and self.expires_at > current
