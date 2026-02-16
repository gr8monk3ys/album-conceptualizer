"""Logging utilities for Album Conceptualizer.

This module keeps the original ``configure_logging`` / ``get_logger`` API
for backward compatibility and re-exports the new structured-logging
helpers from :mod:`album_conceptualizer.logging_config`.
"""

from __future__ import annotations

import logging
import os

# Re-export structured logging primitives so callers can import from either
# ``album_conceptualizer.logging`` or ``album_conceptualizer.logging_config``.
from album_conceptualizer.logging_config import (  # noqa: F401
    JSONFormatter,
    request_id_var,
    setup_logging,
)

LOG_LEVELS: dict[str, int] = {
    "CRITICAL": logging.CRITICAL,
    "ERROR": logging.ERROR,
    "WARNING": logging.WARNING,
    "INFO": logging.INFO,
    "DEBUG": logging.DEBUG,
}


def configure_logging(level: str | None = None) -> None:
    """Configure application-wide logging.

    This now delegates to :func:`setup_logging` for structured JSON output.
    """
    raw_level = level if isinstance(level, str) else os.getenv("LOG_LEVEL", "INFO")
    effective_level = raw_level.upper() if isinstance(raw_level, str) else "INFO"
    setup_logging(effective_level)


def get_logger(name: str) -> logging.Logger:
    """Get a logger with the configured settings."""
    return logging.getLogger(name)
