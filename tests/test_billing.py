"""Tests for billing and subscription API endpoints."""

from __future__ import annotations

import sys
from datetime import UTC, datetime
from types import ModuleType, SimpleNamespace
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from album_conceptualizer.api.app import create_app
from album_conceptualizer.api.deps import hash_api_key
from album_conceptualizer.api.v1 import billing as billing_api
from album_conceptualizer.config import reset_settings
from album_conceptualizer.models.subscription import (
    AccountSubscription,
    BillingPlan,
    SubscriptionStatus,
)
from album_conceptualizer.storage import InMemorySubscriptionStore


def _build_client(
    monkeypatch,
    *,
    api_key: str | None = "secret",
    billing_provider: str = "stripe",
    stripe_secret_key: str | None = None,
    stripe_webhook_secret: str | None = None,
    stripe_price_id_pro: str | None = None,
    stripe_price_id_team: str | None = None,
) -> tuple[object, TestClient]:
    if api_key is None:
        monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEY", raising=False)
    else:
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_API_KEY", api_key)
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEYS", raising=False)

    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_BILLING_PROVIDER", billing_provider)
    if stripe_secret_key is None:
        monkeypatch.delenv("STRIPE_SECRET_KEY", raising=False)
    else:
        monkeypatch.setenv("STRIPE_SECRET_KEY", stripe_secret_key)

    if stripe_webhook_secret is None:
        monkeypatch.delenv("STRIPE_WEBHOOK_SECRET", raising=False)
    else:
        monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", stripe_webhook_secret)
    if stripe_price_id_pro is None:
        monkeypatch.delenv("ALBUM_CONCEPTUALIZER_STRIPE_PRICE_ID_PRO", raising=False)
    else:
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_STRIPE_PRICE_ID_PRO", stripe_price_id_pro)
    if stripe_price_id_team is None:
        monkeypatch.delenv("ALBUM_CONCEPTUALIZER_STRIPE_PRICE_ID_TEAM", raising=False)
    else:
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_STRIPE_PRICE_ID_TEAM", stripe_price_id_team)

    reset_settings()
    app = create_app()
    return app, TestClient(app)


def _install_fake_stripe(
    monkeypatch,
    *,
    checkout_url: str | None = "https://billing.example/checkout",
    checkout_id: str = "cs_test_123",
    customer_id: str = "cus_test_123",
    webhook_event: dict | None = None,
    webhook_error: Exception | None = None,
    customer_error: Exception | None = None,
    session_error: Exception | None = None,
) -> dict[str, object]:
    fake_stripe = ModuleType("stripe")
    calls: dict[str, object] = {
        "customer_create": 0,
        "session_create": 0,
        "last_session_kwargs": None,
    }

    class _Customer:
        @staticmethod
        def create(**kwargs):
            if customer_error:
                raise customer_error
            calls["customer_create"] += 1
            return SimpleNamespace(id=customer_id, **kwargs)

    class _Session:
        @staticmethod
        def create(**kwargs):
            if session_error:
                raise session_error
            calls["session_create"] += 1
            calls["last_session_kwargs"] = kwargs
            return SimpleNamespace(id=checkout_id, url=checkout_url, **kwargs)

    class _Webhook:
        @staticmethod
        def construct_event(payload, sig_header, secret):
            if webhook_error:
                raise webhook_error
            return webhook_event or {"type": "noop", "data": {"object": {}}}

    fake_stripe.api_key = None
    fake_stripe.Customer = _Customer
    fake_stripe.checkout = SimpleNamespace(Session=_Session)
    fake_stripe.Webhook = _Webhook
    monkeypatch.setitem(sys.modules, "stripe", fake_stripe)
    return calls


class _FakeWebhookRequest:
    def __init__(
        self,
        *,
        store: InMemorySubscriptionStore,
        signature: str | None = "t=1,v1=test",
        payload: bytes = b"{}",
    ) -> None:
        self.app = SimpleNamespace(state=SimpleNamespace(subscription_store=store))
        self._payload = payload
        self.headers: dict[str, str] = {}
        if signature is not None:
            self.headers["stripe-signature"] = signature

    async def body(self) -> bytes:
        return self._payload


