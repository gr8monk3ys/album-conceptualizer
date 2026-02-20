"""Tests for File and SQLite identity state storage backends."""

from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

from album_conceptualizer.identity_state import (
    FileIdentityStateStore,
    SQLiteIdentityStateStore,
)
from album_conceptualizer.models.identity import (
    Account,
    EmailChallenge,
    Workspace,
    WorkspaceInvite,
    WorkspaceMember,
    WorkspaceRole,
    WorkspaceSession,
)


# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------


def _account(email: str = "user@example.com") -> Account:
    return Account(email=email, display_name="Test User")


def _workspace(owner_id=None) -> Workspace:
    owner = owner_id or uuid4()
    return Workspace(
        name="Test Workspace",
        created_by=owner,
        members=[WorkspaceMember(account_id=owner, role=WorkspaceRole.OWNER)],
    )


def _session(account_id=None, workspace_id=None) -> WorkspaceSession:
    return WorkspaceSession(
        token_hash="testhash123",
        account_id=account_id or uuid4(),
        workspace_id=workspace_id or uuid4(),
    )


def _challenge(email: str = "user@example.com") -> EmailChallenge:
    return EmailChallenge(
        token_hash="challengehash",
        email=email,
        expires_at=datetime.now(UTC) + timedelta(hours=1),
    )


def _invite(workspace_id=None, invited_by=None) -> WorkspaceInvite:
    return WorkspaceInvite(
        workspace_id=workspace_id or uuid4(),
        invited_email="invitee@example.com",
        invited_by_account_id=invited_by or uuid4(),
        token_hash="invitehash",
        expires_at=datetime.now(UTC) + timedelta(hours=24),
    )


# ---------------------------------------------------------------------------
# Helper to run the same suite against any backend
# ---------------------------------------------------------------------------


def _run_backend_tests(store) -> None:
    """Exercise the full identity state store API contract."""
    account = _account()
    store.save_account(account)

    # get_account
    fetched = store.get_account(account.id)
    assert fetched is not None
    assert fetched.email == account.email

    # get_account_by_email
    fetched_by_email = store.get_account_by_email(account.email)
    assert fetched_by_email is not None
    assert fetched_by_email.id == account.id

    # get_account_by_email - case normalization
    fetched_upper = store.get_account_by_email(account.email.upper())
    assert fetched_upper is not None

    # get_account - missing
    assert store.get_account(uuid4()) is None

    # Workspace CRUD
    workspace = _workspace(owner_id=account.id)
    store.save_workspace(workspace)

    fetched_ws = store.get_workspace(workspace.id)
    assert fetched_ws is not None
    assert fetched_ws.name == workspace.name

    # list_workspaces_for_account
    workspaces = store.list_workspaces_for_account(account.id)
    assert len(workspaces) == 1

    # get_workspace - missing
    assert store.get_workspace(uuid4()) is None

    # Session CRUD
    session = _session(account_id=account.id, workspace_id=workspace.id)
    store.save_session(session)

    fetched_session = store.get_session(session.token_hash)
    assert fetched_session is not None
    assert fetched_session.account_id == session.account_id

    # delete_session
    store.delete_session(session.token_hash)
    assert store.get_session(session.token_hash) is None

    # get_session - missing
    assert store.get_session("no-such-hash") is None

    # EmailChallenge CRUD
    challenge = _challenge()
    store.save_email_challenge(challenge)
    fetched_challenge = store.get_email_challenge(challenge.token_hash)
    assert fetched_challenge is not None
    assert fetched_challenge.email == challenge.email

    # get_email_challenge - missing
    assert store.get_email_challenge("no-hash") is None

    # Invite CRUD
    invite = _invite(workspace_id=workspace.id, invited_by=account.id)
    store.save_invite(invite)

    fetched_invite = store.get_invite_by_id(invite.id)
    assert fetched_invite is not None
    assert fetched_invite.invited_email == invite.invited_email

    fetched_by_token = store.get_invite_by_token_hash(invite.token_hash)
    assert fetched_by_token is not None
    assert fetched_by_token.id == invite.id

    workspace_invites = store.list_invites_for_workspace(workspace.id)
    assert len(workspace_invites) == 1

    # get_invite_by_id - missing
    assert store.get_invite_by_id(uuid4()) is None

    # get_invite_by_token_hash - missing
    assert store.get_invite_by_token_hash("no-token") is None

    # list_invites_for_workspace - empty workspace
    assert store.list_invites_for_workspace(uuid4()) == []


# ---------------------------------------------------------------------------
# FileIdentityStateStore
# ---------------------------------------------------------------------------


