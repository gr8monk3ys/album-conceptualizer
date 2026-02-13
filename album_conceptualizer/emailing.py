"""Email delivery helpers for identity and onboarding flows."""

from __future__ import annotations

import json
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage
from pathlib import Path
from typing import Protocol

from album_conceptualizer.logging import get_logger


logger = get_logger("album_conceptualizer.email")


class EmailSender(Protocol):
    """Interface for sending plaintext emails."""

    def send(self, *, to_email: str, subject: str, body: str) -> None:
        """Send one email message."""


@dataclass
class OutboxEmailSender:
    """Development sender that appends messages to a JSONL outbox file."""

    outbox_path: Path

    def send(self, *, to_email: str, subject: str, body: str) -> None:
        self.outbox_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "email": to_email,
            "subject": subject,
            "body": body,
        }
        with self.outbox_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(payload) + "\n")


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

        if self.use_ssl:
            with smtplib.SMTP_SSL(
                host=self.host,
                port=self.port,
                timeout=self.timeout_seconds,
            ) as server:
                if self.username and self.password:
                    server.login(self.username, self.password)
                server.send_message(message)
            return

        with smtplib.SMTP(host=self.host, port=self.port, timeout=self.timeout_seconds) as server:
            server.ehlo()
            if self.use_tls:
                server.starttls()
                server.ehlo()
            if self.username and self.password:
                server.login(self.username, self.password)
            server.send_message(message)


def create_email_sender(settings) -> EmailSender:
    """Create the configured email sender implementation."""
    provider = settings.email_provider.strip().lower()
    if provider == "noop":
        return NoopEmailSender()
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
            raise ValueError("Set only one of ALBUM_CONCEPTUALIZER_SMTP_USE_SSL or _USE_TLS to true")
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
    return OutboxEmailSender(settings.output_dir / "identity_outbox.log")
