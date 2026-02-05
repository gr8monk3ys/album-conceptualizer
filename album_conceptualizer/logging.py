"""Logging utilities for Album Conceptualizer."""

from __future__ import annotations

import logging
import os
from typing import Literal


LOG_LEVELS: dict[str, int] = {
    "CRITICAL": logging.CRITICAL,
    "ERROR": logging.ERROR,
    "WARNING": logging.WARNING,
    "INFO": logging.INFO,
    "DEBUG": logging.DEBUG,
}


def configure_logging(level: str | None = None) -> None:
    """Configure application-wide logging."""
    effective_level = (level or os.getenv("LOG_LEVEL", "INFO")).upper()
    logging.basicConfig(
        level=LOG_LEVELS.get(effective_level, logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


def get_logger(name: str) -> logging.Logger:
    """Get a logger with the configured settings."""
    return logging.getLogger(name)