def test_get_subscription_accepts_bearer_token(monkeypatch):
    app, client = _build_client(monkeypatch)
    response = client.get(
        "/api/v1/billing/subscription", headers={"Authorization": "Bearer secret"}
    )
    assert response.status_code == 200

    payload = response.json()
    assert payload["plan"] == BillingPlan.FREE.value
    assert payload["status"] == SubscriptionStatus.INACTIVE.value

    record = app.state.subscription_store.get(hash_api_key("secret"))
    assert record is not None


def test_workspace_token_uses_workspace_subject_key(monkeypatch):
    app, client = _build_client(monkeypatch)
    identity = client.post(
        "/api/v1/identity/register",
        json={"email": "billing@example.com", "display_name": "Billing User"},
    )
    assert identity.status_code == 200
    token = identity.json()["token"]
    workspace_id = identity.json()["workspace"]["id"]

    response = client.get(
        "/api/v1/billing/subscription", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200

    payload = response.json()
    assert payload["subject_key"] == f"workspace:{workspace_id}"
    assert payload["workspace_id"] == workspace_id

    record = app.state.subscription_store.get(f"workspace:{workspace_id}")
    assert record is not None
    assert record.workspace_id == UUID(workspace_id)


def test_checkout_session_rejects_unsupported_provider(monkeypatch):
    _, client = _build_client(
        monkeypatch,
        billing_provider="mock",
        stripe_secret_key="sk_test_123",
    )
    response = client.post(
        "/api/v1/billing/checkout-session",
        headers={"X-API-Key": "secret"},
        json={"plan": "pro", "price_id": "price_pro_123"},
    )
    assert response.status_code == 501


def test_checkout_session_requires_stripe_secret(monkeypatch):
    _, client = _build_client(monkeypatch)
    response = client.post(
        "/api/v1/billing/checkout-session",
        headers={"X-API-Key": "secret"},
        json={"plan": "pro", "price_id": "price_pro_123"},
    )
    assert response.status_code == 503


def test_checkout_session_requires_price_for_free_plan(monkeypatch):
    _, client = _build_client(monkeypatch, stripe_secret_key="sk_test_123")
    response = client.post(
        "/api/v1/billing/checkout-session",
        headers={"X-API-Key": "secret"},
        json={"plan": "free"},
    )
    assert response.status_code == 400


def test_checkout_session_requires_token_when_api_auth_not_enabled(monkeypatch):
    _, client = _build_client(
        monkeypatch,
        api_key=None,
        stripe_secret_key="sk_test_123",
    )
    response = client.post(
        "/api/v1/billing/checkout-session",
        json={"plan": "pro", "price_id": "price_pro_123"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Missing API key"


def test_checkout_session_creates_and_reuses_customer(monkeypatch):
    app, client = _build_client(monkeypatch, stripe_secret_key="sk_test_123")
    calls = _install_fake_stripe(monkeypatch)

    first = client.post(
        "/api/v1/billing/checkout-session",
        headers={"X-API-Key": "secret"},
        json={"plan": "pro", "price_id": "price_pro_123", "quantity": 2},
    )
    second = client.post(
        "/api/v1/billing/checkout-session",
        headers={"X-API-Key": "secret"},
        json={"plan": "pro", "price_id": "price_pro_123", "quantity": 1},
    )

    assert first.status_code == 200
    assert first.json()["session_id"] == "cs_test_123"
    assert first.json()["url"] == "https://billing.example/checkout"
    assert second.status_code == 200

    assert calls["customer_create"] == 1
    assert calls["session_create"] == 2

    record = app.state.subscription_store.get(hash_api_key("secret"))
    assert record is not None
    assert record.plan == BillingPlan.PRO
    assert record.stripe_customer_id == "cus_test_123"


def test_checkout_session_uses_configured_plan_price_id(monkeypatch):
    _, client = _build_client(
        monkeypatch,
        stripe_secret_key="sk_test_123",
        stripe_price_id_pro="price_cfg_pro_123",
    )
    calls = _install_fake_stripe(monkeypatch)
    response = client.post(
        "/api/v1/billing/checkout-session",
        headers={"X-API-Key": "secret"},
        json={"plan": "pro"},
    )
    assert response.status_code == 200
    assert calls["last_session_kwargs"] is not None
    assert calls["last_session_kwargs"]["line_items"][0]["price"] == "price_cfg_pro_123"


def test_checkout_session_returns_502_when_stripe_has_no_checkout_url(monkeypatch):
    _, client = _build_client(monkeypatch, stripe_secret_key="sk_test_123")
    _install_fake_stripe(monkeypatch, checkout_url=None)

    response = client.post(
        "/api/v1/billing/checkout-session",
        headers={"X-API-Key": "secret"},
        json={"plan": "pro", "price_id": "price_pro_123"},
    )
    assert response.status_code == 502


def test_checkout_session_returns_502_when_stripe_request_errors(monkeypatch):
    _, client = _build_client(monkeypatch, stripe_secret_key="sk_test_123")
    _install_fake_stripe(monkeypatch, session_error=RuntimeError("auth failed"))

    response = client.post(
        "/api/v1/billing/checkout-session",
        headers={"X-API-Key": "secret"},
        json={"plan": "pro", "price_id": "price_pro_123"},
    )
    assert response.status_code == 502
    assert response.json()["detail"] == "Stripe checkout request failed"


def test_parse_uuid_returns_none_for_non_uuid_values():
    assert billing_api._parse_uuid(12345) is None
    assert billing_api._parse_uuid("not-a-uuid") is None


def test_get_or_create_record_updates_workspace_for_existing_subject():
    store = InMemorySubscriptionStore()
    subject_key = "subject-key"
    old_workspace = uuid4()
    new_workspace = uuid4()
    existing = AccountSubscription(api_key_hash=subject_key, workspace_id=old_workspace)
    store.save(existing)

    record = billing_api._get_or_create_record(
        store,
        subject_key,
        workspace_id=new_workspace,
        account_id=None,
    )

    assert record.workspace_id == new_workspace


def test_status_and_lookup_helpers_handle_missing_values():
    store = InMemorySubscriptionStore()
    store.save(AccountSubscription(api_key_hash="sub-a", stripe_customer_id="cus_a"))

    assert billing_api._status_from_stripe(None) == SubscriptionStatus.INACTIVE
    assert billing_api._find_by_customer_id(store, None) is None
    assert billing_api._find_by_customer_id(store, "cus_missing") is None


def test_get_subscription_requires_auth_token(monkeypatch):
    _, client = _build_client(monkeypatch, api_key=None)
    response = client.get("/api/v1/billing/subscription")
    assert response.status_code == 401
    assert response.json()["detail"] == "Missing API key"


def test_checkout_session_returns_501_when_stripe_sdk_unavailable(monkeypatch):
    _, client = _build_client(monkeypatch, stripe_secret_key="sk_test_123")
    monkeypatch.setitem(sys.modules, "stripe", None)
    response = client.post(
        "/api/v1/billing/checkout-session",
        headers={"X-API-Key": "secret"},
        json={"plan": "pro", "price_id": "price_pro_123"},
    )
    assert response.status_code == 501
    assert "Stripe SDK not installed" in response.json()["detail"]


def test_checkout_session_workspace_customer_metadata_includes_workspace_id(monkeypatch):
    _, client = _build_client(monkeypatch, stripe_secret_key="sk_test_123")
    captured_customer_metadata: dict[str, str] = {}
    fake_stripe = ModuleType("stripe")

    class _Customer:
        @staticmethod
        def create(**kwargs):
            nonlocal captured_customer_metadata
            captured_customer_metadata = dict(kwargs.get("metadata", {}))
            return SimpleNamespace(id="cus_workspace")

    class _Session:
        @staticmethod
        def create(**kwargs):
            return SimpleNamespace(
                id="cs_workspace", url="https://billing.example/workspace", **kwargs
            )

    class _Webhook:
        @staticmethod
        def construct_event(payload, sig_header, secret):
            return {"type": "noop", "data": {"object": {}}}

    fake_stripe.api_key = None
    fake_stripe.Customer = _Customer
    fake_stripe.checkout = SimpleNamespace(Session=_Session)
    fake_stripe.Webhook = _Webhook
    monkeypatch.setitem(sys.modules, "stripe", fake_stripe)

    identity = client.post(
        "/api/v1/identity/register",
        json={"email": "workspace-billing@example.com", "display_name": "Workspace Billing"},
    )
    assert identity.status_code == 200
    token = identity.json()["token"]
    workspace_id = identity.json()["workspace"]["id"]

    response = client.post(
        "/api/v1/billing/checkout-session",
        headers={"Authorization": f"Bearer {token}"},
        json={"plan": "pro", "price_id": "price_pro_123"},
    )
    assert response.status_code == 200
    assert captured_customer_metadata.get("workspace_id") == workspace_id


def test_webhook_requires_signature_header(monkeypatch):
    _, client = _build_client(
        monkeypatch,
        stripe_secret_key="sk_test_123",
        stripe_webhook_secret="whsec_test",
    )
    _install_fake_stripe(monkeypatch)

    response = client.post("/api/v1/billing/webhook", content=b"{}")
    assert response.status_code == 400
    assert response.json()["detail"] == "Missing Stripe signature"


def test_webhook_checkout_completed_updates_subscription(monkeypatch):
    app, client = _build_client(
        monkeypatch,
        stripe_secret_key="sk_test_123",
        stripe_webhook_secret="whsec_test",
    )
    token_hash = hash_api_key("secret")
    _install_fake_stripe(
        monkeypatch,
        webhook_event={
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "metadata": {"api_key_hash": token_hash, "plan": "team"},
                    "customer": "cus_987",
                    "subscription": "sub_987",
                }
            },
        },
    )

    response = client.post(
        "/api/v1/billing/webhook",
        headers={"stripe-signature": "t=1,v1=test"},
        content=b'{"id":"evt_1"}',
    )
    assert response.status_code == 200
    assert response.json()["event_type"] == "checkout.session.completed"

    record = app.state.subscription_store.get(token_hash)
    assert record is not None
    assert record.plan == BillingPlan.TEAM
    assert record.status == SubscriptionStatus.ACTIVE
    assert record.stripe_customer_id == "cus_987"
    assert record.stripe_subscription_id == "sub_987"


def test_webhook_checkout_completed_accepts_subject_key_metadata(monkeypatch):
    app, client = _build_client(
        monkeypatch,
        stripe_secret_key="sk_test_123",
        stripe_webhook_secret="whsec_test",
    )
    workspace_id = uuid4()
    account_id = uuid4()
    subject_key = f"workspace:{workspace_id}"
    _install_fake_stripe(
        monkeypatch,
        webhook_event={
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "metadata": {
                        "subject_key": subject_key,
                        "workspace_id": str(workspace_id),
                        "account_id": str(account_id),
                        "plan": "pro",
                    },
                    "customer": "cus_wk_123",
                    "subscription": "sub_wk_123",
                }
            },
        },
    )

    response = client.post(
        "/api/v1/billing/webhook",
        headers={"stripe-signature": "t=1,v1=test"},
        content=b'{"id":"evt_subject"}',
    )
    assert response.status_code == 200

    record = app.state.subscription_store.get(subject_key)
    assert record is not None
    assert record.workspace_id == workspace_id
    assert record.account_id == account_id
    assert record.plan == BillingPlan.PRO
    assert record.status == SubscriptionStatus.ACTIVE


