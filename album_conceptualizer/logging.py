"""Logging utilities for Album Conceptualizer."""

from __future__ import annotations

import logging
import os


LOG_LEVELS: dict[str, int] = {
    "CRITICAL": logging.CRITICAL,
    "ERROR": logging.ERROR,
    "WARNING": logging.WARNING,
    "INFO": logging.INFO,
    "DEBUG": logging.DEBUG,
}


def configure_logging(level: str | None = None) -> None:
    """Configure application-wide logging."""
    raw_level = level if isinstance(level, str) else os.getenv("LOG_LEVEL", "INFO")
    effective_level = raw_level.upper() if isinstance(raw_level, str) else "INFO"
    logging.basicConfig(
        level=LOG_LEVELS.get(effective_level, logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


def get_logger(name: str) -> logging.Logger:
    """Get a logger with the configured settings."""
    return logging.getLogger(name)
