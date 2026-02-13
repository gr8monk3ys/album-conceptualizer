"""Subscription and billing domain models."""

from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class BillingPlan(StrEnum):
    """Supported billing plans."""

    FREE = "free"
    PRO = "pro"
    TEAM = "team"


class SubscriptionStatus(StrEnum):
    """Subscription lifecycle statuses."""

    INACTIVE = "inactive"
    TRIALING = "trialing"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELED = "canceled"


class AccountSubscription(BaseModel):
    """Persisted subscription record keyed by caller subject.

    For backward compatibility, `api_key_hash` now stores either a legacy API-key
    hash or a workspace subject key in the form `workspace:<uuid>`.
    """

    account_id: UUID = Field(default_factory=uuid4)
    api_key_hash: str
    workspace_id: UUID | None = None
    plan: BillingPlan = BillingPlan.FREE
    status: SubscriptionStatus = SubscriptionStatus.INACTIVE
    stripe_customer_id: str | None = None
    stripe_subscription_id: str | None = None
    current_period_end: datetime | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    metadata: dict[str, str] = Field(default_factory=dict)

    def is_active(self) -> bool:
        """Return whether the subscription grants paid access."""
        return self.status in {SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING}

    @property
    def subject_key(self) -> str:
        """Return the canonical subscription subject key."""
        return self.api_key_hash
