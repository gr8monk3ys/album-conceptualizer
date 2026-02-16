"""Configuration management for Album Conceptualizer."""

import json
from pathlib import Path

from pydantic import AliasChoices, BaseModel, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class LLMConfig(BaseModel):
    """Configuration for LLM providers."""

    provider: str = Field(default="anthropic", description="LLM provider (anthropic, openai)")
    model: str = Field(default="claude-sonnet-4-20250514", description="Model identifier")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(default=4096, gt=0)


class RAGConfig(BaseModel):
    """Configuration for RAG system."""

    vector_store: str = Field(default="chroma", description="Vector store (chroma, weaviate)")
    embedding_model: str = Field(
        default="all-MiniLM-L6-v2", description="Sentence transformer model"
    )
    chunk_size: int = Field(default=512, gt=0)
    chunk_overlap: int = Field(default=50, ge=0)
    semantic_weight: float = Field(
        default=0.6, ge=0.0, le=1.0, description="Weight for hybrid search"
    )
    top_k: int = Field(default=5, gt=0)


class AgentConfig(BaseModel):
    """Configuration for CrewAI agents."""

    verbose: bool = Field(default=True)
    memory: bool = Field(default=True)
    max_iterations: int = Field(default=15, gt=0)
    allow_delegation: bool = Field(default=True)


class ExportConfig(BaseModel):
    """Configuration for export formats."""

    default_tempo: int = Field(default=120, gt=0)
    default_time_signature: tuple[int, int] = Field(default=(4, 4))
    midi_velocity: int = Field(default=100, ge=0, le=127)


