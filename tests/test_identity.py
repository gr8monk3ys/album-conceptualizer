"""Tests for identity and workspace token endpoints."""

from __future__ import annotations

from fastapi.testclient import TestClient

from album_conceptualizer.api.app import create_app
from album_conceptualizer.api.deps import hash_token
from album_conceptualizer.config import reset_settings


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

    switched = client.get("/api/v1/identity/me", headers={"Authorization": f"Bearer {second_token}"})
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
