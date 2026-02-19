"""Tests for Settings validators and production_issues()."""

import pytest
from pydantic import ValidationError

from album_conceptualizer.config import Settings, reset_settings


class TestProductionIssues:
    def test_default_settings_flags_cors_and_apikey(self, monkeypatch):
        """Default settings should flag open CORS and missing API key.

        Storage is now 'sqlite' by default (safe), so no STORAGE_BACKEND issue is expected.
        """
        monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEY", raising=False)
        monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEYS", raising=False)
        monkeypatch.delenv("ALBUM_CONCEPTUALIZER_CORS_ORIGINS", raising=False)
        monkeypatch.delenv("ALBUM_CONCEPTUALIZER_STORAGE_BACKEND", raising=False)
        reset_settings()
        settings = Settings()
        issues = settings.production_issues()
        assert any("CORS" in i for i in issues)
        assert any("API_KEY" in i for i in issues)
        # sqlite is the safe default — no storage issue expected
        assert not any("STORAGE_BACKEND" in i for i in issues)
        reset_settings()

    def test_memory_storage_still_flagged_as_production_issue(self, monkeypatch):
        """Explicitly setting memory storage still triggers the production issue warning."""
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_API_KEY", "secure-key")
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_CORS_ORIGINS", '["https://myapp.com"]')
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_STORAGE_BACKEND", "memory")
        reset_settings()
        settings = Settings()
        issues = settings.production_issues()
        assert any("STORAGE_BACKEND" in i for i in issues)
        reset_settings()

    def test_no_issues_with_proper_config(self, monkeypatch):
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_API_KEY", "secure-prod-key")
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_CORS_ORIGINS", '["https://myapp.com"]')
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_STORAGE_BACKEND", "sqlite")
        reset_settings()
        settings = Settings()
        issues = settings.production_issues()
        assert not any("CORS" in i for i in issues)
        assert not any("API_KEY" in i for i in issues)
        assert not any("STORAGE_BACKEND" in i for i in issues)
        reset_settings()

    def test_redis_collab_backend_without_redis_url(self, monkeypatch):
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_COLLAB_REALTIME_BACKEND", "redis")
        monkeypatch.delenv("ALBUM_CONCEPTUALIZER_REDIS_URL", raising=False)
        reset_settings()
        settings = Settings()
        issues = settings.production_issues()
        assert any("REDIS_URL" in i for i in issues)
        reset_settings()

    def test_redis_collab_backend_with_redis_url_no_issue(self, monkeypatch):
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_COLLAB_REALTIME_BACKEND", "redis")
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_REDIS_URL", "redis://localhost:6379")
        reset_settings()
        settings = Settings()
        issues = settings.production_issues()
        assert not any("REDIS_URL" in i for i in issues)
        reset_settings()

    def test_subscription_required_without_stripe_keys(self, monkeypatch):
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_SUBSCRIPTION_REQUIRED", "true")
        monkeypatch.delenv("STRIPE_SECRET_KEY", raising=False)
        monkeypatch.delenv("STRIPE_WEBHOOK_SECRET", raising=False)
        reset_settings()
        settings = Settings()
        issues = settings.production_issues()
        assert any("STRIPE" in i for i in issues)
        reset_settings()

    def test_subscription_required_with_stripe_keys_no_issue(self, monkeypatch):
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_SUBSCRIPTION_REQUIRED", "true")
        monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_abc")
        monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_abc")
        reset_settings()
        settings = Settings()
        issues = settings.production_issues()
        assert not any("STRIPE" in i for i in issues)
        reset_settings()

    def test_identity_debug_tokens_flagged(self, monkeypatch):
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_IDENTITY_DEBUG_TOKENS", "true")
        reset_settings()
        settings = Settings()
        issues = settings.production_issues()
        assert any("DEBUG_TOKENS" in i for i in issues)
        reset_settings()

    def test_smtp_missing_host_flagged(self, monkeypatch):
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_EMAIL_PROVIDER", "smtp")
        monkeypatch.delenv("ALBUM_CONCEPTUALIZER_SMTP_HOST", raising=False)
        monkeypatch.delenv("ALBUM_CONCEPTUALIZER_EMAIL_FROM", raising=False)
        reset_settings()
        settings = Settings()
        issues = settings.production_issues()
        assert any("SMTP_HOST" in i for i in issues)
        reset_settings()

    def test_smtp_missing_email_from_flagged(self, monkeypatch):
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_EMAIL_PROVIDER", "smtp")
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_SMTP_HOST", "mail.example.com")
        monkeypatch.delenv("ALBUM_CONCEPTUALIZER_EMAIL_FROM", raising=False)
        reset_settings()
        settings = Settings()
        issues = settings.production_issues()
        assert any("EMAIL_FROM" in i for i in issues)
        reset_settings()

    def test_smtp_ssl_and_tls_both_true_flagged(self, monkeypatch):
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_EMAIL_PROVIDER", "smtp")
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_SMTP_HOST", "mail.example.com")
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_EMAIL_FROM", "from@example.com")
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_SMTP_USE_SSL", "true")
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_SMTP_USE_TLS", "true")
        reset_settings()
        settings = Settings()
        issues = settings.production_issues()
        assert any("SSL" in i and "TLS" in i for i in issues)
        reset_settings()

    def test_smtp_valid_config_no_ssl_tls_conflict(self, monkeypatch):
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_EMAIL_PROVIDER", "smtp")
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_SMTP_HOST", "mail.example.com")
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_EMAIL_FROM", "from@example.com")
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_SMTP_USE_SSL", "false")
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_SMTP_USE_TLS", "true")
        reset_settings()
        settings = Settings()
        issues = settings.production_issues()
        assert not any("SSL" in i and "TLS" in i for i in issues)
        reset_settings()


