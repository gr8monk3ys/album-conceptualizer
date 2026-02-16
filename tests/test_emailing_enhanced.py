"""Enhanced tests for email sender implementations and template helpers."""

from __future__ import annotations

import json
import logging
import smtplib
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from album_conceptualizer.emailing import (
    ConsoleEmailSender,
    NoopEmailSender,
    NotificationItem,
    OutboxEmailSender,
    SMTPEmailSender,
    create_email_sender,
    send_email,
    send_magic_link,
    send_notification_digest,
    send_workspace_invite,
)


# ---------------------------------------------------------------------------
# OutboxEmailSender
# ---------------------------------------------------------------------------


class TestOutboxEmailSender:
    """Tests for the outbox (local dev) email backend."""

    def test_writes_individual_json_file(self, tmp_path: Path) -> None:
        outbox_dir = tmp_path / "outbox"
        sender = OutboxEmailSender(outbox_dir)

        sender.send(to_email="a@example.com", subject="Hello", body="World")

        json_files = list(outbox_dir.glob("*.json"))
        assert len(json_files) == 1
        payload = json.loads(json_files[0].read_text(encoding="utf-8"))
        assert payload["email"] == "a@example.com"
        assert payload["subject"] == "Hello"
        assert payload["body"] == "World"
        assert "timestamp" in payload
        assert "id" in payload

    def test_appends_to_jsonl_log(self, tmp_path: Path) -> None:
        outbox_dir = tmp_path / "outbox"
        sender = OutboxEmailSender(outbox_dir)

        sender.send(to_email="a@example.com", subject="First", body="1")
        sender.send(to_email="b@example.com", subject="Second", body="2")

        jsonl_path = outbox_dir / "outbox.jsonl"
        lines = jsonl_path.read_text(encoding="utf-8").strip().splitlines()
        assert len(lines) == 2
        assert json.loads(lines[0])["subject"] == "First"
        assert json.loads(lines[1])["subject"] == "Second"

    def test_creates_outbox_directory_if_missing(self, tmp_path: Path) -> None:
        outbox_dir = tmp_path / "deep" / "nested" / "outbox"
        sender = OutboxEmailSender(outbox_dir)

        sender.send(to_email="x@example.com", subject="Test", body="Body")

        assert outbox_dir.is_dir()
        assert len(list(outbox_dir.glob("*.json"))) == 1

    def test_multiple_sends_produce_separate_files(self, tmp_path: Path) -> None:
        outbox_dir = tmp_path / "outbox"
        sender = OutboxEmailSender(outbox_dir)

        for i in range(5):
            sender.send(to_email=f"user{i}@example.com", subject=f"Msg {i}", body=f"Body {i}")

        json_files = list(outbox_dir.glob("*.json"))
        assert len(json_files) == 5


# ---------------------------------------------------------------------------
# ConsoleEmailSender
# ---------------------------------------------------------------------------


class TestConsoleEmailSender:
    """Tests for the console (stdout/log) email backend."""

    def test_prints_email_to_stdout(self, capsys: pytest.CaptureFixture[str]) -> None:
        sender = ConsoleEmailSender()
        sender.send(to_email="user@example.com", subject="Console Test", body="Hello from console")

        captured = capsys.readouterr()
        assert "To: user@example.com" in captured.out
        assert "Subject: Console Test" in captured.out
        assert "Hello from console" in captured.out

    def test_logs_email_info(self, caplog: pytest.LogCaptureFixture) -> None:
        sender = ConsoleEmailSender()
        with caplog.at_level(logging.INFO, logger="album_conceptualizer.email"):
            sender.send(to_email="log@example.com", subject="Log Test", body="Hello")

        assert any("email_console" in record.message for record in caplog.records)


# ---------------------------------------------------------------------------
# NoopEmailSender
# ---------------------------------------------------------------------------


class TestNoopEmailSender:
    """Tests for the noop (silent drop) email backend."""

    def test_logs_without_sending(self, caplog: pytest.LogCaptureFixture) -> None:
        sender = NoopEmailSender()
        with caplog.at_level(logging.INFO, logger="album_conceptualizer.email"):
            sender.send(to_email="noop@example.com", subject="Noop", body="Dropped")

        assert any("email_noop" in record.message for record in caplog.records)


