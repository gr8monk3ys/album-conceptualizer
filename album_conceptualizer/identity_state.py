"""Persistence backends for account/workspace identity state."""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field
from pathlib import Path
from threading import RLock
from typing import Protocol
from uuid import UUID

from album_conceptualizer.models.identity import (
    Account,
    EmailChallenge,
    Workspace,
    WorkspaceInvite,
    WorkspaceSession,
)


class IdentityStateStore(Protocol):
    """Storage protocol for account/workspace/session identity state."""

    def get_account(self, account_id: UUID) -> Account | None:
        """Return one account by id."""

    def get_account_by_email(self, email: str) -> Account | None:
        """Return one account by normalized email."""

    def save_account(self, account: Account) -> None:
        """Persist one account."""

    def get_workspace(self, workspace_id: UUID) -> Workspace | None:
        """Return one workspace by id."""

    def list_workspaces_for_account(self, account_id: UUID) -> list[Workspace]:
        """List workspaces where account is a member."""

    def save_workspace(self, workspace: Workspace) -> None:
        """Persist one workspace."""

    def get_session(self, token_hash: str) -> WorkspaceSession | None:
        """Return one workspace session by token hash."""

    def save_session(self, session: WorkspaceSession) -> None:
        """Persist one workspace session."""

    def delete_session(self, token_hash: str) -> None:
        """Delete one workspace session by token hash."""

    def get_email_challenge(self, token_hash: str) -> EmailChallenge | None:
        """Return one email challenge by token hash."""

    def save_email_challenge(self, challenge: EmailChallenge) -> None:
        """Persist one email challenge."""

    def get_invite_by_id(self, invite_id: UUID) -> WorkspaceInvite | None:
        """Return one workspace invite by id."""

    def get_invite_by_token_hash(self, token_hash: str) -> WorkspaceInvite | None:
        """Return one workspace invite by token hash."""

    def list_invites_for_workspace(self, workspace_id: UUID) -> list[WorkspaceInvite]:
        """Return invites for one workspace."""

    def save_invite(self, invite: WorkspaceInvite) -> None:
        """Persist one workspace invite."""


class InMemoryIdentityStateStore:
    """In-memory identity state store."""

    def __init__(self) -> None:
        self._accounts: dict[str, Account] = {}
        self._workspaces: dict[str, Workspace] = {}
        self._sessions: dict[str, WorkspaceSession] = {}
        self._email_challenges: dict[str, EmailChallenge] = {}
        self._invites: dict[str, WorkspaceInvite] = {}
        self._lock = RLock()

    def get_account(self, account_id: UUID) -> Account | None:
        with self._lock:
            account = self._accounts.get(str(account_id))
            return account.model_copy(deep=True) if account else None

    def get_account_by_email(self, email: str) -> Account | None:
        normalized = email.strip().lower()
        with self._lock:
            for account in self._accounts.values():
                if account.email.strip().lower() == normalized:
                    return account.model_copy(deep=True)
        return None

    def save_account(self, account: Account) -> None:
        with self._lock:
            self._accounts[str(account.id)] = account.model_copy(deep=True)

    def get_workspace(self, workspace_id: UUID) -> Workspace | None:
        with self._lock:
            workspace = self._workspaces.get(str(workspace_id))
            return workspace.model_copy(deep=True) if workspace else None

    def list_workspaces_for_account(self, account_id: UUID) -> list[Workspace]:
        with self._lock:
            result: list[Workspace] = []
            for workspace in self._workspaces.values():
                if any(member.account_id == account_id for member in workspace.members):
                    result.append(workspace.model_copy(deep=True))
            return result

    def save_workspace(self, workspace: Workspace) -> None:
        with self._lock:
            self._workspaces[str(workspace.id)] = workspace.model_copy(deep=True)

    def get_session(self, token_hash: str) -> WorkspaceSession | None:
        with self._lock:
            session = self._sessions.get(token_hash)
            return session.model_copy(deep=True) if session else None

    def save_session(self, session: WorkspaceSession) -> None:
        with self._lock:
            self._sessions[session.token_hash] = session.model_copy(deep=True)

    def delete_session(self, token_hash: str) -> None:
        with self._lock:
            self._sessions.pop(token_hash, None)

    def get_email_challenge(self, token_hash: str) -> EmailChallenge | None:
        with self._lock:
            challenge = self._email_challenges.get(token_hash)
            return challenge.model_copy(deep=True) if challenge else None

    def save_email_challenge(self, challenge: EmailChallenge) -> None:
        with self._lock:
            self._email_challenges[challenge.token_hash] = challenge.model_copy(deep=True)

    def get_invite_by_id(self, invite_id: UUID) -> WorkspaceInvite | None:
        with self._lock:
            invite = self._invites.get(str(invite_id))
            return invite.model_copy(deep=True) if invite else None

    def get_invite_by_token_hash(self, token_hash: str) -> WorkspaceInvite | None:
        with self._lock:
            for invite in self._invites.values():
                if invite.token_hash == token_hash:
                    return invite.model_copy(deep=True)
        return None

    def list_invites_for_workspace(self, workspace_id: UUID) -> list[WorkspaceInvite]:
        with self._lock:
            result: list[WorkspaceInvite] = []
            for invite in self._invites.values():
                if invite.workspace_id == workspace_id:
                    result.append(invite.model_copy(deep=True))
            return result

    def save_invite(self, invite: WorkspaceInvite) -> None:
        with self._lock:
            self._invites[str(invite.id)] = invite.model_copy(deep=True)


