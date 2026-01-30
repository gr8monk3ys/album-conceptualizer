"""Optional telemetry for usage analytics.

This module provides opt-in, privacy-respecting telemetry to help improve
the Album Conceptualizer. All telemetry is:
- Opt-in by default (disabled unless explicitly enabled)
- Anonymous (no personal information collected)
- Transparent (all events are logged locally)
- Configurable (can be disabled at any time)

To enable telemetry, set the environment variable:
    ALBUM_CONCEPTUALIZER_TELEMETRY=true

Or in code:
    from album_conceptualizer.telemetry import enable_telemetry
    enable_telemetry()
"""

import hashlib
import os
import platform
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field


class TelemetryEvent(BaseModel):
    """A telemetry event."""

    event_type: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    session_id: str
    properties: dict[str, Any] = Field(default_factory=dict)
    app_version: str = "0.1.0"
    python_version: str = Field(default_factory=lambda: platform.python_version())
    os_name: str = Field(default_factory=lambda: platform.system())
    os_version: str = Field(default_factory=lambda: platform.release())


class TelemetryClient:
    """
    Client for collecting and sending telemetry events.

    All telemetry is opt-in and anonymous.
    """

    def __init__(
        self,
        enabled: bool = False,
        endpoint: str | None = None,
        local_log: bool = True,
    ):
        """
        Initialize the telemetry client.

        Args:
            enabled: Whether telemetry is enabled
            endpoint: Remote endpoint for sending events (optional)
            local_log: Whether to log events locally
        """
        self._enabled = enabled
        self._endpoint = endpoint
        self._local_log = local_log
        self._session_id = self._generate_session_id()
        self._events: list[TelemetryEvent] = []
        self._log_path = Path.home() / ".album-conceptualizer" / "telemetry.log"

    @staticmethod
    def _generate_session_id() -> str:
        """Generate an anonymous session ID."""
        # Create a hash that's consistent per machine but anonymous
        machine_id = str(uuid.getnode())  # MAC address based
        session_seed = f"{machine_id}-{datetime.utcnow().date()}"
        return hashlib.sha256(session_seed.encode()).hexdigest()[:16]

    @property
    def enabled(self) -> bool:
        """Check if telemetry is enabled."""
        return self._enabled

    def enable(self) -> None:
        """Enable telemetry collection."""
        self._enabled = True

    def disable(self) -> None:
        """Disable telemetry collection."""
        self._enabled = False

    def track(self, event_type: str, properties: dict[str, Any] | None = None) -> None:
        """
        Track a telemetry event.

        Args:
            event_type: Type of event (e.g., 'album_created', 'song_added')
            properties: Additional properties for the event
        """
        if not self._enabled:
            return

        event = TelemetryEvent(
            event_type=event_type,
            session_id=self._session_id,
            properties=properties or {},
        )

        self._events.append(event)

        if self._local_log:
            self._log_event(event)

    def _log_event(self, event: TelemetryEvent) -> None:
        """Log event to local file."""
        try:
            self._log_path.parent.mkdir(parents=True, exist_ok=True)
            with self._log_path.open("a") as f:
                f.write(event.model_dump_json() + "\n")
        except (OSError, PermissionError):
            pass  # Silently fail if we can't write

    def flush(self) -> None:
        """Send pending events to remote endpoint."""
        if not self._enabled or not self._endpoint or not self._events:
            return

        # In a real implementation, this would send to the endpoint
        # For now, we just clear the events
        self._events.clear()

    def get_events(self) -> list[TelemetryEvent]:
        """Get all collected events (for debugging)."""
        return self._events.copy()


# Global telemetry client instance
_client: TelemetryClient | None = None


def get_telemetry_client() -> TelemetryClient:
    """Get the global telemetry client."""
    global _client
    if _client is None:
        # Check environment variable
        enabled = os.getenv("ALBUM_CONCEPTUALIZER_TELEMETRY", "").lower() in (
            "true",
            "1",
            "yes",
        )
        _client = TelemetryClient(enabled=enabled)
    return _client


def enable_telemetry() -> None:
    """Enable telemetry globally."""
    get_telemetry_client().enable()


def disable_telemetry() -> None:
    """Disable telemetry globally."""
    get_telemetry_client().disable()


def track(event_type: str, properties: dict[str, Any] | None = None) -> None:
    """
    Track a telemetry event.

    This is a convenience function that uses the global client.

    Args:
        event_type: Type of event
        properties: Additional properties
    """
    get_telemetry_client().track(event_type, properties)


# Predefined event types
class Events:
    """Standard telemetry event types."""

    # Application events
    APP_STARTED = "app_started"
    APP_STOPPED = "app_stopped"

    # Album events
    ALBUM_CREATED = "album_created"
    ALBUM_DELETED = "album_deleted"
    ALBUM_EXPORTED = "album_exported"

    # Song events
    SONG_CREATED = "song_created"
    SONG_UPDATED = "song_updated"
    SONG_DELETED = "song_deleted"

    # Feature usage
    AI_AGENT_USED = "ai_agent_used"
    RAG_QUERY = "rag_query"
    CHORD_ANALYSIS = "chord_analysis"
    EXPORT_GENERATED = "export_generated"

    # UI events
    UI_TAB_VIEWED = "ui_tab_viewed"
    UI_FEATURE_USED = "ui_feature_used"

    # Error events
    ERROR_OCCURRED = "error_occurred"
