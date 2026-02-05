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

    def record(self, path: str, status: int) -> None:
        self.request_count += 1
        self.status_counts[status] += 1
        self.path_counts[path] += 1

    def record_error(self) -> None:
        self.error_count += 1

    def to_dict(self) -> dict[str, object]:
        return {
            "request_count": self.request_count,
            "error_count": self.error_count,
            "status_counts": dict(self.status_counts),
            "path_counts": dict(self.path_counts),
        }