@dataclass
class FileIdentityStateStore:
    """File-backed identity state store (JSON payload per entity)."""

    root: Path
    _lock: RLock = field(default_factory=RLock, init=False, repr=False)

    def __post_init__(self) -> None:
        (self.root / "accounts").mkdir(parents=True, exist_ok=True)
        (self.root / "workspaces").mkdir(parents=True, exist_ok=True)
        (self.root / "sessions").mkdir(parents=True, exist_ok=True)
        (self.root / "challenges").mkdir(parents=True, exist_ok=True)
        (self.root / "invites").mkdir(parents=True, exist_ok=True)

    def _account_path(self, account_id: UUID) -> Path:
        return self.root / "accounts" / f"{account_id}.json"

    def _workspace_path(self, workspace_id: UUID) -> Path:
        return self.root / "workspaces" / f"{workspace_id}.json"

    def _session_path(self, token_hash: str) -> Path:
        return self.root / "sessions" / f"{token_hash}.json"

    def _challenge_path(self, token_hash: str) -> Path:
        return self.root / "challenges" / f"{token_hash}.json"

    def _invite_path(self, invite_id: UUID) -> Path:
        return self.root / "invites" / f"{invite_id}.json"

    def get_account(self, account_id: UUID) -> Account | None:
        with self._lock:
            path = self._account_path(account_id)
            if not path.exists():
                return None
            try:
                return Account.model_validate_json(path.read_text())
            except Exception:
                return None

    def get_account_by_email(self, email: str) -> Account | None:
        normalized = email.strip().lower()
        with self._lock:
            for path in (self.root / "accounts").glob("*.json"):
                try:
                    account = Account.model_validate_json(path.read_text())
                except Exception:
                    continue
                if account.email.strip().lower() == normalized:
                    return account
        return None

    def save_account(self, account: Account) -> None:
        with self._lock:
            self._account_path(account.id).write_text(account.model_dump_json(indent=2))

    def get_workspace(self, workspace_id: UUID) -> Workspace | None:
        with self._lock:
            path = self._workspace_path(workspace_id)
            if not path.exists():
                return None
            try:
                return Workspace.model_validate_json(path.read_text())
            except Exception:
                return None

    def list_workspaces_for_account(self, account_id: UUID) -> list[Workspace]:
        with self._lock:
            result: list[Workspace] = []
            for path in (self.root / "workspaces").glob("*.json"):
                try:
                    workspace = Workspace.model_validate_json(path.read_text())
                except Exception:
                    continue
                if any(member.account_id == account_id for member in workspace.members):
                    result.append(workspace)
            return result

    def save_workspace(self, workspace: Workspace) -> None:
        with self._lock:
            self._workspace_path(workspace.id).write_text(workspace.model_dump_json(indent=2))

    def get_session(self, token_hash: str) -> WorkspaceSession | None:
        with self._lock:
            path = self._session_path(token_hash)
            if not path.exists():
                return None
            try:
                return WorkspaceSession.model_validate_json(path.read_text())
            except Exception:
                return None

    def save_session(self, session: WorkspaceSession) -> None:
        with self._lock:
            self._session_path(session.token_hash).write_text(session.model_dump_json(indent=2))

    def delete_session(self, token_hash: str) -> None:
        with self._lock:
            path = self._session_path(token_hash)
            if path.exists():
                path.unlink()

    def get_email_challenge(self, token_hash: str) -> EmailChallenge | None:
        with self._lock:
            path = self._challenge_path(token_hash)
            if not path.exists():
                return None
            try:
                return EmailChallenge.model_validate_json(path.read_text())
            except Exception:
                return None

    def save_email_challenge(self, challenge: EmailChallenge) -> None:
        with self._lock:
            self._challenge_path(challenge.token_hash).write_text(challenge.model_dump_json(indent=2))

    def get_invite_by_id(self, invite_id: UUID) -> WorkspaceInvite | None:
        with self._lock:
            path = self._invite_path(invite_id)
            if not path.exists():
                return None
            try:
                return WorkspaceInvite.model_validate_json(path.read_text())
            except Exception:
                return None

    def get_invite_by_token_hash(self, token_hash: str) -> WorkspaceInvite | None:
        with self._lock:
            for path in (self.root / "invites").glob("*.json"):
                try:
                    invite = WorkspaceInvite.model_validate_json(path.read_text())
                except Exception:
                    continue
                if invite.token_hash == token_hash:
                    return invite
        return None

    def list_invites_for_workspace(self, workspace_id: UUID) -> list[WorkspaceInvite]:
        with self._lock:
            result: list[WorkspaceInvite] = []
            for path in (self.root / "invites").glob("*.json"):
                try:
                    invite = WorkspaceInvite.model_validate_json(path.read_text())
                except Exception:
                    continue
                if invite.workspace_id == workspace_id:
                    result.append(invite)
            return result

    def save_invite(self, invite: WorkspaceInvite) -> None:
        with self._lock:
            self._invite_path(invite.id).write_text(invite.model_dump_json(indent=2))