def test_webhook_subscription_updated_maps_status_and_period(monkeypatch):
    app, client = _build_client(
        monkeypatch,
        stripe_secret_key="sk_test_123",
        stripe_webhook_secret="whsec_test",
    )
    token_hash = hash_api_key("secret")
    app.state.subscription_store.save(
        AccountSubscription(
            api_key_hash=token_hash,
            plan=BillingPlan.PRO,
            status=SubscriptionStatus.ACTIVE,
            stripe_customer_id="cus_123",
            stripe_subscription_id="sub_old",
        )
    )
    period_end = 1_800_000_000
    _install_fake_stripe(
        monkeypatch,
        webhook_event={
            "type": "customer.subscription.updated",
            "data": {
                "object": {
                    "id": "sub_new",
                    "customer": "cus_123",
                    "status": "past_due",
                    "current_period_end": period_end,
                }
            },
        },
    )

    response = client.post(
        "/api/v1/billing/webhook",
        headers={"stripe-signature": "t=1,v1=test"},
        content=b'{"id":"evt_2"}',
    )
    assert response.status_code == 200

    record = app.state.subscription_store.get(token_hash)
    assert record is not None
    assert record.status == SubscriptionStatus.PAST_DUE
    assert record.stripe_subscription_id == "sub_new"
    assert record.current_period_end == datetime.fromtimestamp(period_end, tz=UTC)


