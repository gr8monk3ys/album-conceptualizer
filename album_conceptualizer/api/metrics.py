"""Basic metrics registry for API monitoring."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field


@dataclass
class MetricsRegistry:
    """In-memory metrics registry."""

    request_count: int = 0
    error_count: int = 0
    status_counts: dict[int, int] = field(default_factory=lambda: defaultdict(int))
    path_counts: dict[str, int] = field(default_factory=lambda: defaultdict(int))
    total_duration_ms: float = 0.0
    path_duration_ms: dict[str, float] = field(default_factory=lambda: defaultdict(float))

    def record(self, path: str, status: int, duration_ms: float | None = None) -> None:
        self.request_count += 1
        self.status_counts[status] += 1
        self.path_counts[path] += 1
        if duration_ms is not None:
            self.total_duration_ms += duration_ms
            self.path_duration_ms[path] += duration_ms

    def record_error(self) -> None:
        self.error_count += 1

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
            "path_duration_ms": {path: round(value, 2) for path, value in self.path_duration_ms.items()},
        }