@dataclass
class SQLiteIdentityStateStore:
    """SQLite-backed identity state store."""

    path: Path
    _lock: RLock = field(default_factory=RLock, init=False, repr=False)

    def __post_init__(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self.path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS accounts (
                    id TEXT PRIMARY KEY,
                    email TEXT NOT NULL UNIQUE,
                    payload TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS workspaces (
                    id TEXT PRIMARY KEY,
                    payload TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS workspace_sessions (
                    token_hash TEXT PRIMARY KEY,
                    payload TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS email_challenges (
                    token_hash TEXT PRIMARY KEY,
                    payload TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS workspace_invites (
                    id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL,
                    token_hash TEXT NOT NULL UNIQUE,
                    payload TEXT NOT NULL
                )
                """
            )
            conn.commit()

    def get_account(self, account_id: UUID) -> Account | None:
        with self._lock, sqlite3.connect(self.path) as conn:
            row = conn.execute(
                "SELECT payload FROM accounts WHERE id = ?",
                (str(account_id),),
            ).fetchone()
        if not row:
            return None
        try:
            return Account.model_validate_json(row[0])
        except Exception:
            return None

    def get_account_by_email(self, email: str) -> Account | None:
        normalized = email.strip().lower()
        with self._lock, sqlite3.connect(self.path) as conn:
            row = conn.execute(
                "SELECT payload FROM accounts WHERE email = ?",
                (normalized,),
            ).fetchone()
        if not row:
            return None
        try:
            return Account.model_validate_json(row[0])
        except Exception:
            return None

    def save_account(self, account: Account) -> None:
        payload = account.model_dump_json(indent=2)
        with self._lock, sqlite3.connect(self.path) as conn:
            conn.execute(
                "INSERT OR REPLACE INTO accounts (id, email, payload) VALUES (?, ?, ?)",
                (str(account.id), account.email.strip().lower(), payload),
            )
            conn.commit()

    def get_workspace(self, workspace_id: UUID) -> Workspace | None:
        with self._lock, sqlite3.connect(self.path) as conn:
            row = conn.execute(
                "SELECT payload FROM workspaces WHERE id = ?",
                (str(workspace_id),),
            ).fetchone()
        if not row:
            return None
        try:
            return Workspace.model_validate_json(row[0])
        except Exception:
            return None

    def list_workspaces_for_account(self, account_id: UUID) -> list[Workspace]:
        with self._lock, sqlite3.connect(self.path) as conn:
            rows = conn.execute("SELECT payload FROM workspaces").fetchall()
        result: list[Workspace] = []
        for (payload,) in rows:
            try:
                workspace = Workspace.model_validate_json(payload)
            except Exception:
                continue
            if any(member.account_id == account_id for member in workspace.members):
                result.append(workspace)
        return result

    def save_workspace(self, workspace: Workspace) -> None:
        payload = workspace.model_dump_json(indent=2)
        with self._lock, sqlite3.connect(self.path) as conn:
            conn.execute(
                "INSERT OR REPLACE INTO workspaces (id, payload) VALUES (?, ?)",
                (str(workspace.id), payload),
            )
            conn.commit()

    def get_session(self, token_hash: str) -> WorkspaceSession | None:
        with self._lock, sqlite3.connect(self.path) as conn:
            row = conn.execute(
                "SELECT payload FROM workspace_sessions WHERE token_hash = ?",
                (token_hash,),
            ).fetchone()
        if not row:
            return None
        try:
            return WorkspaceSession.model_validate_json(row[0])
        except Exception:
            return None

    def save_session(self, session: WorkspaceSession) -> None:
        payload = session.model_dump_json(indent=2)
        with self._lock, sqlite3.connect(self.path) as conn:
            conn.execute(
                "INSERT OR REPLACE INTO workspace_sessions (token_hash, payload) VALUES (?, ?)",
                (session.token_hash, payload),
            )
            conn.commit()

    def delete_session(self, token_hash: str) -> None:
        with self._lock, sqlite3.connect(self.path) as conn:
            conn.execute(
                "DELETE FROM workspace_sessions WHERE token_hash = ?",
                (token_hash,),
            )
            conn.commit()

    def get_email_challenge(self, token_hash: str) -> EmailChallenge | None:
        with self._lock, sqlite3.connect(self.path) as conn:
            row = conn.execute(
                "SELECT payload FROM email_challenges WHERE token_hash = ?",
                (token_hash,),
            ).fetchone()
        if not row:
            return None
        try:
            return EmailChallenge.model_validate_json(row[0])
        except Exception:
            return None

    def save_email_challenge(self, challenge: EmailChallenge) -> None:
        payload = challenge.model_dump_json(indent=2)
        with self._lock, sqlite3.connect(self.path) as conn:
            conn.execute(
                "INSERT OR REPLACE INTO email_challenges (token_hash, payload) VALUES (?, ?)",
                (challenge.token_hash, payload),
            )
            conn.commit()

    def get_invite_by_id(self, invite_id: UUID) -> WorkspaceInvite | None:
        with self._lock, sqlite3.connect(self.path) as conn:
            row = conn.execute(
                "SELECT payload FROM workspace_invites WHERE id = ?",
                (str(invite_id),),
            ).fetchone()
        if not row:
            return None
        try:
            return WorkspaceInvite.model_validate_json(row[0])
        except Exception:
            return None

    def get_invite_by_token_hash(self, token_hash: str) -> WorkspaceInvite | None:
        with self._lock, sqlite3.connect(self.path) as conn:
            row = conn.execute(
                "SELECT payload FROM workspace_invites WHERE token_hash = ?",
                (token_hash,),
            ).fetchone()
        if not row:
            return None
        try:
            return WorkspaceInvite.model_validate_json(row[0])
        except Exception:
            return None

    def list_invites_for_workspace(self, workspace_id: UUID) -> list[WorkspaceInvite]:
        with self._lock, sqlite3.connect(self.path) as conn:
            rows = conn.execute(
                "SELECT payload FROM workspace_invites WHERE workspace_id = ?",
                (str(workspace_id),),
            ).fetchall()
        result: list[WorkspaceInvite] = []
        for (payload,) in rows:
            try:
                result.append(WorkspaceInvite.model_validate_json(payload))
            except Exception:
                continue
        return result

    def save_invite(self, invite: WorkspaceInvite) -> None:
        payload = invite.model_dump_json(indent=2)
        with self._lock, sqlite3.connect(self.path) as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO workspace_invites (id, workspace_id, token_hash, payload)
                VALUES (?, ?, ?, ?)
                """,
                (str(invite.id), str(invite.workspace_id), invite.token_hash, payload),
            )
            conn.commit()
