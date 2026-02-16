"""Basic metrics registry for API monitoring."""

from __future__ import annotations

import sys
import time
from collections import defaultdict
from dataclasses import dataclass, field

import album_conceptualizer


@dataclass
class MetricsRegistry:
    """In-memory metrics registry.

    Tracks request counts, status code distribution, per-endpoint counts,
    and latency statistics including min, max, average, and an approximate
    p95 using a simple sorted-reservoir approach.
    """

    request_count: int = 0
    error_count: int = 0
    status_counts: dict[int, int] = field(default_factory=lambda: defaultdict(int))
    path_counts: dict[str, int] = field(default_factory=lambda: defaultdict(int))
    total_duration_ms: float = 0.0
    path_duration_ms: dict[str, float] = field(default_factory=lambda: defaultdict(float))
    min_duration_ms: float = field(default=float("inf"))
    max_duration_ms: float = 0.0
    _started_at: float = field(default_factory=time.monotonic)
    # Keep a bounded reservoir of recent latencies for p95 approximation.
    _latency_reservoir: list[float] = field(default_factory=list)
    _RESERVOIR_SIZE: int = field(default=1000, repr=False)

    def record(self, path: str, status: int, duration_ms: float | None = None) -> None:
        self.request_count += 1
        self.status_counts[status] += 1
        self.path_counts[path] += 1
        if duration_ms is not None:
            self.total_duration_ms += duration_ms
            self.path_duration_ms[path] += duration_ms
            if duration_ms < self.min_duration_ms:
                self.min_duration_ms = duration_ms
            if duration_ms > self.max_duration_ms:
                self.max_duration_ms = duration_ms
            reservoir = self._latency_reservoir
            if len(reservoir) < self._RESERVOIR_SIZE:
                reservoir.append(duration_ms)
            else:
                # Rotate oldest entry out.
                reservoir[self.request_count % self._RESERVOIR_SIZE] = duration_ms

    def record_error(self) -> None:
        self.error_count += 1

    @property
    def uptime_seconds(self) -> float:
        return round(time.monotonic() - self._started_at, 2)

    def _p95(self) -> float:
        """Return approximate p95 latency from the reservoir."""
        if not self._latency_reservoir:
            return 0.0
        sorted_vals = sorted(self._latency_reservoir)
        idx = int(len(sorted_vals) * 0.95)
        idx = min(idx, len(sorted_vals) - 1)
        return round(sorted_vals[idx], 2)

    def to_dict(self) -> dict[str, object]:
        avg_duration_ms = 0.0
        if self.request_count > 0:
            avg_duration_ms = round(self.total_duration_ms / self.request_count, 2)
        return {
            "request_count": self.request_count,
            "error_count": self.error_count,
            "status_counts": dict(self.status_counts),
            "path_counts": dict(self.path_counts),
            "total_duration_ms": round(self.total_duration_ms, 2),
            "avg_duration_ms": avg_duration_ms,
            "min_duration_ms": round(self.min_duration_ms, 2)
            if self.min_duration_ms != float("inf")
            else 0.0,
            "max_duration_ms": round(self.max_duration_ms, 2),
            "p95_duration_ms": self._p95(),
            "path_duration_ms": {
                path: round(value, 2) for path, value in self.path_duration_ms.items()
            },
            "uptime_seconds": self.uptime_seconds,
            "python_version": sys.version,
            "app_version": album_conceptualizer.__version__,
        }