def test_webhook_subscription_deleted_sets_canceled(monkeypatch):
    app, client = _build_client(
        monkeypatch,
        stripe_secret_key="sk_test_123",
        stripe_webhook_secret="whsec_test",
    )
    token_hash = hash_api_key("secret")
    app.state.subscription_store.save(
        AccountSubscription(
            api_key_hash=token_hash,
            plan=BillingPlan.PRO,
            status=SubscriptionStatus.ACTIVE,
            stripe_customer_id="cus_456",
            stripe_subscription_id="sub_old",
        )
    )
    _install_fake_stripe(
        monkeypatch,
        webhook_event={
            "type": "customer.subscription.deleted",
            "data": {
                "object": {
                    "id": "sub_deleted",
                    "customer": "cus_456",
                    "status": "canceled",
                    "current_period_end": 1_800_123_456,
                }
            },
        },
    )

    response = client.post(
        "/api/v1/billing/webhook",
        headers={"stripe-signature": "t=1,v1=test"},
        content=b'{"id":"evt_4"}',
    )
    assert response.status_code == 200

    record = app.state.subscription_store.get(token_hash)
    assert record is not None
    assert record.status == SubscriptionStatus.CANCELED
    assert record.stripe_subscription_id == "sub_deleted"


def test_webhook_returns_400_on_construct_event_error(monkeypatch):
    _, client = _build_client(
        monkeypatch,
        stripe_secret_key="sk_test_123",
        stripe_webhook_secret="whsec_test",
    )
    _install_fake_stripe(monkeypatch, webhook_error=ValueError("bad signature"))

    response = client.post(
        "/api/v1/billing/webhook",
        headers={"stripe-signature": "t=1,v1=test"},
        content=b'{"id":"evt_3"}',
    )
    assert response.status_code == 400
    # Error detail must NOT leak internal exception messages
    assert response.json()["detail"] == "Webhook signature verification failed"


