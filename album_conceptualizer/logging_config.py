"""Structured JSON logging configuration for Album Conceptualizer.

Provides a JSON formatter that outputs structured log records and a
``setup_logging`` helper to be called once at application startup.

The request-id context variable allows middleware to tag every log line
emitted during a single HTTP request with the same correlation identifier.
"""

from __future__ import annotations

import contextvars
import json
import logging
import logging.config
import sys
from datetime import UTC, datetime
from typing import Any

# ---------------------------------------------------------------------------
# Context variable – set per-request by the RequestIDMiddleware
# ---------------------------------------------------------------------------

request_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "request_id", default=None
)


# ---------------------------------------------------------------------------
# JSON formatter
# ---------------------------------------------------------------------------

class JSONFormatter(logging.Formatter):
    """Emit each log record as a single JSON object.

    Fields always present: ``timestamp``, ``level``, ``logger``, ``message``.
    If a *request_id* is set in the context variable it is included
    automatically.  Any *extra* keys passed via ``logger.info("msg",
    extra={...})`` are merged into the top-level object.
    """

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": self.formatMessage(record),
        }

        # Inject request-id from contextvars (if set).
        rid = request_id_var.get()
        if rid is not None:
            payload["request_id"] = rid

        # Merge caller-supplied extras.  We skip keys that belong to the
        # standard ``LogRecord`` so we only capture user-provided values.
        _STANDARD_ATTRS = logging.LogRecord(
            "", 0, "", 0, "", (), None
        ).__dict__.keys()
        for key, value in record.__dict__.items():
            if key not in _STANDARD_ATTRS and key not in payload:
                payload[key] = value

        # Include exception info when present.
        if record.exc_info and record.exc_info[1] is not None:
            payload["exception"] = self.formatException(record.exc_info)

        return json.dumps(payload, default=str)


# ---------------------------------------------------------------------------
# Setup helper
# ---------------------------------------------------------------------------

_LOG_LEVELS: dict[str, int] = {
    "CRITICAL": logging.CRITICAL,
    "ERROR": logging.ERROR,
    "WARNING": logging.WARNING,
    "INFO": logging.INFO,
    "DEBUG": logging.DEBUG,
}


def setup_logging(level: str | None = None) -> None:
    """Configure structured JSON logging for the application.

    Parameters
    ----------
    level:
        Log-level string (e.g. ``"INFO"``).  Falls back to the ``LOG_LEVEL``
        environment variable via :class:`~album_conceptualizer.config.Settings`.
    """
    import os

    effective_level = (level or os.getenv("LOG_LEVEL", "INFO")).upper()
    numeric_level = _LOG_LEVELS.get(effective_level, logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())

    root = logging.getLogger()
    # Remove any pre-existing handlers to avoid duplicate output when
    # ``setup_logging`` is called after ``configure_logging`` (the legacy
    # helper) has already run.
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(numeric_level)

    # Quieten noisy third-party loggers.
    for noisy in ("uvicorn.access", "httpcore", "httpx"):
        logging.getLogger(noisy).setLevel(max(numeric_level, logging.WARNING))
