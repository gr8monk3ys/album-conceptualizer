"""Tests for Sentry error monitoring setup."""

from __future__ import annotations

import builtins
import importlib
from unittest.mock import MagicMock, patch

import pytest

from album_conceptualizer.config import Settings, reset_settings


# ---------------------------------------------------------------------------
# Config field defaults
# ---------------------------------------------------------------------------


class TestSentryConfigDefaults:
    """Verify that the Settings model exposes the expected Sentry fields."""

    def test_sentry_dsn_default_is_none(self) -> None:
        settings = Settings()
        assert settings.sentry_dsn is None

    def test_sentry_environment_default(self) -> None:
        settings = Settings()
        assert settings.sentry_environment == "development"

    def test_sentry_traces_sample_rate_default(self) -> None:
        settings = Settings()
        assert settings.sentry_traces_sample_rate == 0.1

    def test_sentry_dsn_from_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("SENTRY_DSN", "https://abc@sentry.io/123")
        reset_settings()
        settings = Settings()
        assert settings.sentry_dsn == "https://abc@sentry.io/123"
        reset_settings()

    def test_sentry_environment_from_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("SENTRY_ENVIRONMENT", "production")
        reset_settings()
        settings = Settings()
        assert settings.sentry_environment == "production"
        reset_settings()

    def test_sentry_traces_sample_rate_from_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("SENTRY_TRACES_SAMPLE_RATE", "0.5")
        reset_settings()
        settings = Settings()
        assert settings.sentry_traces_sample_rate == 0.5
        reset_settings()

    def test_sentry_traces_sample_rate_validation_lower_bound(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("SENTRY_TRACES_SAMPLE_RATE", "-0.1")
        reset_settings()
        with pytest.raises(Exception):
            Settings()
        reset_settings()

    def test_sentry_traces_sample_rate_validation_upper_bound(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("SENTRY_TRACES_SAMPLE_RATE", "1.5")
        reset_settings()
        with pytest.raises(Exception):
            Settings()
        reset_settings()


# ---------------------------------------------------------------------------
# init_sentry behaviour
# ---------------------------------------------------------------------------


class TestInitSentry:
    """Test the init_sentry function under various conditions."""

    def test_returns_false_when_dsn_is_none(self) -> None:
        from album_conceptualizer.sentry_setup import init_sentry

        assert init_sentry(None) is False

    def test_returns_false_when_dsn_is_empty_string(self) -> None:
        from album_conceptualizer.sentry_setup import init_sentry

        assert init_sentry("") is False

    def test_initializes_sentry_with_valid_dsn(self) -> None:
        from album_conceptualizer.sentry_setup import init_sentry

        mock_init = MagicMock()
        mock_fastapi = MagicMock()
        mock_starlette = MagicMock()
        mock_logging_integration = MagicMock()

        with (
            patch.dict(
                "sys.modules",
                {
                    "sentry_sdk": MagicMock(init=mock_init),
                    "sentry_sdk.integrations": MagicMock(),
                    "sentry_sdk.integrations.fastapi": MagicMock(
                        FastApiIntegration=mock_fastapi,
                    ),
                    "sentry_sdk.integrations.starlette": MagicMock(
                        StarletteIntegration=mock_starlette,
                    ),
                    "sentry_sdk.integrations.logging": MagicMock(
                        LoggingIntegration=mock_logging_integration,
                    ),
                },
            ),
        ):
            # Re-import to pick up the mocked modules
            import album_conceptualizer.sentry_setup as mod

            importlib.reload(mod)
            result = mod.init_sentry(
                dsn="https://fake@sentry.io/123",
                environment="staging",
                traces_sample_rate=0.5,
            )

        assert result is True
        mock_init.assert_called_once()
        call_kwargs = mock_init.call_args[1]
        assert call_kwargs["dsn"] == "https://fake@sentry.io/123"
        assert call_kwargs["environment"] == "staging"
        assert call_kwargs["traces_sample_rate"] == 0.5
        assert call_kwargs["send_default_pii"] is False
        assert call_kwargs["enable_tracing"] is True

    def test_handles_import_error_gracefully(self) -> None:
        """init_sentry returns False when sentry_sdk is not installed."""
        from album_conceptualizer.sentry_setup import init_sentry

        real_import = builtins.__import__

        def _block_sentry(name, *args, **kwargs):
            if name == "sentry_sdk" or name.startswith("sentry_sdk."):
                raise ImportError("No module named 'sentry_sdk'")
            return real_import(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=_block_sentry):
            # Force a fresh import path by reloading the module
            import album_conceptualizer.sentry_setup as mod

            importlib.reload(mod)
            result = mod.init_sentry(dsn="https://fake@sentry.io/123")

        assert result is False

    def test_handles_generic_exception_gracefully(self) -> None:
        """init_sentry returns False when sentry_sdk.init raises an unexpected error."""
        from album_conceptualizer.sentry_setup import init_sentry

        mock_init = MagicMock(side_effect=RuntimeError("unexpected"))

        with patch.dict(
            "sys.modules",
            {
                "sentry_sdk": MagicMock(init=mock_init),
                "sentry_sdk.integrations": MagicMock(),
                "sentry_sdk.integrations.fastapi": MagicMock(),
                "sentry_sdk.integrations.starlette": MagicMock(),
                "sentry_sdk.integrations.logging": MagicMock(),
            },
        ):
            import album_conceptualizer.sentry_setup as mod

            importlib.reload(mod)
            result = mod.init_sentry(dsn="https://fake@sentry.io/123")

        assert result is False
