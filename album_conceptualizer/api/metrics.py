"""Basic metrics registry for API monitoring."""

from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass, field


_HISTOGRAM_MAX_SAMPLES = 1_000


def _percentile(sorted_values: list[float], p: float) -> float:
    """Return the *p*-th percentile (0-100) from a sorted list."""
    if not sorted_values:
        return 0.0
    k = (len(sorted_values) - 1) * p / 100.0
    lo = int(k)
    hi = min(lo + 1, len(sorted_values) - 1)
    weight = k - lo
    return sorted_values[lo] + weight * (sorted_values[hi] - sorted_values[lo])


@dataclass
class MetricsRegistry:
    """In-memory metrics registry with latency percentiles."""

    request_count: int = 0
    error_count: int = 0
    status_counts: dict[int, int] = field(default_factory=lambda: defaultdict(int))
    path_counts: dict[str, int] = field(default_factory=lambda: defaultdict(int))
    total_duration_ms: float = 0.0
    path_duration_ms: dict[str, float] = field(default_factory=lambda: defaultdict(float))
    _latencies: deque[float] = field(default_factory=lambda: deque(maxlen=_HISTOGRAM_MAX_SAMPLES))

    def record(self, path: str, status: int, duration_ms: float | None = None) -> None:
        self.request_count += 1
        self.status_counts[status] += 1
        self.path_counts[path] += 1
        if duration_ms is not None:
            self.total_duration_ms += duration_ms
            self.path_duration_ms[path] += duration_ms
            self._latencies.append(duration_ms)

    def record_error(self) -> None:
        self.error_count += 1

    def latency_percentiles(self) -> dict[str, float]:
        """Return p50, p95, p99 latency in milliseconds over recent samples."""
        if not self._latencies:
            return {"p50": 0.0, "p95": 0.0, "p99": 0.0}
        sorted_vals = sorted(self._latencies)
        return {
            "p50": round(_percentile(sorted_vals, 50), 2),
            "p95": round(_percentile(sorted_vals, 95), 2),
            "p99": round(_percentile(sorted_vals, 99), 2),
        }

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
            "latency_percentiles": self.latency_percentiles(),
            "path_duration_ms": {
                path: round(value, 2) for path, value in self.path_duration_ms.items()
            },
        }
