"""Tests for email sender implementations."""

from __future__ import annotations

import json
import logging
from email.message import EmailMessage
from pathlib import Path
from types import SimpleNamespace

import pytest

from album_conceptualizer.emailing import (
    NoopEmailSender,
    OutboxEmailSender,
    SMTPEmailSender,
    create_email_sender,
)


def test_outbox_email_sender_writes_jsonl(tmp_path: Path) -> None:
    outbox = tmp_path / "mail" / "outbox.log"
    sender = OutboxEmailSender(outbox)

    sender.send(to_email="person@example.com", subject="Test Subject", body="Hello")

    lines = outbox.read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) == 1
    payload = json.loads(lines[0])
    assert payload["email"] == "person@example.com"
    assert payload["subject"] == "Test Subject"
    assert payload["body"] == "Hello"


def test_create_email_sender_validates_smtp_requirements(tmp_path: Path) -> None:
    settings = SimpleNamespace(
        email_provider="smtp",
        smtp_host=None,
        email_from=None,
        smtp_use_ssl=False,
        smtp_use_tls=True,
        smtp_port=587,
        smtp_username=None,
        smtp_password=None,
        email_reply_to=None,
        smtp_timeout_seconds=10.0,
        output_dir=tmp_path,
    )

    with pytest.raises(ValueError, match="SMTP email provider requires"):
        create_email_sender(settings)