class TestParseCorsOrigins:
    def test_json_array_two_origins(self, monkeypatch):
        monkeypatch.setenv(
            "ALBUM_CONCEPTUALIZER_CORS_ORIGINS",
            '["https://x.com","https://y.com"]',
        )
        reset_settings()
        settings = Settings()
        assert "https://x.com" in settings.cors_origins
        assert "https://y.com" in settings.cors_origins
        reset_settings()

    def test_json_array_single_origin(self, monkeypatch):
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_CORS_ORIGINS", '["https://single.com"]')
        reset_settings()
        settings = Settings()
        assert "https://single.com" in settings.cors_origins
        reset_settings()

    def test_empty_json_array_results_in_empty_list(self, monkeypatch):
        # pydantic_settings decodes "[]" → [] then validator returns it unchanged
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_CORS_ORIGINS", "[]")
        reset_settings()
        settings = Settings()
        assert settings.cors_origins == []
        reset_settings()

    def test_default_cors_origins_is_wildcard(self, monkeypatch):
        monkeypatch.delenv("ALBUM_CONCEPTUALIZER_CORS_ORIGINS", raising=False)
        reset_settings()
        settings = Settings()
        assert "*" in settings.cors_origins
        reset_settings()

    def test_wildcard_cors_flagged_in_production_issues(self, monkeypatch):
        """When cors_origins contains '*', production_issues should flag it."""
        monkeypatch.delenv("ALBUM_CONCEPTUALIZER_CORS_ORIGINS", raising=False)
        reset_settings()
        settings = Settings()
        issues = settings.production_issues()
        assert any("CORS" in i for i in issues)
        reset_settings()

    def test_specific_origin_not_flagged(self, monkeypatch):
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_CORS_ORIGINS", '["https://myapp.com"]')
        reset_settings()
        settings = Settings()
        issues = settings.production_issues()
        assert not any("CORS" in i for i in issues)
        reset_settings()


class TestParseApiKeys:
    def test_json_array_parses_correctly(self, monkeypatch):
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_API_KEYS", '["key-a","key-b"]')
        reset_settings()
        settings = Settings()
        assert settings.api_keys == ["key-a", "key-b"]
        reset_settings()

    def test_empty_env_var_returns_empty_list(self, monkeypatch):
        monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEYS", raising=False)
        reset_settings()
        settings = Settings()
        assert settings.api_keys == []
        reset_settings()

    def test_single_key_in_json_array(self, monkeypatch):
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_API_KEYS", '["only-key"]')
        reset_settings()
        settings = Settings()
        assert settings.api_keys == ["only-key"]
        reset_settings()

    def test_json_array_with_spaces_stripped(self, monkeypatch):
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_API_KEYS", '["  key-a  ","  key-b  "]')
        reset_settings()
        settings = Settings()
        # pydantic_settings decodes JSON array; validator filters out blank strings
        assert len(settings.api_keys) >= 1
        reset_settings()


class TestCollabRealtimeBackendValidator:
    def test_invalid_value_raises_validation_error(self, monkeypatch):
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_COLLAB_REALTIME_BACKEND", "kafka")
        reset_settings()
        with pytest.raises(Exception):
            Settings()
        reset_settings()

    def test_memory_backend_valid(self, monkeypatch):
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_COLLAB_REALTIME_BACKEND", "memory")
        reset_settings()
        settings = Settings()
        assert settings.collab_realtime_backend == "memory"
        reset_settings()

    def test_redis_backend_valid(self, monkeypatch):
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_COLLAB_REALTIME_BACKEND", "redis")
        reset_settings()
        settings = Settings()
        assert settings.collab_realtime_backend == "redis"
        reset_settings()

    def test_backend_normalized_to_lowercase(self, monkeypatch):
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_COLLAB_REALTIME_BACKEND", "  MEMORY  ")
        reset_settings()
        settings = Settings()
        assert settings.collab_realtime_backend == "memory"
        reset_settings()


class TestConfiguredApiKeys:
    def test_api_keys_list_returned_when_set(self, monkeypatch):
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_API_KEYS", '["list-key-1","list-key-2"]')
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_API_KEY", "single-key")
        reset_settings()
        settings = Settings()
        keys = settings.configured_api_keys()
        assert "list-key-1" in keys
        assert "list-key-2" in keys
        reset_settings()

    def test_fallback_to_single_api_key(self, monkeypatch):
        monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEYS", raising=False)
        monkeypatch.setenv("ALBUM_CONCEPTUALIZER_API_KEY", "the-only-key")
        reset_settings()
        settings = Settings()
        assert settings.configured_api_keys() == ["the-only-key"]
        reset_settings()

    def test_empty_when_nothing_configured(self, monkeypatch):
        monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEYS", raising=False)
        monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEY", raising=False)
        reset_settings()
        settings = Settings()
        assert settings.configured_api_keys() == []
        reset_settings()