class TestFileIdentityStateStore:
    def test_full_crud(self, tmp_path: Path) -> None:
        store = FileIdentityStateStore(root=tmp_path / "identity")
        _run_backend_tests(store)

    def test_corrupt_account_file_skipped(self, tmp_path: Path) -> None:
        root = tmp_path / "identity"
        store = FileIdentityStateStore(root=root)
        # Write corrupt JSON in accounts dir
        (root / "accounts" / "corrupt.json").write_text("{NOT JSON}")
        # Search by email should skip the corrupt file and return None
        result = store.get_account_by_email("test@example.com")
        assert result is None

    def test_corrupt_account_get_returns_none(self, tmp_path: Path) -> None:
        root = tmp_path / "identity"
        store = FileIdentityStateStore(root=root)
        account_id = uuid4()
        (root / "accounts" / f"{account_id}.json").write_text("CORRUPT")
        assert store.get_account(account_id) is None

    def test_corrupt_workspace_file_skipped(self, tmp_path: Path) -> None:
        root = tmp_path / "identity"
        store = FileIdentityStateStore(root=root)
        (root / "workspaces" / "bad.json").write_text("{}")
        # Should return empty list without raising
        result = store.list_workspaces_for_account(uuid4())
        assert result == []

    def test_corrupt_session_returns_none(self, tmp_path: Path) -> None:
        root = tmp_path / "identity"
        store = FileIdentityStateStore(root=root)
        (root / "sessions" / "mytokenhash.json").write_text("NOPE")
        assert store.get_session("mytokenhash") is None

    def test_corrupt_challenge_returns_none(self, tmp_path: Path) -> None:
        root = tmp_path / "identity"
        store = FileIdentityStateStore(root=root)
        (root / "challenges" / "mychallenge.json").write_text("{bad}")
        assert store.get_email_challenge("mychallenge") is None

    def test_corrupt_invite_file_skipped(self, tmp_path: Path) -> None:
        root = tmp_path / "identity"
        store = FileIdentityStateStore(root=root)
        (root / "invites" / "bad.json").write_text("GARBAGE")
        # Should not raise; corrupt invite skipped
        result = store.list_invites_for_workspace(uuid4())
        assert result == []

    def test_corrupt_invite_by_token_skipped(self, tmp_path: Path) -> None:
        root = tmp_path / "identity"
        store = FileIdentityStateStore(root=root)
        (root / "invites" / "bad.json").write_text("GARBAGE")
        assert store.get_invite_by_token_hash("sometoken") is None

    def test_delete_session_nonexistent_is_noop(self, tmp_path: Path) -> None:
        store = FileIdentityStateStore(root=tmp_path / "identity")
        store.delete_session("ghost-hash")  # must not raise


# ---------------------------------------------------------------------------
# SQLiteIdentityStateStore
# ---------------------------------------------------------------------------


class TestSQLiteIdentityStateStore:
    def test_full_crud(self, tmp_path: Path) -> None:
        store = SQLiteIdentityStateStore(path=tmp_path / "identity.db")
        _run_backend_tests(store)

    def test_save_account_overwrites(self, tmp_path: Path) -> None:
        store = SQLiteIdentityStateStore(path=tmp_path / "identity.db")
        account = _account("original@example.com")
        store.save_account(account)
        account.display_name = "Updated Name"
        store.save_account(account)
        fetched = store.get_account(account.id)
        assert fetched.display_name == "Updated Name"

    def test_list_workspaces_filters_by_membership(self, tmp_path: Path) -> None:
        store = SQLiteIdentityStateStore(path=tmp_path / "identity.db")
        acct1 = _account("a@x.com")
        acct2 = _account("b@x.com")
        store.save_account(acct1)
        store.save_account(acct2)

        ws1 = _workspace(owner_id=acct1.id)
        ws2 = _workspace(owner_id=acct2.id)
        store.save_workspace(ws1)
        store.save_workspace(ws2)

        workspaces_for_acct1 = store.list_workspaces_for_account(acct1.id)
        assert len(workspaces_for_acct1) == 1
        assert workspaces_for_acct1[0].id == ws1.id

    def test_multiple_invites_for_workspace(self, tmp_path: Path) -> None:
        store = SQLiteIdentityStateStore(path=tmp_path / "identity.db")
        ws_id = uuid4()
        by_id = uuid4()

        for i in range(3):
            invite = WorkspaceInvite(
                workspace_id=ws_id,
                invited_email=f"user{i}@example.com",
                invited_by_account_id=by_id,
                token_hash=f"token-hash-{i}",
                expires_at=datetime.now(UTC) + timedelta(hours=24),
            )
            store.save_invite(invite)

        invites = store.list_invites_for_workspace(ws_id)
        assert len(invites) == 3

    def test_session_expiry_preserved(self, tmp_path: Path) -> None:
        store = SQLiteIdentityStateStore(path=tmp_path / "identity.db")
        expiry = datetime.now(UTC) + timedelta(hours=8)
        session = WorkspaceSession(
            token_hash="expiry-hash",
            account_id=uuid4(),
            workspace_id=uuid4(),
            expires_at=expiry,
        )
        store.save_session(session)
        fetched = store.get_session("expiry-hash")
        assert fetched.expires_at is not None
        assert fetched.is_active()

    def test_list_invites_empty_workspace(self, tmp_path: Path) -> None:
        store = SQLiteIdentityStateStore(path=tmp_path / "identity.db")
        assert store.list_invites_for_workspace(uuid4()) == []