@pytest.mark.asyncio
async def test_webhook_direct_rejects_unsupported_provider(monkeypatch):
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_BILLING_PROVIDER", "mock")
    reset_settings()
    request = _FakeWebhookRequest(store=InMemorySubscriptionStore())

    with pytest.raises(HTTPException) as exc_info:
        await billing_api.stripe_webhook(request)

    assert exc_info.value.status_code == 501
    reset_settings()


@pytest.mark.asyncio
async def test_webhook_direct_requires_configured_secrets(monkeypatch):
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_BILLING_PROVIDER", "stripe")
    monkeypatch.delenv("STRIPE_SECRET_KEY", raising=False)
    monkeypatch.delenv("STRIPE_WEBHOOK_SECRET", raising=False)
    reset_settings()
    request = _FakeWebhookRequest(store=InMemorySubscriptionStore())

    with pytest.raises(HTTPException) as exc_info:
        await billing_api.stripe_webhook(request)

    assert exc_info.value.status_code == 503
    reset_settings()


@pytest.mark.asyncio
async def test_webhook_direct_returns_501_when_stripe_import_fails(monkeypatch):
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_BILLING_PROVIDER", "stripe")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_123")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_test")
    monkeypatch.setitem(sys.modules, "stripe", None)
    reset_settings()
    request = _FakeWebhookRequest(store=InMemorySubscriptionStore())

    with pytest.raises(HTTPException) as exc_info:
        await billing_api.stripe_webhook(request)

    assert exc_info.value.status_code == 501
    reset_settings()