# ---------------------------------------------------------------------------
# SMTPEmailSender
# ---------------------------------------------------------------------------


class TestSMTPEmailSender:
    """Tests for the SMTP email backend."""

    def _make_fake_smtp(self, calls: dict) -> type:
        """Create a fake SMTP class that records calls."""

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
                calls["message_from"] = message["From"]
                calls["message_subject"] = message["Subject"]
                calls["message_reply_to"] = message.get("Reply-To")
                calls["message_body"] = message.get_content().strip()

        return FakeSMTP

    def test_constructs_correct_mime_message(self, monkeypatch: pytest.MonkeyPatch) -> None:
        calls: dict = {}
        monkeypatch.setattr("smtplib.SMTP", self._make_fake_smtp(calls))

        sender = SMTPEmailSender(
            host="mail.example.com",
            port=587,
            from_email="noreply@example.com",
            reply_to="support@example.com",
            username="user",
            password="pass",
            use_tls=True,
            use_ssl=False,
        )
        sender.send(to_email="dest@example.com", subject="Test", body="Hello SMTP")

        assert calls["message_to"] == "dest@example.com"
        assert calls["message_from"] == "noreply@example.com"
        assert calls["message_subject"] == "Test"
        assert calls["message_reply_to"] == "support@example.com"
        assert calls["message_body"] == "Hello SMTP"

    def test_starttls_flow(self, monkeypatch: pytest.MonkeyPatch) -> None:
        calls: dict = {}
        monkeypatch.setattr("smtplib.SMTP", self._make_fake_smtp(calls))

        sender = SMTPEmailSender(
            host="mail.example.com",
            port=587,
            from_email="noreply@example.com",
            username="u",
            password="p",
            use_tls=True,
            use_ssl=False,
        )
        sender.send(to_email="r@example.com", subject="S", body="B")

        assert calls["starttls"] is True
        assert calls["login"] == ("u", "p")
        assert calls["ehlo"] == 2  # Before and after starttls

    def test_ssl_flow(self, monkeypatch: pytest.MonkeyPatch) -> None:
        calls: dict = {}
        FakeSMTP_SSL = self._make_fake_smtp(calls)
        monkeypatch.setattr("smtplib.SMTP_SSL", FakeSMTP_SSL)

        sender = SMTPEmailSender(
            host="mail.example.com",
            port=465,
            from_email="noreply@example.com",
            username="u",
            password="p",
            use_tls=False,
            use_ssl=True,
        )
        sender.send(to_email="r@example.com", subject="SSL", body="Secure")

        assert calls["host"] == "mail.example.com"
        assert calls["port"] == 465
        assert calls["login"] == ("u", "p")
        assert calls["message_subject"] == "SSL"

    def test_no_auth_when_credentials_missing(self, monkeypatch: pytest.MonkeyPatch) -> None:
        calls: dict = {}
        monkeypatch.setattr("smtplib.SMTP", self._make_fake_smtp(calls))

        sender = SMTPEmailSender(
            host="mail.example.com",
            port=25,
            from_email="noreply@example.com",
            username=None,
            password=None,
            use_tls=False,
            use_ssl=False,
        )
        sender.send(to_email="r@example.com", subject="NoAuth", body="Plain")

        assert "login" not in calls
        assert "starttls" not in calls

    def test_smtp_exception_is_raised(self, monkeypatch: pytest.MonkeyPatch) -> None:
        class FailingSMTP:
            def __init__(self, host, port, timeout):
                pass

            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return False

            def ehlo(self):
                pass

            def starttls(self):
                pass

            def login(self, username, password):
                pass

            def send_message(self, message):
                raise smtplib.SMTPRecipientsRefused({"bad@example.com": (550, b"rejected")})

        monkeypatch.setattr("smtplib.SMTP", FailingSMTP)

        sender = SMTPEmailSender(
            host="mail.example.com",
            port=587,
            from_email="noreply@example.com",
            username="u",
            password="p",
            use_tls=True,
            use_ssl=False,
        )

        with pytest.raises(smtplib.SMTPRecipientsRefused):
            sender.send(to_email="bad@example.com", subject="Fail", body="Should fail")

    def test_connection_error_is_raised(self, monkeypatch: pytest.MonkeyPatch) -> None:
        class ConnectionFailSMTP:
            def __init__(self, host, port, timeout):
                raise OSError("Connection refused")

        monkeypatch.setattr("smtplib.SMTP", ConnectionFailSMTP)

        sender = SMTPEmailSender(
            host="bad-host.example.com",
            port=587,
            from_email="noreply@example.com",
            use_tls=True,
            use_ssl=False,
        )

        with pytest.raises(OSError, match="Connection refused"):
            sender.send(to_email="r@example.com", subject="Fail", body="Connection fail")