def test_smtp_sender_uses_starttls_and_login(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: dict[str, object] = {}

    class FakeSMTP:
        def __init__(self, host, port, timeout):
            calls["host"] = host
            calls["port"] = port
            calls["timeout"] = timeout

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def ehlo(self):
            calls["ehlo"] = int(calls.get("ehlo", 0)) + 1

        def starttls(self):
            calls["starttls"] = True

        def login(self, username, password):
            calls["login"] = (username, password)

        def send_message(self, message):
            calls["message_to"] = message["To"]
            calls["message_subject"] = message["Subject"]

    monkeypatch.setattr("smtplib.SMTP", FakeSMTP)

    sender = SMTPEmailSender(
        host="smtp.example.com",
        port=587,
        from_email="noreply@example.com",
        username="smtp-user",
        password="smtp-pass",
        use_tls=True,
        use_ssl=False,
        timeout_seconds=12.0,
    )
    sender.send(to_email="recipient@example.com", subject="Welcome", body="Body")

    assert calls["host"] == "smtp.example.com"
    assert calls["port"] == 587
    assert calls["timeout"] == 12.0
    assert calls["starttls"] is True
    assert calls["login"] == ("smtp-user", "smtp-pass")
    assert calls["message_to"] == "recipient@example.com"
    assert calls["message_subject"] == "Welcome"


class RecordingSMTP:
    """Stand-in for smtplib.SMTP / SMTP_SSL that records the session it was driven through."""

    def __init__(self, host: str, port: int, timeout: float) -> None:
        self.host = host
        self.port = port
        self.timeout = timeout
        self.steps: list[str] = []
        self.login_args: tuple[str, str] | None = None
        self.messages: list[EmailMessage] = []
        opened.append(self)

    def __enter__(self) -> RecordingSMTP:
        return self

    def __exit__(self, exc_type: object, exc: object, tb: object) -> bool:
        self.steps.append("close")
        return False

    def ehlo(self) -> None:
        self.steps.append("ehlo")

    def starttls(self) -> None:
        self.steps.append("starttls")

    def login(self, username: str, password: str) -> None:
        self.steps.append("login")
        self.login_args = (username, password)

    def send_message(self, message: EmailMessage) -> None:
        self.steps.append("send")
        self.messages.append(message)


opened: list[RecordingSMTP] = []


def _refuse_transport(*args: object, **kwargs: object) -> None:
    raise AssertionError("the sender opened the wrong SMTP transport")


@pytest.fixture
def smtp_ssl(monkeypatch: pytest.MonkeyPatch) -> list[RecordingSMTP]:
    opened.clear()
    monkeypatch.setattr("smtplib.SMTP_SSL", RecordingSMTP)
    monkeypatch.setattr("smtplib.SMTP", _refuse_transport)
    return opened


@pytest.fixture
def smtp_plain(monkeypatch: pytest.MonkeyPatch) -> list[RecordingSMTP]:
    opened.clear()
    monkeypatch.setattr("smtplib.SMTP", RecordingSMTP)
    monkeypatch.setattr("smtplib.SMTP_SSL", _refuse_transport)
    return opened


def _smtp_settings(tmp_path: Path, **overrides: object) -> SimpleNamespace:
    values: dict[str, object] = {
        "email_provider": "smtp",
        "smtp_host": "smtp.example.com",
        "email_from": "noreply@example.com",
        "smtp_use_ssl": False,
        "smtp_use_tls": True,
        "smtp_port": 587,
        "smtp_username": "smtp-user",
        "smtp_password": "smtp-pass",
        "email_reply_to": "support@example.com",
        "smtp_timeout_seconds": 7.5,
        "output_dir": tmp_path,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_smtp_sender_ssl_logs_in_and_sends_without_starttls(
    smtp_ssl: list[RecordingSMTP],
) -> None:
    sender = SMTPEmailSender(
        host="smtp.example.com",
        port=465,
        from_email="noreply@example.com",
        username="smtp-user",
        password="smtp-pass",
        reply_to="support@example.com",
        use_tls=False,
        use_ssl=True,
        timeout_seconds=5.0,
    )

    sender.send(to_email="recipient@example.com", subject="Reset", body="Your link")

    [server] = smtp_ssl
    assert (server.host, server.port, server.timeout) == ("smtp.example.com", 465, 5.0)
    assert server.steps == ["login", "send", "close"]
    assert server.login_args == ("smtp-user", "smtp-pass")
    [message] = server.messages
    assert message["From"] == "noreply@example.com"
    assert message["To"] == "recipient@example.com"
    assert message["Subject"] == "Reset"
    assert message["Reply-To"] == "support@example.com"
    assert message.get_content().strip() == "Your link"


def test_smtp_sender_ssl_without_credentials_skips_login(
    smtp_ssl: list[RecordingSMTP],
) -> None:
    sender = SMTPEmailSender(
        host="relay.internal", port=465, from_email="noreply@example.com", use_ssl=True
    )

    sender.send(to_email="recipient@example.com", subject="Hi", body="Body")

    [server] = smtp_ssl
    assert server.steps == ["send", "close"]
    assert server.login_args is None


def test_smtp_sender_plain_relay_skips_starttls_login_and_reply_to(
    smtp_plain: list[RecordingSMTP],
) -> None:
    sender = SMTPEmailSender(
        host="relay.internal",
        port=25,
        from_email="noreply@example.com",
        username="only-user",
        password=None,
        use_tls=False,
    )

    sender.send(to_email="recipient@example.com", subject="Hi", body="Body")

    [server] = smtp_plain
    assert server.steps == ["ehlo", "send", "close"]
    [message] = server.messages
    assert message["Reply-To"] is None


def test_create_email_sender_builds_smtp_sender_from_settings(tmp_path: Path) -> None:
    sender = create_email_sender(_smtp_settings(tmp_path, email_provider="  SMTP "))

    assert sender == SMTPEmailSender(
        host="smtp.example.com",
        port=587,
        from_email="noreply@example.com",
        username="smtp-user",
        password="smtp-pass",
        reply_to="support@example.com",
        use_tls=True,
        use_ssl=False,
        timeout_seconds=7.5,
    )


def test_create_email_sender_names_every_missing_smtp_setting(tmp_path: Path) -> None:
    with pytest.raises(ValueError) as excinfo:
        create_email_sender(_smtp_settings(tmp_path, smtp_host="", email_from=None))

    assert "ALBUM_CONCEPTUALIZER_SMTP_HOST" in str(excinfo.value)
    assert "ALBUM_CONCEPTUALIZER_EMAIL_FROM" in str(excinfo.value)


def test_create_email_sender_rejects_ssl_and_tls_together(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="Set only one of"):
        create_email_sender(_smtp_settings(tmp_path, smtp_use_ssl=True, smtp_use_tls=True))


def test_create_email_sender_noop_provider_drops_mail(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    sender = create_email_sender(SimpleNamespace(email_provider="noop", output_dir=tmp_path))
    assert isinstance(sender, NoopEmailSender)

    with caplog.at_level(logging.INFO, logger="album_conceptualizer.email"):
        sender.send(to_email="person@example.com", subject="Hi", body="12345")

    assert [record.getMessage() for record in caplog.records] == ["email_noop"]
    assert list(tmp_path.iterdir()) == []


def test_create_email_sender_defaults_to_outbox_in_output_dir(tmp_path: Path) -> None:
    sender = create_email_sender(SimpleNamespace(email_provider="outbox", output_dir=tmp_path))

    assert sender == OutboxEmailSender(tmp_path / "identity_outbox.log")
