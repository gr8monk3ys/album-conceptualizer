#!/usr/bin/env python3
"""Send a smoke-test email using configured provider settings."""

from __future__ import annotations

import argparse
import os
from datetime import UTC, datetime

from album_conceptualizer.config import get_settings, reset_settings
from album_conceptualizer.emailing import OutboxEmailSender, create_email_sender


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--to",
        default=os.getenv("ALBUM_CONCEPTUALIZER_SMOKE_TO"),
        help="Recipient email address (or set ALBUM_CONCEPTUALIZER_SMOKE_TO)",
    )
    parser.add_argument(
        "--subject",
        default="Album Conceptualizer SMTP Smoke Test",
        help="Email subject",
    )
    parser.add_argument(
        "--body",
        default=None,
        help="Optional plaintext body override",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.to:
        print("[FAIL] Missing recipient. Use --to or ALBUM_CONCEPTUALIZER_SMOKE_TO.")
        return 1

    reset_settings()
    settings = get_settings()
    provider = settings.email_provider.strip().lower()

    try:
        sender = create_email_sender(settings)
    except Exception as exc:
        print(f"[FAIL] Invalid email provider configuration: {exc}")
        return 1

    timestamp = datetime.now(UTC).isoformat()
    body = args.body or f"SMTP smoke test sent at {timestamp}."

    try:
        sender.send(to_email=args.to, subject=args.subject, body=body)
    except Exception as exc:
        print(f"[FAIL] Email send failed via provider={provider}: {exc}")
        return 1

    print(f"[PASS] Email smoke sent via provider={provider} to {args.to}")
    if isinstance(sender, OutboxEmailSender):
        print(f"       outbox={sender.outbox_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
