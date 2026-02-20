"""Tests for identity and workspace token endpoints."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from album_conceptualizer.api.app import create_app
from album_conceptualizer.api.deps import hash_token
from album_conceptualizer.api.v1 import identity as identity_api
from album_conceptualizer.config import reset_settings
from album_conceptualizer.identity_state import InMemoryIdentityStateStore
from album_conceptualizer.models.identity import (
    Account,
    Workspace,
    WorkspaceInvite,
    WorkspaceMember,
    WorkspaceRole,
    WorkspaceSession,
)


def _register(client: TestClient, email: str = "creator@example.com") -> dict:
    response = client.post(
        "/api/v1/identity/register",
        json={"email": email, "display_name": "Creator", "workspace_name": "Studio One"},
    )
    assert response.status_code == 200
    return response.json()


def test_register_and_me_flow(monkeypatch):
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_API_KEY", "secret")
    reset_settings()

    app = create_app()
    client = TestClient(app)

    payload = _register(client)
    token = payload["token"]

    me = client.get("/api/v1/identity/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    me_payload = me.json()
    assert me_payload["email"] == "creator@example.com"
    assert me_payload["workspace"]["name"] == "Studio One"

    listed = client.get("/api/v1/identity/workspaces", headers={"Authorization": f"Bearer {token}"})
    assert listed.status_code == 200
    assert listed.json()["total"] == 1

    session = app.state.identity_store.get_session(hash_token(token))
    assert session is not None


def test_create_workspace_and_issue_token(monkeypatch):
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_API_KEY", "secret")
    reset_settings()

    client = TestClient(create_app())
    payload = _register(client)
    base_token = payload["token"]

    created = client.post(
        "/api/v1/identity/workspaces",
        headers={"Authorization": f"Bearer {base_token}"},
        json={"name": "Collab Lab"},
    )
    assert created.status_code == 200
    created_payload = created.json()
    workspace_id = created_payload["workspace"]["id"]
    workspace_token = created_payload["token"]

    me_workspace = client.get(
        "/api/v1/identity/me",
        headers={"Authorization": f"Bearer {workspace_token}"},
    )
    assert me_workspace.status_code == 200
    assert me_workspace.json()["workspace"]["id"] == workspace_id

    issued = client.post(
        f"/api/v1/identity/workspaces/{workspace_id}/tokens",
        headers={"Authorization": f"Bearer {base_token}"},
        json={},
    )
    assert issued.status_code == 200
    second_token = issued.json()["token"]

    switched = client.get(
        "/api/v1/identity/me", headers={"Authorization": f"Bearer {second_token}"}
    )
    assert switched.status_code == 200
    assert switched.json()["workspace"]["id"] == workspace_id


def test_magic_link_request_and_consume_flow(monkeypatch):
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_API_KEY", "secret")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_IDENTITY_DEBUG_TOKENS", "true")
    reset_settings()

    app = create_app()
    client = TestClient(app)

    requested = client.post(
        "/api/v1/identity/magic-links/request",
        json={"email": "magic@example.com"},
    )
    assert requested.status_code == 200
    request_payload = requested.json()
    assert request_payload["sent"] is True
    assert request_payload["debug_token"]

    consumed = client.post(
        "/api/v1/identity/magic-links/consume",
        json={"token": request_payload["debug_token"], "display_name": "Magic User"},
    )
    assert consumed.status_code == 200
    consume_payload = consumed.json()
    assert consume_payload["email"] == "magic@example.com"
    assert consume_payload["email_verified"] is True
    assert consume_payload["token"]

    me = client.get(
        "/api/v1/identity/me",
        headers={"Authorization": f"Bearer {consume_payload['token']}"},
    )
    assert me.status_code == 200
    assert me.json()["email_verified"] is True


def test_workspace_invite_lifecycle(monkeypatch):
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_API_KEY", "secret")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_IDENTITY_DEBUG_TOKENS", "true")
    reset_settings()

    client = TestClient(create_app())
    owner = _register(client, email="owner@example.com")
    owner_token = owner["token"]
    workspace_id = owner["workspace"]["id"]

    created = client.post(
        f"/api/v1/identity/workspaces/{workspace_id}/invites",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"email": "collab@example.com", "role": "editor"},
    )
    assert created.status_code == 200
    created_payload = created.json()
    assert created_payload["workspace_id"] == workspace_id
    assert created_payload["debug_token"]

    listed_before = client.get(
        f"/api/v1/identity/workspaces/{workspace_id}/invites",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert listed_before.status_code == 200
    assert listed_before.json()["total"] == 1
    assert listed_before.json()["items"][0]["status"] == "pending"

    accepted = client.post(
        "/api/v1/identity/invites/accept",
        json={"token": created_payload["debug_token"], "display_name": "Collab User"},
    )
    assert accepted.status_code == 200
    accepted_payload = accepted.json()
    assert accepted_payload["email"] == "collab@example.com"
    assert accepted_payload["workspace"]["id"] == workspace_id
    assert accepted_payload["email_verified"] is True

    listed_after = client.get(
        f"/api/v1/identity/workspaces/{workspace_id}/invites",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert listed_after.status_code == 200
    assert listed_after.json()["items"][0]["status"] == "accepted"


def test_magic_link_returns_503_when_email_sender_fails(monkeypatch):
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_API_KEY", "secret")
    reset_settings()

    app = create_app()

    class _FailingSender:
        def send(self, *, to_email: str, subject: str, body: str) -> None:
            raise RuntimeError("smtp unavailable")

    app.state.email_sender = _FailingSender()
    client = TestClient(app)

    response = client.post(
        "/api/v1/identity/magic-links/request",
        json={"email": "broken-mail@example.com"},
    )
    assert response.status_code == 503
    assert response.json()["detail"] == "Unable to send verification email"


def test_normalize_email_rejects_invalid_input():
    with pytest.raises(HTTPException) as exc_info:
        identity_api._normalize_email("not-an-email")

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail == "Invalid email"


def test_invite_status_reports_revoked_and_expired_states():
    base = WorkspaceInvite(
        workspace_id=uuid4(),
        invited_email="invitee@example.com",
        invited_by_account_id=uuid4(),
        token_hash="tok_hash",
        expires_at=datetime.now(UTC) + timedelta(hours=1),
    )
    revoked = base.model_copy(update={"revoked_at": datetime.now(UTC)})
    expired = base.model_copy(update={"expires_at": datetime.now(UTC) - timedelta(minutes=1)})

    assert identity_api._invite_status(revoked) == "revoked"
    assert identity_api._invite_status(expired) == "expired"


def test_get_email_sender_raises_when_sender_missing():
    request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace()))

    with pytest.raises(HTTPException) as exc_info:
        identity_api._get_email_sender(request)

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail == "Email sender unavailable"


def test_build_token_link_falls_back_to_token_for_invalid_template():
    token = "debug-token"
    assert identity_api._build_token_link("{bad-template", token) == token


def test_workspace_summary_requires_membership():
    account_id = uuid4()
    workspace = Workspace(
        name="No Access Workspace",
        created_by=uuid4(),
        members=[WorkspaceMember(account_id=uuid4(), role=WorkspaceRole.OWNER)],
    )

    with pytest.raises(HTTPException) as exc_info:
        identity_api._workspace_summary(workspace, account_id)

    assert exc_info.value.status_code == 403


def test_get_store_raises_when_identity_store_missing():
    request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace()))

    with pytest.raises(HTTPException) as exc_info:
        identity_api._get_store(request)

    assert exc_info.value.status_code == 503


def test_resolve_caller_missing_bearer_token_raises():
    request = SimpleNamespace(
        app=SimpleNamespace(state=SimpleNamespace(identity_store=InMemoryIdentityStateStore()))
    )

    with pytest.raises(HTTPException) as exc_info:
        identity_api._resolve_caller(request, authorization=None)

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Missing bearer token"


def test_resolve_caller_rejects_invalid_or_expired_session(monkeypatch):
    request = SimpleNamespace(
        app=SimpleNamespace(state=SimpleNamespace(identity_store=InMemoryIdentityStateStore()))
    )
    monkeypatch.setattr(identity_api, "resolve_workspace_session", lambda request, token: None)

    with pytest.raises(HTTPException) as exc_info:
        identity_api._resolve_caller(request, authorization="Bearer token")

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Invalid or expired token"


def test_resolve_caller_rejects_invalid_session_when_account_or_workspace_missing(monkeypatch):
    store = InMemoryIdentityStateStore()
    request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(identity_store=store)))
    session = WorkspaceSession(
        token_hash="tok",
        account_id=uuid4(),
        workspace_id=uuid4(),
    )
    monkeypatch.setattr(identity_api, "resolve_workspace_session", lambda request, token: session)

    with pytest.raises(HTTPException) as exc_info:
        identity_api._resolve_caller(request, authorization="Bearer token")

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Invalid session"


def test_resolve_caller_rejects_non_member_workspace(monkeypatch):
    account = Account(email="member-check@example.com")
    workspace = Workspace(
        name="Detached Workspace",
        created_by=uuid4(),
        members=[WorkspaceMember(account_id=uuid4(), role=WorkspaceRole.OWNER)],
    )
    store = InMemoryIdentityStateStore()
    store.save_account(account)
    store.save_workspace(workspace)
    request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(identity_store=store)))
    session = WorkspaceSession(
        token_hash="tok",
        account_id=account.id,
        workspace_id=workspace.id,
    )
    monkeypatch.setattr(identity_api, "resolve_workspace_session", lambda request, token: session)

    with pytest.raises(HTTPException) as exc_info:
        identity_api._resolve_caller(request, authorization="Bearer token")

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Not a workspace member"


def test_register_reuses_existing_workspace_when_name_not_provided(monkeypatch):
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_API_KEY", "secret")
    reset_settings()
    client = TestClient(create_app())

    first = _register(client, email="repeat@example.com")
    workspace_id = first["workspace"]["id"]

    second = client.post(
        "/api/v1/identity/register",
        json={"email": "repeat@example.com", "display_name": "Repeat"},
    )
    assert second.status_code == 200
    assert second.json()["workspace"]["id"] == workspace_id


def test_magic_link_consume_rejects_invalid_token(monkeypatch):
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_API_KEY", "secret")
    reset_settings()
    client = TestClient(create_app())

    response = client.post(
        "/api/v1/identity/magic-links/consume",
        json={"token": "invalid-token", "display_name": "Nope"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or expired magic link"


def test_magic_link_consume_invite_flow_marks_invite_accepted(monkeypatch):
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_API_KEY", "secret")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_IDENTITY_DEBUG_TOKENS", "true")
    reset_settings()
    app = create_app()
    client = TestClient(app)

    owner = _register(client, email="owner-consume@example.com")
    workspace_id = owner["workspace"]["id"]
    owner_token = owner["token"]
    created = client.post(
        f"/api/v1/identity/workspaces/{workspace_id}/invites",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"email": "invite-consume@example.com", "role": "editor"},
    )
    assert created.status_code == 200
    debug_token = created.json()["debug_token"]
    assert debug_token

    consumed = client.post(
        "/api/v1/identity/magic-links/consume",
        json={"token": debug_token, "display_name": "Invite Consume"},
    )
    assert consumed.status_code == 200
    assert consumed.json()["workspace"]["id"] == workspace_id

    invite = app.state.identity_store.get_invite_by_token_hash(hash_token(debug_token))
    assert invite is not None
    assert invite.accepted_at is not None
    assert invite.accepted_account_id is not None


def test_magic_link_consume_signin_uses_existing_workspace(monkeypatch):
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_API_KEY", "secret")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_IDENTITY_DEBUG_TOKENS", "true")
    reset_settings()
    client = TestClient(create_app())

    existing = _register(client, email="existing-signin@example.com")
    workspace_id = existing["workspace"]["id"]

    requested = client.post(
        "/api/v1/identity/magic-links/request",
        json={"email": "existing-signin@example.com"},
    )
    assert requested.status_code == 200
    token = requested.json()["debug_token"]
    assert token

    consumed = client.post(
        "/api/v1/identity/magic-links/consume",
        json={"token": token, "display_name": "Existing"},
    )
    assert consumed.status_code == 200
    assert consumed.json()["workspace"]["id"] == workspace_id


def test_issue_workspace_token_returns_404_for_unknown_workspace(monkeypatch):
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_API_KEY", "secret")
    reset_settings()
    client = TestClient(create_app())
    payload = _register(client, email="token-404@example.com")

    response = client.post(
        f"/api/v1/identity/workspaces/{uuid4()}/tokens",
        headers={"Authorization": f"Bearer {payload['token']}"},
        json={},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Workspace not found"


def test_issue_workspace_token_returns_403_for_non_member(monkeypatch):
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_API_KEY", "secret")
    reset_settings()
    client = TestClient(create_app())
    owner = _register(client, email="member-a@example.com")
    other = _register(client, email="member-b@example.com")
    other_workspace = other["workspace"]["id"]

    response = client.post(
        f"/api/v1/identity/workspaces/{other_workspace}/tokens",
        headers={"Authorization": f"Bearer {owner['token']}"},
        json={},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Not a workspace member"


def test_create_workspace_invite_validation_errors(monkeypatch):
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_API_KEY", "secret")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_IDENTITY_DEBUG_TOKENS", "true")
    reset_settings()
    client = TestClient(create_app())
    owner = _register(client, email="owner-validate@example.com")
    workspace_id = owner["workspace"]["id"]
    owner_token = owner["token"]

    missing_workspace = client.post(
        f"/api/v1/identity/workspaces/{uuid4()}/invites",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"email": "x@example.com", "role": "editor"},
    )
    assert missing_workspace.status_code == 404

    owner_role = client.post(
        f"/api/v1/identity/workspaces/{workspace_id}/invites",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"email": "owner-role@example.com", "role": "owner"},
    )
    assert owner_role.status_code == 400
    assert owner_role.json()["detail"] == "Owner role cannot be granted via invite"

    self_invite = client.post(
        f"/api/v1/identity/workspaces/{workspace_id}/invites",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"email": "owner-validate@example.com", "role": "editor"},
    )
    assert self_invite.status_code == 400
    assert self_invite.json()["detail"] == "Cannot invite yourself"


def test_create_workspace_invite_returns_403_for_viewer(monkeypatch):
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_API_KEY", "secret")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_IDENTITY_DEBUG_TOKENS", "true")
    reset_settings()
    client = TestClient(create_app())
    owner = _register(client, email="owner-viewer@example.com")
    workspace_id = owner["workspace"]["id"]
    owner_token = owner["token"]

    invite_viewer = client.post(
        f"/api/v1/identity/workspaces/{workspace_id}/invites",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"email": "viewer@example.com", "role": "viewer"},
    )
    assert invite_viewer.status_code == 200
    viewer_token = client.post(
        "/api/v1/identity/invites/accept",
        json={"token": invite_viewer.json()["debug_token"], "display_name": "Viewer"},
    ).json()["token"]

    forbidden = client.post(
        f"/api/v1/identity/workspaces/{workspace_id}/invites",
        headers={"Authorization": f"Bearer {viewer_token}"},
        json={"email": "other@example.com", "role": "editor"},
    )
    assert forbidden.status_code == 403
    assert forbidden.json()["detail"] == "Only owner/editor members can create invites"


def test_accept_invite_error_paths(monkeypatch):
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_API_KEY", "secret")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_IDENTITY_DEBUG_TOKENS", "true")
    reset_settings()
    app = create_app()
    client = TestClient(app)
    owner = _register(client, email="owner-errors@example.com")
    workspace_id = owner["workspace"]["id"]
    owner_token = owner["token"]

    invalid = client.post(
        "/api/v1/identity/invites/accept",
        json={"token": "invalid-token", "display_name": "Nope"},
    )
    assert invalid.status_code == 401

    created = client.post(
        f"/api/v1/identity/workspaces/{workspace_id}/invites",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"email": "revoked@example.com", "role": "editor"},
    )
    assert created.status_code == 200
    token = created.json()["debug_token"]
    token_hash = hash_token(token)

    invite = app.state.identity_store.get_invite_by_token_hash(token_hash)
    assert invite is not None
    invite.revoked_at = datetime.now(UTC)
    app.state.identity_store.save_invite(invite)

    revoked = client.post(
        "/api/v1/identity/invites/accept",
        json={"token": token, "display_name": "Revoked"},
    )
    assert revoked.status_code == 409
    assert revoked.json()["detail"] == "Invite is no longer valid"

    created_missing_workspace = client.post(
        f"/api/v1/identity/workspaces/{workspace_id}/invites",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"email": "missing-workspace@example.com", "role": "editor"},
    )
    missing_token = created_missing_workspace.json()["debug_token"]
    missing_hash = hash_token(missing_token)
    invite_missing_workspace = app.state.identity_store.get_invite_by_token_hash(missing_hash)
    assert invite_missing_workspace is not None
    invite_missing_workspace.workspace_id = uuid4()
    app.state.identity_store.save_invite(invite_missing_workspace)

    missing_workspace = client.post(
        "/api/v1/identity/invites/accept",
        json={"token": missing_token, "display_name": "Missing Workspace"},
    )
    assert missing_workspace.status_code == 404
    assert missing_workspace.json()["detail"] == "Workspace not found"


def test_list_workspace_invites_error_paths(monkeypatch):
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_API_KEY", "secret")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_IDENTITY_DEBUG_TOKENS", "true")
    reset_settings()
    client = TestClient(create_app())
    owner = _register(client, email="owner-list-errors@example.com")
    workspace_id = owner["workspace"]["id"]
    owner_token = owner["token"]

    missing_workspace = client.get(
        f"/api/v1/identity/workspaces/{uuid4()}/invites",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert missing_workspace.status_code == 404
    assert missing_workspace.json()["detail"] == "Workspace not found"

    invite_viewer = client.post(
        f"/api/v1/identity/workspaces/{workspace_id}/invites",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"email": "viewer-list@example.com", "role": "viewer"},
    )
    viewer_token = client.post(
        "/api/v1/identity/invites/accept",
        json={"token": invite_viewer.json()["debug_token"], "display_name": "Viewer List"},
    ).json()["token"]

    unauthorized = client.get(
        f"/api/v1/identity/workspaces/{workspace_id}/invites",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert unauthorized.status_code == 403
    assert unauthorized.json()["detail"] == "Not authorized"
