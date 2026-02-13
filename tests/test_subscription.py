from uuid import UUID

from fastapi.testclient import TestClient

from album_conceptualizer.api.app import create_app
from album_conceptualizer.api.deps import hash_api_key
from album_conceptualizer.config import reset_settings
from album_conceptualizer.models.subscription import (
    AccountSubscription,
    BillingPlan,
    SubscriptionStatus,
)


def test_subscription_gate_blocks_protected_routes(monkeypatch):
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_API_KEY", "secret")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_SUBSCRIPTION_REQUIRED", "true")
    reset_settings()

    client = TestClient(create_app())
    response = client.get("/api/v1/albums", headers={"X-API-Key": "secret"})
    assert response.status_code == 402
    assert response.json()["detail"] == "Active subscription required"


def test_subscription_gate_allows_active_subscription(monkeypatch):
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_API_KEY", "secret")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_SUBSCRIPTION_REQUIRED", "true")
    reset_settings()

    app = create_app()
    app.state.subscription_store.save(
        AccountSubscription(
            api_key_hash=hash_api_key("secret"),
            plan=BillingPlan.PRO,
            status=SubscriptionStatus.ACTIVE,
        )
    )
    client = TestClient(app)

    response = client.get("/api/v1/albums", headers={"X-API-Key": "secret"})
    assert response.status_code == 200


def test_billing_subscription_endpoint_accessible_without_active_plan(monkeypatch):
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_API_KEY", "secret")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_SUBSCRIPTION_REQUIRED", "true")
    reset_settings()

    client = TestClient(create_app())
    response = client.get("/api/v1/billing/subscription", headers={"X-API-Key": "secret"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["plan"] == "free"
    assert payload["status"] == "inactive"


def test_subscription_gate_blocks_workspace_token_without_subscription(monkeypatch):
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_API_KEY", "secret")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_SUBSCRIPTION_REQUIRED", "true")
    reset_settings()

    client = TestClient(create_app())
    identity = client.post(
        "/api/v1/identity/register",
        json={"email": "gate@example.com", "display_name": "Gate User"},
    )
    assert identity.status_code == 200
    token = identity.json()["token"]

    response = client.get("/api/v1/albums", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 402
    assert response.json()["detail"] == "Active subscription required"


def test_subscription_gate_allows_workspace_subject_subscription(monkeypatch):
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_API_KEY", "secret")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_SUBSCRIPTION_REQUIRED", "true")
    reset_settings()

    app = create_app()
    client = TestClient(app)
    identity = client.post(
        "/api/v1/identity/register",
        json={"email": "paid@example.com", "display_name": "Paid User"},
    )
    assert identity.status_code == 200
    token = identity.json()["token"]
    workspace_id = identity.json()["workspace"]["id"]

    app.state.subscription_store.save(
        AccountSubscription(
            api_key_hash=f"workspace:{workspace_id}",
            workspace_id=UUID(workspace_id),
            plan=BillingPlan.PRO,
            status=SubscriptionStatus.ACTIVE,
        )
    )

    response = client.get("/api/v1/albums", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
