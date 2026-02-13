#!/usr/bin/env python3
"""Run a staging smoke test for billing and subscription endpoints."""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import time
from typing import Any

import httpx


def hash_api_key(token: str) -> str:
    """Hash API keys using the same logic as the API server."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def make_stripe_signature(payload: bytes, webhook_secret: str, timestamp: int | None = None) -> str:
    """Create a Stripe-compatible signature header for webhook tests."""
    signed_timestamp = timestamp or int(time.time())
    signed_payload = f"{signed_timestamp}.{payload.decode('utf-8')}".encode()
    digest = hmac.new(
        webhook_secret.encode("utf-8"),
        signed_payload,
        hashlib.sha256,
    ).hexdigest()
    return f"t={signed_timestamp},v1={digest}"


def fail(message: str) -> int:
    """Print an error message and return a failing exit code."""
    print(f"[FAIL] {message}")
    return 1


def request_json(
    client: httpx.Client,
    method: str,
    url: str,
    *,
    expected_status: int,
    **kwargs: Any,
) -> dict[str, Any] | None:
    """Send an HTTP request and return parsed JSON on success."""
    response = client.request(method, url, **kwargs)
    if response.status_code != expected_status:
        body = response.text.strip()
        print(f"[HTTP {response.status_code}] {method} {url}")
        print(body or "<empty>")
        return None
    if not response.content:
        return {}
    return dict(response.json())


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--base-url",
        default=os.getenv("ALBUM_CONCEPTUALIZER_BASE_URL", "http://localhost:8000"),
        help="Base API URL (default: %(default)s)",
    )
    parser.add_argument(
        "--api-key",
        default=os.getenv("ALBUM_CONCEPTUALIZER_API_KEY"),
        help="API key for protected billing endpoints",
    )
    parser.add_argument(
        "--plan",
        choices=["free", "pro", "team"],
        default="pro",
        help="Plan to request in checkout (default: %(default)s)",
    )
    parser.add_argument(
        "--price-id",
        default=os.getenv("STRIPE_PRICE_ID"),
        help="Stripe price ID used for checkout-session",
    )
    parser.add_argument(
        "--skip-checkout",
        action="store_true",
        help="Skip checkout creation (useful for webhook-only smoke in non-billable environments)",
    )
    parser.add_argument(
        "--simulate-webhook",
        action="store_true",
        help="Simulate checkout completion by posting a signed webhook",
    )
    parser.add_argument(
        "--simulate-lifecycle",
        action="store_true",
        help=(
            "Simulate a full subscription lifecycle after checkout completion "
            "(updated -> past_due, deleted -> canceled)."
        ),
    )
    parser.add_argument(
        "--webhook-secret",
        default=os.getenv("STRIPE_WEBHOOK_SECRET"),
        help="Webhook signing secret required with --simulate-webhook",
    )
    parser.add_argument(
        "--customer-id",
        default="cus_smoke_test",
        help="Customer id used in simulated webhook event",
    )
    parser.add_argument(
        "--subscription-id",
        default="sub_smoke_test",
        help="Subscription id used in simulated webhook event",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=20.0,
        help="HTTP timeout in seconds (default: %(default)s)",
    )
    return parser.parse_args()


def main() -> int:
    """Run the smoke test flow."""
    args = parse_args()

    if not args.api_key:
        return fail("Missing API key. Provide --api-key or ALBUM_CONCEPTUALIZER_API_KEY.")
    if not args.skip_checkout and not args.price_id:
        return fail("Missing Stripe price id. Provide --price-id or STRIPE_PRICE_ID.")
    if (args.simulate_webhook or args.simulate_lifecycle) and not args.webhook_secret:
        return fail("Missing webhook secret. Provide --webhook-secret with --simulate-webhook.")

    base_url = args.base_url.rstrip("/")
    headers = {"X-API-Key": args.api_key}

    with httpx.Client(timeout=args.timeout) as client:
        print("[STEP] Query current subscription")
        before = request_json(
            client,
            "GET",
            f"{base_url}/api/v1/billing/subscription",
            expected_status=200,
            headers=headers,
        )
        if before is None:
            return fail("Unable to fetch current subscription state.")
        print(f"       plan={before.get('plan')} status={before.get('status')}")

        if not args.skip_checkout:
            print("[STEP] Create checkout session")
            checkout = request_json(
                client,
                "POST",
                f"{base_url}/api/v1/billing/checkout-session",
                expected_status=200,
                headers=headers,
                json={"plan": args.plan, "price_id": args.price_id, "quantity": 1},
            )
            if checkout is None:
                return fail("Checkout session creation failed.")
            print(f"       session_id={checkout.get('session_id')}")
        else:
            print("[STEP] Checkout skipped by request")

        if args.simulate_webhook or args.simulate_lifecycle:
            print("[STEP] Simulate checkout.session.completed webhook")
            event_payload = {
                "id": "evt_smoke_checkout_completed",
                "type": "checkout.session.completed",
                "data": {
                    "object": {
                        "metadata": {
                            "api_key_hash": hash_api_key(args.api_key),
                            "plan": args.plan,
                        },
                        "customer": args.customer_id,
                        "subscription": args.subscription_id,
                    }
                },
            }
            payload_bytes = json.dumps(event_payload, separators=(",", ":")).encode("utf-8")
            signature = make_stripe_signature(payload_bytes, args.webhook_secret)
            webhook = request_json(
                client,
                "POST",
                f"{base_url}/api/v1/billing/webhook",
                expected_status=200,
                headers={"stripe-signature": signature},
                content=payload_bytes,
            )
            if webhook is None:
                return fail("Webhook simulation failed.")
            print(f"       acknowledged event={webhook.get('event_type')}")

        if args.simulate_lifecycle:
            lifecycle_events = [
                (
                    "evt_smoke_subscription_updated",
                    "customer.subscription.updated",
                    {
                        "id": args.subscription_id,
                        "customer": args.customer_id,
                        "status": "past_due",
                        "current_period_end": int(time.time()) + 86_400,
                    },
                ),
                (
                    "evt_smoke_subscription_deleted",
                    "customer.subscription.deleted",
                    {
                        "id": args.subscription_id,
                        "customer": args.customer_id,
                        "status": "canceled",
                        "current_period_end": int(time.time()) + 86_400,
                    },
                ),
            ]
            for event_id, event_type, event_object in lifecycle_events:
                print(f"[STEP] Simulate {event_type} webhook")
                payload = {
                    "id": event_id,
                    "type": event_type,
                    "data": {"object": event_object},
                }
                payload_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")
                signature = make_stripe_signature(payload_bytes, args.webhook_secret)
                lifecycle_response = request_json(
                    client,
                    "POST",
                    f"{base_url}/api/v1/billing/webhook",
                    expected_status=200,
                    headers={"stripe-signature": signature},
                    content=payload_bytes,
                )
                if lifecycle_response is None:
                    return fail(f"Lifecycle webhook simulation failed for {event_type}.")
                print(f"       acknowledged event={lifecycle_response.get('event_type')}")

        print("[STEP] Query subscription after checkout flow")
        after = request_json(
            client,
            "GET",
            f"{base_url}/api/v1/billing/subscription",
            expected_status=200,
            headers=headers,
        )
        if after is None:
            return fail("Unable to fetch final subscription state.")
        print(f"       plan={after.get('plan')} status={after.get('status')}")

        if args.simulate_lifecycle:
            if after.get("status") != "canceled":
                return fail(
                    "Expected subscription status=canceled after lifecycle simulation."
                )
            if after.get("plan") != args.plan:
                return fail(
                    f"Expected plan={args.plan!r} after lifecycle simulation, got {after.get('plan')!r}."
                )
        elif args.simulate_webhook:
            if after.get("status") != "active":
                return fail("Expected subscription status=active after webhook simulation.")
            if after.get("plan") != args.plan:
                return fail(
                    f"Expected plan={args.plan!r} after webhook simulation, got {after.get('plan')!r}."
                )

    print("[PASS] Billing smoke flow completed successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
