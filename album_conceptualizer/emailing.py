"""Email delivery helpers for identity, onboarding, and notification flows.

Supports three backends:

* **outbox** (default) -- writes JSON files to ``{data_dir}/outbox/`` for local
  development inspection.
* **console** -- prints the full email to stdout and logs it, useful for
  automated testing and CI.
* **smtp** -- delivers via a real SMTP server using the stdlib ``smtplib``.
* **noop** -- silently drops the email, logging only minimal metadata.
"""

from __future__ import annotations

import json
import smtplib
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from email.message import EmailMessage
from pathlib import Path
from typing import Any, Protocol

from album_conceptualizer.logging import get_logger


logger = get_logger("album_conceptualizer.email")


# ---------------------------------------------------------------------------
# Sender protocol and implementations
# ---------------------------------------------------------------------------


class EmailSender(Protocol):
    """Interface for sending plaintext emails."""

    def send(self, *, to_email: str, subject: str, body: str) -> None:
        """Send one email message."""


@dataclass
class OutboxEmailSender:
    """Development sender that writes each message as a JSON file.

    Messages are written to ``outbox_dir/<uuid>.json`` so they can be
    inspected individually.  A JSONL log is also maintained for backward
    compatibility at ``outbox_dir/outbox.jsonl``.
    """

    outbox_dir: Path

    def send(self, *, to_email: str, subject: str, body: str) -> None:
        self.outbox_dir.mkdir(parents=True, exist_ok=True)
        payload: dict[str, Any] = {
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now(UTC).isoformat(),
            "email": to_email,
            "subject": subject,
            "body": body,
        }
        # Individual JSON file for easy inspection.
        msg_path = self.outbox_dir / f"{payload['id']}.json"
        msg_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        # Append to JSONL log for tooling that reads a stream.
        jsonl_path = self.outbox_dir / "outbox.jsonl"
        with jsonl_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(payload) + "\n")
        logger.info(
            "email_outbox_written",
            extra={"to_email": to_email, "subject": subject, "path": str(msg_path)},
        )


class ConsoleEmailSender:
    """Sender that prints the full email to stdout and logs it.

    Useful for testing and CI where you want to see the complete email
    content in build logs.
    """

    def send(self, *, to_email: str, subject: str, body: str) -> None:
        separator = "-" * 60
        output = (
            f"\n{separator}\n"
            f"To: {to_email}\n"
            f"Subject: {subject}\n"
            f"{separator}\n"
            f"{body}\n"
            f"{separator}\n"
        )
        print(output)  # noqa: T201 -- intentional console output
        logger.info(
            "email_console",
            extra={"to_email": to_email, "subject": subject, "body_length": len(body)},
        )


class NoopEmailSender:
    """Sender that drops emails while logging send attempts."""

    def send(self, *, to_email: str, subject: str, body: str) -> None:
        logger.info(
            "email_noop",
            extra={"to_email": to_email, "subject": subject, "body_length": len(body)},
        )


@dataclass
class SMTPEmailSender:
    """SMTP email sender for production delivery."""

    host: str
    port: int
    from_email: str
    username: str | None = None
    password: str | None = None
    reply_to: str | None = None
    use_tls: bool = True
    use_ssl: bool = False
    timeout_seconds: float = 10.0

    def send(self, *, to_email: str, subject: str, body: str) -> None:
        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = self.from_email
        message["To"] = to_email
        if self.reply_to:
            message["Reply-To"] = self.reply_to
        message.set_content(body)

        logger.debug(
            "smtp_send_start",
            extra={"to_email": to_email, "subject": subject, "host": self.host},
        )

        try:
            if self.use_ssl:
                with smtplib.SMTP_SSL(
                    host=self.host,
                    port=self.port,
                    timeout=self.timeout_seconds,
                ) as server:
                    if self.username and self.password:
                        server.login(self.username, self.password)
                    server.send_message(message)
            else:
                with smtplib.SMTP(
                    host=self.host, port=self.port, timeout=self.timeout_seconds
                ) as server:
                    server.ehlo()
                    if self.use_tls:
                        server.starttls()
                        server.ehlo()
                    if self.username and self.password:
                        server.login(self.username, self.password)
                    server.send_message(message)
        except smtplib.SMTPException as exc:
            logger.error(
                "smtp_send_failed",
                extra={
                    "to_email": to_email,
                    "subject": subject,
                    "error": str(exc),
                    "error_type": type(exc).__name__,
                },
            )
            raise
        except OSError as exc:
            logger.error(
                "smtp_connection_failed",
                extra={
                    "to_email": to_email,
                    "host": self.host,
                    "port": self.port,
                    "error": str(exc),
                },
            )
            raise

        logger.info(
            "smtp_send_ok",
            extra={"to_email": to_email, "subject": subject},
        )


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------