class Settings(BaseSettings):
    """Main application settings."""

    # API Keys (loaded from environment)
    anthropic_api_key: str | None = Field(default=None, alias="ANTHROPIC_API_KEY")
    openai_api_key: str | None = Field(default=None, alias="OPENAI_API_KEY")
    hooktheory_api_key: str | None = Field(default=None, alias="HOOKTHEORY_API_KEY")
    replicate_api_token: str | None = Field(default=None, alias="REPLICATE_API_TOKEN")
    api_key: str | None = Field(default=None, alias="ALBUM_CONCEPTUALIZER_API_KEY")
    api_keys: list[str] = Field(
        default_factory=list,
        alias="ALBUM_CONCEPTUALIZER_API_KEYS",
    )

    # Rate limiting
    rate_limit_enabled: bool = Field(
        default=False,
        alias="ALBUM_CONCEPTUALIZER_RATE_LIMIT_ENABLED",
    )
    rate_limit_backend: str = Field(
        default="memory",
        alias="ALBUM_CONCEPTUALIZER_RATE_LIMIT_BACKEND",
    )
    rate_limit_per_minute: int = Field(
        default=120,
        gt=0,
        alias="ALBUM_CONCEPTUALIZER_RATE_LIMIT_PER_MINUTE",
    )

    # Quotas (basic usage caps)
    quota_enabled: bool = Field(
        default=False,
        alias="ALBUM_CONCEPTUALIZER_QUOTA_ENABLED",
    )
    quota_backend: str = Field(
        default="memory",
        alias="ALBUM_CONCEPTUALIZER_QUOTA_BACKEND",
    )
    quota_daily_limit: int = Field(
        default=1000,
        gt=0,
        alias="ALBUM_CONCEPTUALIZER_QUOTA_DAILY_LIMIT",
    )

    redis_url: str | None = Field(
        default=None,
        alias="ALBUM_CONCEPTUALIZER_REDIS_URL",
    )
    collab_realtime_backend: str = Field(
        default="memory",
        alias="ALBUM_CONCEPTUALIZER_COLLAB_REALTIME_BACKEND",
    )
    collab_realtime_ttl_seconds: int = Field(
        default=90,
        ge=30,
        le=3600,
        alias="ALBUM_CONCEPTUALIZER_COLLAB_REALTIME_TTL_SECONDS",
    )

    # Subscription and billing
    subscription_required: bool = Field(
        default=False,
        alias="ALBUM_CONCEPTUALIZER_SUBSCRIPTION_REQUIRED",
    )
    billing_provider: str = Field(
        default="stripe",
        alias="ALBUM_CONCEPTUALIZER_BILLING_PROVIDER",
    )
    stripe_secret_key: str | None = Field(default=None, alias="STRIPE_SECRET_KEY")
    stripe_webhook_secret: str | None = Field(default=None, alias="STRIPE_WEBHOOK_SECRET")
    billing_success_url: str = Field(
        default="http://localhost:7860/billing/success",
        alias="ALBUM_CONCEPTUALIZER_BILLING_SUCCESS_URL",
    )
    billing_cancel_url: str = Field(
        default="http://localhost:7860/billing/cancel",
        alias="ALBUM_CONCEPTUALIZER_BILLING_CANCEL_URL",
    )
    strict_production: bool = Field(
        default=False,
        alias="ALBUM_CONCEPTUALIZER_STRICT_PRODUCTION",
    )
    identity_magic_link_ttl_hours: int = Field(
        default=24,
        ge=1,
        le=168,
        alias="ALBUM_CONCEPTUALIZER_IDENTITY_MAGIC_LINK_TTL_HOURS",
    )
    identity_invite_ttl_hours: int = Field(
        default=72,
        ge=1,
        le=24 * 14,
        alias="ALBUM_CONCEPTUALIZER_IDENTITY_INVITE_TTL_HOURS",
    )
    identity_debug_tokens: bool = Field(
        default=False,
        alias="ALBUM_CONCEPTUALIZER_IDENTITY_DEBUG_TOKENS",
    )
    identity_require_verified_email: bool = Field(
        default=True,
        alias="ALBUM_CONCEPTUALIZER_IDENTITY_REQUIRE_VERIFIED_EMAIL",
    )
    identity_magic_link_url_template: str = Field(
        default="http://localhost:7860/auth/magic-link?token={token}",
        alias="ALBUM_CONCEPTUALIZER_IDENTITY_MAGIC_LINK_URL_TEMPLATE",
    )
    identity_invite_url_template: str = Field(
        default="http://localhost:7860/auth/invite?token={token}",
        alias="ALBUM_CONCEPTUALIZER_IDENTITY_INVITE_URL_TEMPLATE",
    )
    email_provider: str = Field(
        default="outbox",
        alias="ALBUM_CONCEPTUALIZER_EMAIL_PROVIDER",
    )
    email_from: str | None = Field(default=None, alias="ALBUM_CONCEPTUALIZER_EMAIL_FROM")
    email_reply_to: str | None = Field(default=None, alias="ALBUM_CONCEPTUALIZER_EMAIL_REPLY_TO")
    smtp_host: str | None = Field(default=None, alias="ALBUM_CONCEPTUALIZER_SMTP_HOST")
    smtp_port: int = Field(default=587, ge=1, le=65535, alias="ALBUM_CONCEPTUALIZER_SMTP_PORT")
    smtp_username: str | None = Field(default=None, alias="ALBUM_CONCEPTUALIZER_SMTP_USERNAME")
    smtp_password: str | None = Field(default=None, alias="ALBUM_CONCEPTUALIZER_SMTP_PASSWORD")
    smtp_use_tls: bool = Field(default=True, alias="ALBUM_CONCEPTUALIZER_SMTP_USE_TLS")
    smtp_use_ssl: bool = Field(default=False, alias="ALBUM_CONCEPTUALIZER_SMTP_USE_SSL")
    smtp_timeout_seconds: float = Field(
        default=10.0,
        ge=1.0,
        le=120.0,
        alias="ALBUM_CONCEPTUALIZER_SMTP_TIMEOUT_SECONDS",
    )

    # Logging
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    # Storage
    storage_backend: str = Field(
        default="memory",
        alias="ALBUM_CONCEPTUALIZER_STORAGE_BACKEND",
    )
    storage_db_path: Path = Field(
        default=Path("./data/album_conceptualizer.db"),
        alias="ALBUM_CONCEPTUALIZER_STORAGE_DB",
    )

    # CORS
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000"],
        alias="ALBUM_CONCEPTUALIZER_CORS_ORIGINS",
    )

    # Paths
    data_dir: Path = Field(default=Path("./data"))
    cache_dir: Path = Field(default=Path("./cache"))
    output_dir: Path = Field(default=Path("./output"))
    chroma_persist_directory: Path | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "CHROMA_PERSIST_DIRECTORY",
            "CHROMA_PERSIST_DIR",
            "ALBUM_CONCEPTUALIZER_CHROMA_PERSIST_DIRECTORY",
        ),
        description="ChromaDB persistence directory (optional)",
    )

    # Sub-configurations
    llm: LLMConfig = Field(default_factory=LLMConfig)
    rag: RAGConfig = Field(default_factory=RAGConfig)
    agents: AgentConfig = Field(default_factory=AgentConfig)
    export: ExportConfig = Field(default_factory=ExportConfig)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    def ensure_directories(self) -> None:
        """Create necessary directories if they don't exist."""
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def configured_api_keys(self) -> list[str]:
        """Return all configured API keys in effective lookup order."""
        return self.api_keys or ([self.api_key] if self.api_key else [])

    def production_issues(self) -> list[str]:
        """Return production safety issues based on current settings."""
        issues: list[str] = []
        if "*" in self.cors_origins:
            issues.append("ALBUM_CONCEPTUALIZER_CORS_ORIGINS cannot include '*' in strict mode")
        if not self.configured_api_keys():
            issues.append(
                "Set ALBUM_CONCEPTUALIZER_API_KEY or ALBUM_CONCEPTUALIZER_API_KEYS in strict mode"
            )
        if self.storage_backend == "memory":
            issues.append("ALBUM_CONCEPTUALIZER_STORAGE_BACKEND cannot be 'memory' in strict mode")
        if self.collab_realtime_backend == "redis" and not self.redis_url:
            issues.append(
                "Set ALBUM_CONCEPTUALIZER_REDIS_URL when "
                "ALBUM_CONCEPTUALIZER_COLLAB_REALTIME_BACKEND=redis in strict mode"
            )
        if self.subscription_required and (
            not self.stripe_secret_key or not self.stripe_webhook_secret
        ):
            issues.append(
                "Subscription gating requires STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in strict mode"
            )
        if self.identity_debug_tokens:
            issues.append("ALBUM_CONCEPTUALIZER_IDENTITY_DEBUG_TOKENS must be false in strict mode")
        if self.email_provider.strip().lower() == "smtp":
            if not self.smtp_host:
                issues.append(
                    "Set ALBUM_CONCEPTUALIZER_SMTP_HOST when ALBUM_CONCEPTUALIZER_EMAIL_PROVIDER=smtp"
                )
            if not self.email_from:
                issues.append(
                    "Set ALBUM_CONCEPTUALIZER_EMAIL_FROM when ALBUM_CONCEPTUALIZER_EMAIL_PROVIDER=smtp"
                )
            if self.smtp_use_ssl and self.smtp_use_tls:
                issues.append(
                    "Only one of ALBUM_CONCEPTUALIZER_SMTP_USE_SSL or ALBUM_CONCEPTUALIZER_SMTP_USE_TLS may be true"
                )
        return issues

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors_origins(cls, value: object) -> list[str]:
        if value is None:
            return ["http://localhost:3000"]
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            stripped = value.strip()
            if stripped.startswith("[") and stripped.endswith("]"):
                try:
                    loaded = json.loads(stripped)
                except json.JSONDecodeError:
                    loaded = None
                if isinstance(loaded, list):
                    parsed = [item for item in loaded if isinstance(item, str) and item.strip()]
                    return parsed or ["http://localhost:3000"]
            cleaned = [item.strip() for item in value.split(",") if item.strip()]
            return cleaned or ["http://localhost:3000"]
        return ["http://localhost:3000"]

    @field_validator("collab_realtime_backend")
    @classmethod
    def _validate_collab_realtime_backend(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"memory", "redis"}:
            raise ValueError("collab_realtime_backend must be 'memory' or 'redis'")
        return normalized

    @field_validator("api_keys", mode="before")
    @classmethod
    def _parse_api_keys(cls, value: object) -> list[str]:
        if value is None:
            return []
        if isinstance(value, list):
            return [item for item in value if isinstance(item, str) and item.strip()]
        if isinstance(value, str):
            stripped = value.strip()
            if stripped.startswith("[") and stripped.endswith("]"):
                try:
                    loaded = json.loads(stripped)
                except json.JSONDecodeError:
                    loaded = None
                if isinstance(loaded, list):
                    return [item for item in loaded if isinstance(item, str) and item.strip()]
            cleaned = [item.strip() for item in value.split(",") if item.strip()]
            return cleaned
        return []


# Global settings instance
_settings: Settings | None = None


def get_settings() -> Settings:
    """Get or create the global settings instance."""
    global _settings
    if _settings is None:
        _settings = Settings()
        _settings.ensure_directories()
    return _settings


def configure(**kwargs) -> Settings:
    """Configure settings with custom values."""
    global _settings
    _settings = Settings(**kwargs)
    _settings.ensure_directories()
    return _settings


def reset_settings() -> None:
    """Reset cached settings to force reloading from environment."""
    global _settings
    _settings = None