# ---------------------------------------------------------------------------
# create_email_sender factory
# ---------------------------------------------------------------------------


class TestCreateEmailSender:
    """Tests for the create_email_sender factory function."""

    def _settings(self, tmp_path: Path, **overrides) -> SimpleNamespace:
        defaults = dict(
            email_provider="outbox",
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
        defaults.update(overrides)
        return SimpleNamespace(**defaults)

    def test_outbox_is_default(self, tmp_path: Path) -> None:
        sender = create_email_sender(self._settings(tmp_path))
        assert isinstance(sender, OutboxEmailSender)
        assert sender.outbox_dir == tmp_path / "outbox"

    def test_console_backend(self, tmp_path: Path) -> None:
        sender = create_email_sender(self._settings(tmp_path, email_provider="console"))
        assert isinstance(sender, ConsoleEmailSender)

    def test_noop_backend(self, tmp_path: Path) -> None:
        sender = create_email_sender(self._settings(tmp_path, email_provider="noop"))
        assert isinstance(sender, NoopEmailSender)

    def test_smtp_backend_valid(self, tmp_path: Path) -> None:
        sender = create_email_sender(
            self._settings(
                tmp_path,
                email_provider="smtp",
                smtp_host="smtp.example.com",
                email_from="noreply@example.com",
            )
        )
        assert isinstance(sender, SMTPEmailSender)
        assert sender.host == "smtp.example.com"

    def test_smtp_missing_host_raises(self, tmp_path: Path) -> None:
        with pytest.raises(ValueError, match="SMTP email provider requires"):
            create_email_sender(
                self._settings(tmp_path, email_provider="smtp", email_from="a@b.com")
            )

    def test_smtp_missing_from_raises(self, tmp_path: Path) -> None:
        with pytest.raises(ValueError, match="SMTP email provider requires"):
            create_email_sender(
                self._settings(tmp_path, email_provider="smtp", smtp_host="host.com")
            )

    def test_smtp_ssl_and_tls_raises(self, tmp_path: Path) -> None:
        with pytest.raises(ValueError, match="only one"):
            create_email_sender(
                self._settings(
                    tmp_path,
                    email_provider="smtp",
                    smtp_host="host.com",
                    email_from="a@b.com",
                    smtp_use_ssl=True,
                    smtp_use_tls=True,
                )
            )

    def test_provider_is_case_insensitive(self, tmp_path: Path) -> None:
        sender = create_email_sender(self._settings(tmp_path, email_provider="  Console  "))
        assert isinstance(sender, ConsoleEmailSender)


# ---------------------------------------------------------------------------
# send_email convenience wrapper
# ---------------------------------------------------------------------------


class TestSendEmail:
    """Tests for the send_email() convenience function."""

    def test_returns_true_on_success(self) -> None:
        mock_sender = MagicMock()
        result = send_email(mock_sender, to_email="a@b.com", subject="S", body="B")
        assert result is True
        mock_sender.send.assert_called_once_with(to_email="a@b.com", subject="S", body="B")

    def test_returns_false_on_failure(self) -> None:
        mock_sender = MagicMock()
        mock_sender.send.side_effect = smtplib.SMTPException("fail")
        result = send_email(mock_sender, to_email="a@b.com", subject="S", body="B")
        assert result is False

    def test_logs_failure(self, caplog: pytest.LogCaptureFixture) -> None:
        mock_sender = MagicMock()
        mock_sender.send.side_effect = RuntimeError("boom")
        with caplog.at_level(logging.ERROR, logger="album_conceptualizer.email"):
            send_email(mock_sender, to_email="x@y.com", subject="Fail", body="Err")
        assert any("send_email_failed" in record.message for record in caplog.records)


# ---------------------------------------------------------------------------
# Template: send_workspace_invite
# ---------------------------------------------------------------------------


class TestSendWorkspaceInvite:
    """Tests for the workspace invite email template."""

    def test_produces_correct_subject_and_body(self) -> None:
        mock_sender = MagicMock()
        result = send_workspace_invite(
            mock_sender,
            to_email="invitee@example.com",
            workspace_name="My Band",
            inviter_name="Alice",
            invite_url="https://app.example.com/invite?token=abc123",
        )
        assert result is True

        call_kwargs = mock_sender.send.call_args[1]
        assert call_kwargs["to_email"] == "invitee@example.com"
        assert "My Band" in call_kwargs["subject"]
        assert "invite" in call_kwargs["subject"].lower()
        assert "Alice" in call_kwargs["body"]
        assert "My Band" in call_kwargs["body"]
        assert "https://app.example.com/invite?token=abc123" in call_kwargs["body"]

    def test_returns_false_on_send_failure(self) -> None:
        mock_sender = MagicMock()
        mock_sender.send.side_effect = RuntimeError("fail")
        result = send_workspace_invite(
            mock_sender,
            to_email="x@y.com",
            workspace_name="W",
            inviter_name="I",
            invite_url="http://example.com",
        )
        assert result is False


# ---------------------------------------------------------------------------
# Template: send_magic_link
# ---------------------------------------------------------------------------


class TestSendMagicLink:
    """Tests for the magic-link sign-in email template."""

    def test_produces_correct_subject_and_body(self) -> None:
        mock_sender = MagicMock()
        result = send_magic_link(
            mock_sender,
            to_email="user@example.com",
            magic_link_url="https://app.example.com/auth/magic?token=xyz789",
        )
        assert result is True

        call_kwargs = mock_sender.send.call_args[1]
        assert call_kwargs["to_email"] == "user@example.com"
        assert "sign-in" in call_kwargs["subject"].lower()
        assert "https://app.example.com/auth/magic?token=xyz789" in call_kwargs["body"]
        assert "Album Conceptualizer" in call_kwargs["body"]

    def test_returns_false_on_send_failure(self) -> None:
        mock_sender = MagicMock()
        mock_sender.send.side_effect = OSError("connection refused")
        result = send_magic_link(
            mock_sender,
            to_email="x@y.com",
            magic_link_url="http://example.com",
        )
        assert result is False


# ---------------------------------------------------------------------------
# Template: send_notification_digest
# ---------------------------------------------------------------------------


class TestSendNotificationDigest:
    """Tests for the notification digest email template."""

    def test_single_notification_dict(self) -> None:
        mock_sender = MagicMock()
        result = send_notification_digest(
            mock_sender,
            to_email="user@example.com",
            notifications=[
                {"title": "New comment on 'Track 3'", "description": "Alice said: great work!"},
            ],
        )
        assert result is True

        call_kwargs = mock_sender.send.call_args[1]
        assert "1 unread notification" in call_kwargs["subject"]
        assert "notification" in call_kwargs["subject"]
        assert "notifications" not in call_kwargs["subject"]  # singular
        assert "New comment on 'Track 3'" in call_kwargs["body"]
        assert "Alice said: great work!" in call_kwargs["body"]

    def test_multiple_notifications_with_items(self) -> None:
        mock_sender = MagicMock()
        notifications = [
            NotificationItem(title="Task assigned", description="Mix track 5", timestamp="2h ago"),
            NotificationItem(title="Comment reply", timestamp="5h ago"),
            NotificationItem(title="Workspace update"),
        ]
        result = send_notification_digest(
            mock_sender,
            to_email="user@example.com",
            notifications=notifications,
        )
        assert result is True

        call_kwargs = mock_sender.send.call_args[1]
        assert "3 unread notifications" in call_kwargs["subject"]
        assert "Task assigned" in call_kwargs["body"]
        assert "2h ago" in call_kwargs["body"]
        assert "Mix track 5" in call_kwargs["body"]
        assert "Comment reply" in call_kwargs["body"]
        assert "Workspace update" in call_kwargs["body"]

    def test_empty_notifications_returns_true_without_sending(self) -> None:
        mock_sender = MagicMock()
        result = send_notification_digest(
            mock_sender,
            to_email="user@example.com",
            notifications=[],
        )
        assert result is True
        mock_sender.send.assert_not_called()

    def test_mixed_dict_and_item_notifications(self) -> None:
        mock_sender = MagicMock()
        notifications: list = [
            {"title": "Dict notif", "timestamp": "1h ago"},
            NotificationItem(title="Item notif", description="Details"),
        ]
        result = send_notification_digest(
            mock_sender,
            to_email="user@example.com",
            notifications=notifications,
        )
        assert result is True

        call_kwargs = mock_sender.send.call_args[1]
        assert "Dict notif" in call_kwargs["body"]
        assert "Item notif" in call_kwargs["body"]

    def test_returns_false_on_send_failure(self) -> None:
        mock_sender = MagicMock()
        mock_sender.send.side_effect = RuntimeError("boom")
        result = send_notification_digest(
            mock_sender,
            to_email="x@y.com",
            notifications=[{"title": "Test"}],
        )
        assert result is False


# ---------------------------------------------------------------------------
# Integration: outbox backend with templates
# ---------------------------------------------------------------------------


class TestOutboxIntegration:
    """End-to-end tests using the outbox backend with template helpers."""

    def test_workspace_invite_writes_to_outbox(self, tmp_path: Path) -> None:
        outbox_dir = tmp_path / "outbox"
        sender = OutboxEmailSender(outbox_dir)

        send_workspace_invite(
            sender,
            to_email="new@example.com",
            workspace_name="The Concept Album",
            inviter_name="Producer",
            invite_url="https://app.test/invite?token=tok123",
        )

        json_files = list(outbox_dir.glob("*.json"))
        assert len(json_files) == 1
        payload = json.loads(json_files[0].read_text(encoding="utf-8"))
        assert payload["email"] == "new@example.com"
        assert "The Concept Album" in payload["subject"]
        assert "Producer" in payload["body"]
        assert "tok123" in payload["body"]

    def test_magic_link_writes_to_outbox(self, tmp_path: Path) -> None:
        outbox_dir = tmp_path / "outbox"
        sender = OutboxEmailSender(outbox_dir)

        send_magic_link(
            sender,
            to_email="signin@example.com",
            magic_link_url="https://app.test/auth/magic?token=ml456",
        )

        json_files = list(outbox_dir.glob("*.json"))
        assert len(json_files) == 1
        payload = json.loads(json_files[0].read_text(encoding="utf-8"))
        assert payload["email"] == "signin@example.com"
        assert "sign-in" in payload["subject"].lower()
        assert "ml456" in payload["body"]

    def test_digest_writes_to_outbox(self, tmp_path: Path) -> None:
        outbox_dir = tmp_path / "outbox"
        sender = OutboxEmailSender(outbox_dir)

        send_notification_digest(
            sender,
            to_email="digest@example.com",
            notifications=[
                {"title": "Feedback received"},
                {"title": "New collaborator joined"},
            ],
        )

        json_files = list(outbox_dir.glob("*.json"))
        assert len(json_files) == 1
        payload = json.loads(json_files[0].read_text(encoding="utf-8"))
        assert payload["email"] == "digest@example.com"
        assert "2 unread notifications" in payload["subject"]
        assert "Feedback received" in payload["body"]
        assert "New collaborator joined" in payload["body"]
