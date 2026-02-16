"""Sentry error monitoring setup."""

from __future__ import annotations

import logging

logger = logging.getLogger("album_conceptualizer.sentry_setup")


def init_sentry(
    dsn: str | None,
    environment: str = "development",
    traces_sample_rate: float = 0.1,
) -> bool:
    """Initialize Sentry SDK.

    Returns True if Sentry was successfully initialized, False otherwise.
    Handles missing ``sentry-sdk`` gracefully so the application can run
    without the optional monitoring dependency.
    """
    if not dsn:
        logger.info("Sentry DSN not configured, skipping initialization")
        return False

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration

        sentry_sdk.init(
            dsn=dsn,
            environment=environment,
            traces_sample_rate=traces_sample_rate,
            integrations=[
                FastApiIntegration(transaction_style="endpoint"),
                StarletteIntegration(transaction_style="endpoint"),
                LoggingIntegration(level=logging.WARNING, event_level=logging.ERROR),
            ],
            # Don't send PII (user emails, IPs)
            send_default_pii=False,
            # Attach request data but scrub sensitive headers
            request_bodies="medium",
            # Enable performance monitoring
            enable_tracing=True,
        )
        logger.info(
            "Sentry initialized",
            extra={"environment": environment, "sample_rate": traces_sample_rate},
        )
        return True
    except ImportError:
        logger.warning("sentry-sdk not installed, skipping Sentry initialization")
        return False
    except Exception as exc:
        logger.error("Failed to initialize Sentry: %s", exc)
        return False