@pytest.mark.asyncio
async def test_webhook_direct_requires_signature_header(monkeypatch):
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_BILLING_PROVIDER", "stripe")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_123")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_test")
    reset_settings()
    _install_fake_stripe(monkeypatch)
    request = _FakeWebhookRequest(store=InMemorySubscriptionStore(), signature=None)

    with pytest.raises(HTTPException) as exc_info:
        await billing_api.stripe_webhook(request)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Missing Stripe signature"
    reset_settings()


@pytest.mark.asyncio
async def test_webhook_direct_returns_400_when_construct_event_fails(monkeypatch):
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_BILLING_PROVIDER", "stripe")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_123")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_test")
    reset_settings()
    _install_fake_stripe(monkeypatch, webhook_error=ValueError("payload mismatch"))
    request = _FakeWebhookRequest(store=InMemorySubscriptionStore())

    with pytest.raises(HTTPException) as exc_info:
        await billing_api.stripe_webhook(request)

    assert exc_info.value.status_code == 400
    # Error detail must NOT leak internal exception messages
    assert exc_info.value.detail == "Webhook signature verification failed"
    reset_settings()


@pytest.mark.asyncio
async def test_webhook_direct_checkout_completed_updates_record(monkeypatch):
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_BILLING_PROVIDER", "stripe")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_123")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_test")
    reset_settings()

    workspace_id = uuid4()
    account_id = uuid4()
    subject_key = f"workspace:{workspace_id}"
    _install_fake_stripe(
        monkeypatch,
        webhook_event={
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "metadata": {
                        "subject_key": subject_key,
                        "workspace_id": str(workspace_id),
                        "account_id": str(account_id),
                        "plan": "team",
                    },
                    "customer": "cus_direct",
                    "subscription": "sub_direct",
                }
            },
        },
    )

    store = InMemorySubscriptionStore()
    request = _FakeWebhookRequest(store=store)
    response = await billing_api.stripe_webhook(request)

    assert response.received is True
    assert response.event_type == "checkout.session.completed"
    record = store.get(subject_key)
    assert record is not None
    assert record.workspace_id == workspace_id
    assert record.account_id == account_id
    assert record.plan == BillingPlan.TEAM
    assert record.status == SubscriptionStatus.ACTIVE
    assert record.stripe_customer_id == "cus_direct"
    assert record.stripe_subscription_id == "sub_direct"
    reset_settings()


@pytest.mark.asyncio
async def test_webhook_direct_subscription_update_maps_status_and_period(monkeypatch):
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_BILLING_PROVIDER", "stripe")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_123")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_test")
    reset_settings()

    period_end = 1_900_000_000
    _install_fake_stripe(
        monkeypatch,
        webhook_event={
            "type": "customer.subscription.updated",
            "data": {
                "object": {
                    "id": "sub_updated",
                    "customer": "cus_direct",
                    "status": "unpaid",
                    "current_period_end": period_end,
                }
            },
        },
    )

    store = InMemorySubscriptionStore()
    store.save(
        AccountSubscription(
            api_key_hash="subject-direct",
            plan=BillingPlan.PRO,
            status=SubscriptionStatus.ACTIVE,
            stripe_customer_id="cus_direct",
        )
    )

    request = _FakeWebhookRequest(store=store)
    response = await billing_api.stripe_webhook(request)

    assert response.event_type == "customer.subscription.updated"
    record = store.get("subject-direct")
    assert record is not None
    assert record.status == SubscriptionStatus.PAST_DUE
    assert record.stripe_subscription_id == "sub_updated"
    assert record.current_period_end == datetime.fromtimestamp(period_end, tz=UTC)
    reset_settings()
