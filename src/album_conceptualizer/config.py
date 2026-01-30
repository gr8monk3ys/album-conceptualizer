"""Configuration management for Album Conceptualizer."""

import os
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings


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
    semantic_weight: float = Field(default=0.6, ge=0.0, le=1.0, description="Weight for hybrid search")
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
    anthropic_api_key: Optional[str] = Field(default=None, alias="ANTHROPIC_API_KEY")
    openai_api_key: Optional[str] = Field(default=None, alias="OPENAI_API_KEY")
    hooktheory_api_key: Optional[str] = Field(default=None, alias="HOOKTHEORY_API_KEY")

    # Paths
    data_dir: Path = Field(default=Path("./data"))
    cache_dir: Path = Field(default=Path("./cache"))
    output_dir: Path = Field(default=Path("./output"))

    # Sub-configurations
    llm: LLMConfig = Field(default_factory=LLMConfig)
    rag: RAGConfig = Field(default_factory=RAGConfig)
    agents: AgentConfig = Field(default_factory=AgentConfig)
    export: ExportConfig = Field(default_factory=ExportConfig)

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

    def ensure_directories(self) -> None:
        """Create necessary directories if they don't exist."""
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.output_dir.mkdir(parents=True, exist_ok=True)


# Global settings instance
_settings: Optional[Settings] = None


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
