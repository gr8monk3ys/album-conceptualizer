"""Billing and subscription endpoints."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import cast
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Request, status
from pydantic import BaseModel, Field

from album_conceptualizer.api.deps import extract_auth_token, resolve_subscription_subject
from album_conceptualizer.config import get_settings
from album_conceptualizer.models.subscription import (
    AccountSubscription,
    BillingPlan,
    SubscriptionStatus,
)
from album_conceptualizer.storage import SubscriptionStore


protected_router = APIRouter()
public_router = APIRouter()


class SubscriptionResponse(BaseModel):
    """Current subscription status for the caller."""

    account_id: str
    subject_key: str
    workspace_id: str | None
    plan: BillingPlan
    status: SubscriptionStatus
    current_period_end: datetime | None
    stripe_customer_id: str | None
    stripe_subscription_id: str | None


class CheckoutSessionRequest(BaseModel):
    """Create a hosted billing checkout session."""

    plan: BillingPlan = BillingPlan.PRO
    price_id: str | None = None
    quantity: int = Field(default=1, ge=1, le=100)


class CheckoutSessionResponse(BaseModel):
    """Checkout session payload returned to the caller."""

    session_id: str
    url: str


class WebhookAckResponse(BaseModel):
    """Webhook acknowledgement payload."""

    received: bool
    event_type: str | None = None


def _get_store(request: Request) -> SubscriptionStore:
    return cast("SubscriptionStore", request.app.state.subscription_store)


def _parse_uuid(value: object) -> UUID | None:
    if not isinstance(value, str):
        return None
    try:
        return UUID(value)
    except ValueError:
        return None


def _get_or_create_record(
    store: SubscriptionStore,
    subject_key: str,
    *,
    workspace_id: UUID | None,
    account_id: UUID | None,
) -> AccountSubscription:
    existing = store.get(subject_key)
    if existing:
        if workspace_id and existing.workspace_id != workspace_id:
            existing.workspace_id = workspace_id
            existing.updated_at = datetime.now(UTC)
            store.save(existing)
        return existing

    record = AccountSubscription(
        api_key_hash=subject_key,
        workspace_id=workspace_id,
    )
    if account_id:
        record.account_id = account_id
    store.save(record)
    return record


def _status_from_stripe(status_text: str | None) -> SubscriptionStatus:
    mapping = {
        "active": SubscriptionStatus.ACTIVE,
        "trialing": SubscriptionStatus.TRIALING,
        "past_due": SubscriptionStatus.PAST_DUE,
        "unpaid": SubscriptionStatus.PAST_DUE,
        "canceled": SubscriptionStatus.CANCELED,
    }
    if not status_text:
        return SubscriptionStatus.INACTIVE
    return mapping.get(status_text, SubscriptionStatus.INACTIVE)


def _plan_price_id_for(settings, plan: BillingPlan) -> str | None:
    if plan == BillingPlan.PRO:
        return settings.stripe_price_id_pro
    if plan == BillingPlan.TEAM:
        return settings.stripe_price_id_team
    return None


def _find_by_customer_id(
    store: SubscriptionStore, customer_id: str | None
) -> AccountSubscription | None:
    if not customer_id:
        return None
    for item in store.list():
        if item.stripe_customer_id == customer_id:
            return item
    return None


@protected_router.get("/subscription", response_model=SubscriptionResponse)
async def get_subscription(
    request: Request,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> SubscriptionResponse:
    """Get current caller subscription state."""
    token = extract_auth_token(x_api_key, authorization)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API key",
        )

    subject_key, session = resolve_subscription_subject(request, token)
    record = _get_or_create_record(
        _get_store(request),
        subject_key,
        workspace_id=session.workspace_id if session else None,
        account_id=session.account_id if session else None,
    )
    return SubscriptionResponse(
        account_id=str(record.account_id),
        subject_key=record.subject_key,
        workspace_id=str(record.workspace_id) if record.workspace_id else None,
        plan=record.plan,
        status=record.status,
        current_period_end=record.current_period_end,
        stripe_customer_id=record.stripe_customer_id,
        stripe_subscription_id=record.stripe_subscription_id,
    )


@protected_router.post("/checkout-session", response_model=CheckoutSessionResponse)
async def create_checkout_session(
    request: Request,
    data: CheckoutSessionRequest,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> CheckoutSessionResponse:
    """Create a Stripe checkout session for subscription purchase."""
    settings = get_settings()
    if settings.billing_provider != "stripe":
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Only Stripe billing provider is currently supported",
        )
    if not settings.stripe_secret_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe is not configured on this server",
        )

    token = extract_auth_token(x_api_key, authorization)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API key",
        )

    price_id = data.price_id or _plan_price_id_for(settings, data.plan)
    if not price_id:
        if data.plan == BillingPlan.PRO:
            detail = (
                "No Stripe price id configured for requested plan. "
                "Set ALBUM_CONCEPTUALIZER_STRIPE_PRICE_ID_PRO (or STRIPE_PRICE_ID)."
            )
        elif data.plan == BillingPlan.TEAM:
            detail = (
                "No Stripe price id configured for requested plan. "
                "Set ALBUM_CONCEPTUALIZER_STRIPE_PRICE_ID_TEAM."
            )
        else:
            detail = "No Stripe price id configured for requested plan."
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
        )

    try:
        import stripe
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Stripe SDK not installed. Install with `pip install stripe`.",
        ) from exc

    stripe.api_key = settings.stripe_secret_key
    store = _get_store(request)
    subject_key, session = resolve_subscription_subject(request, token)
    record = _get_or_create_record(
        store,
        subject_key,
        workspace_id=session.workspace_id if session else None,
        account_id=session.account_id if session else None,
    )

    customer_metadata = {
        "account_id": str(record.account_id),
        "subject_key": record.subject_key,
        "api_key_hash": record.api_key_hash,
    }
    if record.workspace_id:
        customer_metadata["workspace_id"] = str(record.workspace_id)

    try:
        if not record.stripe_customer_id:
            customer = stripe.Customer.create(metadata=customer_metadata)
            record.stripe_customer_id = str(customer.id)

        checkout_metadata = {
            **customer_metadata,
            "plan": data.plan.value,
        }
        session_payload = stripe.checkout.Session.create(
            mode="subscription",
            customer=record.stripe_customer_id,
            line_items=[{"price": price_id, "quantity": data.quantity}],
            success_url=f"{settings.billing_success_url}?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=settings.billing_cancel_url,
            metadata=checkout_metadata,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Stripe checkout request failed",
        ) from exc

    record.plan = data.plan
    record.updated_at = datetime.now(UTC)
    store.save(record)

    session_url = getattr(session_payload, "url", None)
    if not session_url:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Stripe did not return a checkout URL",
        )

    return CheckoutSessionResponse(session_id=str(session_payload.id), url=str(session_url))


@public_router.post("/webhook", response_model=WebhookAckResponse)
async def stripe_webhook(request: Request) -> WebhookAckResponse:
    """Handle Stripe webhook events to keep local subscription state in sync."""
    settings = get_settings()
    if settings.billing_provider != "stripe":
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Only Stripe billing provider is currently supported",
        )
    if not settings.stripe_secret_key or not settings.stripe_webhook_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe webhook is not configured",
        )

    try:
        import stripe
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Stripe SDK not installed. Install with `pip install stripe`.",
        ) from exc

    stripe.api_key = settings.stripe_secret_key
    payload = await request.body()
    signature = request.headers.get("stripe-signature")
    if not signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Missing Stripe signature"
        )

    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=signature,
            secret=settings.stripe_webhook_secret,
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    store = _get_store(request)
    event_type = str(event.get("type", ""))
    data_obj = event.get("data", {}).get("object", {})

    if event_type == "checkout.session.completed":
        metadata = data_obj.get("metadata") or {}
        subject_key = metadata.get("subject_key") or metadata.get("api_key_hash")
        if subject_key:
            record = store.get(subject_key) or AccountSubscription(api_key_hash=subject_key)
            account_id = _parse_uuid(metadata.get("account_id"))
            workspace_id = _parse_uuid(metadata.get("workspace_id"))
            if account_id:
                record.account_id = account_id
            if workspace_id:
                record.workspace_id = workspace_id

            plan_value = metadata.get("plan")
            if isinstance(plan_value, str) and plan_value in {p.value for p in BillingPlan}:
                record.plan = BillingPlan(plan_value)
            record.status = SubscriptionStatus.ACTIVE
            customer = data_obj.get("customer")
            subscription_id = data_obj.get("subscription")
            if customer:
                record.stripe_customer_id = str(customer)
            if subscription_id:
                record.stripe_subscription_id = str(subscription_id)
            record.updated_at = datetime.now(UTC)
            store.save(record)

    elif event_type in {"customer.subscription.updated", "customer.subscription.deleted"}:
        customer_id = data_obj.get("customer")
        customer_record = _find_by_customer_id(store, str(customer_id) if customer_id else None)
        if customer_record:
            customer_record.status = _status_from_stripe(data_obj.get("status"))
            customer_record.stripe_subscription_id = (
                str(data_obj.get("id", "")) or customer_record.stripe_subscription_id
            )
            period_end = data_obj.get("current_period_end")
            if isinstance(period_end, int):
                customer_record.current_period_end = datetime.fromtimestamp(period_end, tz=UTC)
            customer_record.updated_at = datetime.now(UTC)
            store.save(customer_record)

    return WebhookAckResponse(received=True, event_type=event_type or None)