def create_email_sender(settings) -> EmailSender:
    """Create the configured email sender implementation.

    Supported ``email_provider`` values:

    * ``"outbox"`` -- writes to ``{data_dir}/outbox/`` (default)
    * ``"console"`` -- prints to stdout
    * ``"noop"`` -- silently drops
    * ``"smtp"`` -- delivers via SMTP
    """
    provider = settings.email_provider.strip().lower()
    if provider == "noop":
        return NoopEmailSender()
    if provider == "console":
        return ConsoleEmailSender()
    if provider == "smtp":
        missing: list[str] = []
        if not settings.smtp_host:
            missing.append("ALBUM_CONCEPTUALIZER_SMTP_HOST")
        if not settings.email_from:
            missing.append("ALBUM_CONCEPTUALIZER_EMAIL_FROM")
        if missing:
            missing_csv = ", ".join(missing)
            raise ValueError(f"SMTP email provider requires: {missing_csv}")
        if settings.smtp_use_ssl and settings.smtp_use_tls:
            raise ValueError(
                "Set only one of ALBUM_CONCEPTUALIZER_SMTP_USE_SSL or _USE_TLS to true"
            )
        return SMTPEmailSender(
            host=settings.smtp_host,
            port=settings.smtp_port,
            from_email=settings.email_from,
            username=settings.smtp_username,
            password=settings.smtp_password,
            reply_to=settings.email_reply_to,
            use_tls=settings.smtp_use_tls,
            use_ssl=settings.smtp_use_ssl,
            timeout_seconds=settings.smtp_timeout_seconds,
        )
    # Default: outbox
    outbox_dir = settings.data_dir / "outbox"
    return OutboxEmailSender(outbox_dir)


# ---------------------------------------------------------------------------
# Convenience wrapper
# ---------------------------------------------------------------------------


def send_email(
    sender: EmailSender,
    *,
    to_email: str,
    subject: str,
    body: str,
) -> bool:
    """Send an email through *sender* with error handling.

    Returns ``True`` on success, ``False`` if delivery failed.  Failures
    are logged but not re-raised so callers can decide whether to treat
    a send failure as fatal.
    """
    try:
        sender.send(to_email=to_email, subject=subject, body=body)
        return True
    except Exception:
        logger.exception(
            "send_email_failed",
            extra={"to_email": to_email, "subject": subject},
        )
        return False


# ---------------------------------------------------------------------------
# Email template helpers
# ---------------------------------------------------------------------------


def send_workspace_invite(
    sender: EmailSender,
    *,
    to_email: str,
    workspace_name: str,
    inviter_name: str,
    invite_url: str,
) -> bool:
    """Send a workspace invite email.

    Returns ``True`` if the email was accepted by the backend.
    """
    subject = f"You've been invited to join \"{workspace_name}\" on Album Conceptualizer"
    body = (
        f"Hi there,\n"
        f"\n"
        f"{inviter_name} has invited you to collaborate on the workspace "
        f"\"{workspace_name}\" in Album Conceptualizer.\n"
        f"\n"
        f"Click the link below to accept the invitation:\n"
        f"\n"
        f"  {invite_url}\n"
        f"\n"
        f"This invite link will expire in a few days. If you did not expect "
        f"this invitation, you can safely ignore this email.\n"
        f"\n"
        f"-- Album Conceptualizer\n"
    )
    return send_email(sender, to_email=to_email, subject=subject, body=body)


def send_magic_link(
    sender: EmailSender,
    *,
    to_email: str,
    magic_link_url: str,
) -> bool:
    """Send a magic-link sign-in email.

    Returns ``True`` if the email was accepted by the backend.
    """
    subject = "Your Album Conceptualizer sign-in link"
    body = (
        f"Hi,\n"
        f"\n"
        f"Use the link below to sign in to Album Conceptualizer:\n"
        f"\n"
        f"  {magic_link_url}\n"
        f"\n"
        f"This link is single-use and will expire shortly.  If you did not "
        f"request this sign-in link, you can safely ignore this email.\n"
        f"\n"
        f"-- Album Conceptualizer\n"
    )
    return send_email(sender, to_email=to_email, subject=subject, body=body)


@dataclass
class NotificationItem:
    """A single notification for the digest email."""

    title: str
    description: str = ""
    timestamp: str = ""


def send_notification_digest(
    sender: EmailSender,
    *,
    to_email: str,
    notifications: list[dict[str, str] | NotificationItem],
) -> bool:
    """Send a daily digest of unread notifications.

    *notifications* is a list of dicts (or ``NotificationItem`` instances)
    each containing at least a ``title`` key, with optional ``description``
    and ``timestamp`` keys.

    Returns ``True`` if the email was accepted by the backend.
    """
    if not notifications:
        logger.debug(
            "notification_digest_skipped",
            extra={"to_email": to_email, "reason": "empty notifications list"},
        )
        return True  # Nothing to send is not an error.

    count = len(notifications)
    subject = f"You have {count} unread notification{'s' if count != 1 else ''} on Album Conceptualizer"

    lines: list[str] = [
        "Hi,",
        "",
        f"Here is a summary of your {count} unread notification{'s' if count != 1 else ''}:",
        "",
    ]

    for idx, item in enumerate(notifications, start=1):
        if isinstance(item, NotificationItem):
            title = item.title
            description = item.description
            timestamp = item.timestamp
        else:
            title = item.get("title", "(no title)")
            description = item.get("description", "")
            timestamp = item.get("timestamp", "")

        line = f"  {idx}. {title}"
        if timestamp:
            line += f" ({timestamp})"
        lines.append(line)
        if description:
            lines.append(f"     {description}")

    lines.extend([
        "",
        "Visit Album Conceptualizer to view details and take action.",
        "",
        "-- Album Conceptualizer",
        "",
    ])

    body = "\n".join(lines)
    return send_email(sender, to_email=to_email, subject=subject, body=body)
