"""Configuration management for Album Conceptualizer."""

from pathlib import Path

from pydantic import BaseModel, Field, field_validator
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
        default_factory=lambda: ["*"],
        alias="ALBUM_CONCEPTUALIZER_CORS_ORIGINS",
    )

    # Paths
    data_dir: Path = Field(default=Path("./data"))
    cache_dir: Path = Field(default=Path("./cache"))
    output_dir: Path = Field(default=Path("./output"))
    chroma_persist_directory: Path | None = Field(
        default=None, description="ChromaDB persistence directory (optional)"
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

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors_origins(cls, value: object) -> list[str]:
        if value is None:
            return ["*"]
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            cleaned = [item.strip() for item in value.split(",") if item.strip()]
            return cleaned or ["*"]
        return ["*"]

    @field_validator("api_keys", mode="before")
    @classmethod
    def _parse_api_keys(cls, value: object) -> list[str]:
        if value is None:
            return []
        if isinstance(value, list):
            return [item for item in value if isinstance(item, str) and item.strip()]
        if isinstance(value, str):
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
