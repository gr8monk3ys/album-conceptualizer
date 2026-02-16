"""Tests for email sender implementations."""

from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from album_conceptualizer.emailing import (
    OutboxEmailSender,
    SMTPEmailSender,
    create_email_sender,
)


def test_outbox_email_sender_writes_jsonl(tmp_path: Path) -> None:
    outbox_dir = tmp_path / "mail" / "outbox"
    sender = OutboxEmailSender(outbox_dir)

    sender.send(to_email="person@example.com", subject="Test Subject", body="Hello")

    jsonl_path = outbox_dir / "outbox.jsonl"
    lines = jsonl_path.read_text(encoding="utf-8").strip().splitlines()
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
        data_dir=tmp_path,
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
