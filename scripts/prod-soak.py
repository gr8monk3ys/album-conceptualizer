#!/usr/bin/env python3
"""Run a bounded soak test against production-safe API endpoints."""

from __future__ import annotations

import argparse
import asyncio
import os
import random
import statistics
import time
from collections import Counter
from dataclasses import dataclass

import httpx


@dataclass(frozen=True)
class Endpoint:
    path: str
    auth_required: bool


def normalize_base_url(base_url: str) -> str:
    """Normalize base URL so callers can pass either host root or /api(/v1) URL."""
    normalized = base_url.rstrip("/")
    for suffix in ("/api/v1", "/api"):
        if normalized.endswith(suffix):
            normalized = normalized[: -len(suffix)]
    return normalized


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--base-url",
        default=os.getenv("ALBUM_CONCEPTUALIZER_BASE_URL", "http://localhost:8000"),
        help=(
            "API base URL. Accepts host root or URLs ending with /api or /api/v1 "
            "(default: %(default)s)."
        ),
    )
    parser.add_argument(
        "--api-key",
        default=os.getenv("ALBUM_CONCEPTUALIZER_API_KEY"),
        help="API key used for authenticated endpoints.",
    )
    parser.add_argument(
        "--duration",
        type=int,
        default=180,
        help="Soak duration in seconds (default: %(default)s).",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=12,
        help="Concurrent workers (default: %(default)s).",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=20.0,
        help="Per-request timeout seconds (default: %(default)s).",
    )
    parser.add_argument(
        "--sleep-ms",
        type=int,
        default=20,
        help="Delay between requests per worker in milliseconds (default: %(default)s).",
    )
    parser.add_argument(
        "--max-error-rate",
        type=float,
        default=1.0,
        help="Maximum allowed error rate percentage (default: %(default)s).",
    )
    parser.add_argument(
        "--max-p95-ms",
        type=float,
        default=1200.0,
        help="Maximum allowed p95 latency in ms (default: %(default)s).",
    )
    return parser.parse_args()


def percentile(sorted_values: list[float], pct: float) -> float:
    """Return percentile value from sorted samples."""
    if not sorted_values:
        return 0.0
    if len(sorted_values) == 1:
        return sorted_values[0]
    position = (len(sorted_values) - 1) * pct
    lower = int(position)
    upper = min(lower + 1, len(sorted_values) - 1)
    weight = position - lower
    return sorted_values[lower] * (1 - weight) + sorted_values[upper] * weight


async def worker(
    name: str,
    client: httpx.AsyncClient,
    base_url: str,
    api_key: str | None,
    endpoints: list[Endpoint],
    stop_at: float,
    sleep_seconds: float,
) -> tuple[int, int, Counter[int], list[float], list[str]]:
    """Issue requests until stop time and return local worker metrics."""
    total = 0
    success = 0
    status_counts: Counter[int] = Counter()
    latencies_ms: list[float] = []
    errors: list[str] = []

    while time.monotonic() < stop_at:
        endpoint = random.choice(endpoints)
        headers: dict[str, str] = {}
        if endpoint.auth_required and api_key:
            headers["X-API-Key"] = api_key

        started = time.perf_counter()
        try:
            response = await client.get(f"{base_url}{endpoint.path}", headers=headers)
            elapsed_ms = (time.perf_counter() - started) * 1000
            latencies_ms.append(elapsed_ms)
            total += 1
            status_counts[response.status_code] += 1
            if response.status_code == 200:
                success += 1
            elif len(errors) < 20:
                errors.append(
                    f"{name} {endpoint.path} -> HTTP {response.status_code}: "
                    f"{response.text[:160].strip()}"
                )
        except Exception as exc:  # pragma: no cover - network failures are environment-dependent
            elapsed_ms = (time.perf_counter() - started) * 1000
            latencies_ms.append(elapsed_ms)
            total += 1
            if len(errors) < 20:
                errors.append(f"{name} {endpoint.path} -> EXC {exc}")

        if sleep_seconds > 0:
            await asyncio.sleep(sleep_seconds)

    return total, success, status_counts, latencies_ms, errors


async def run() -> int:
    args = parse_args()
    base_url = normalize_base_url(args.base_url)
    api_key = args.api_key
    if not api_key:
        print("[FAIL] Missing API key. Set --api-key or ALBUM_CONCEPTUALIZER_API_KEY.")
        return 1

    endpoints = [
        Endpoint("/api/v1/health", auth_required=False),
        Endpoint("/api/v1/albums", auth_required=True),
        Endpoint("/api/v1/experience/prompt-packs", auth_required=True),
        Endpoint("/api/v1/experience/templates", auth_required=True),
        Endpoint("/api/v1/experience/challenges/weekly", auth_required=True),
    ]

    stop_at = time.monotonic() + max(args.duration, 1)
    sleep_seconds = max(args.sleep_ms, 0) / 1000

    print(
        "[STEP] Starting soak:",
        f"base={base_url}",
        f"duration={args.duration}s",
        f"concurrency={args.concurrency}",
        f"sleep={args.sleep_ms}ms",
    )

    async with httpx.AsyncClient(
        timeout=args.timeout,
        follow_redirects=True,
        verify=True,
    ) as client:
        tasks = [
            worker(
                f"worker-{idx + 1}",
                client,
                base_url,
                api_key,
                endpoints,
                stop_at,
                sleep_seconds,
            )
            for idx in range(max(args.concurrency, 1))
        ]
        results = await asyncio.gather(*tasks)

    total = sum(item[0] for item in results)
    success = sum(item[1] for item in results)
    status_counts: Counter[int] = Counter()
    latencies_ms: list[float] = []
    errors: list[str] = []
    for _, _, statuses, latencies, worker_errors in results:
        status_counts.update(statuses)
        latencies_ms.extend(latencies)
        errors.extend(worker_errors)

    if total == 0:
        print("[FAIL] No requests were sent.")
        return 1

    failed = total - success
    error_rate = (failed / total) * 100
    latencies_ms.sort()
    p50 = percentile(latencies_ms, 0.50)
    p95 = percentile(latencies_ms, 0.95)
    p99 = percentile(latencies_ms, 0.99)
    avg = statistics.fmean(latencies_ms)

    print("[RESULT] total_requests=", total)
    print("[RESULT] success_requests=", success)
    print("[RESULT] failed_requests=", failed)
    print("[RESULT] error_rate_pct=", f"{error_rate:.3f}")
    print("[RESULT] latency_ms_avg=", f"{avg:.2f}")
    print("[RESULT] latency_ms_p50=", f"{p50:.2f}")
    print("[RESULT] latency_ms_p95=", f"{p95:.2f}")
    print("[RESULT] latency_ms_p99=", f"{p99:.2f}")
    print("[RESULT] status_counts=", dict(sorted(status_counts.items())))
    if errors:
        print("[RESULT] sample_errors=")
        for err in errors[:10]:
            print("  -", err)

    if error_rate > args.max_error_rate:
        print(
            f"[FAIL] Error rate {error_rate:.3f}% exceeds allowed {args.max_error_rate:.3f}%.",
        )
        return 1
    if p95 > args.max_p95_ms:
        print(
            f"[FAIL] p95 latency {p95:.2f}ms exceeds allowed {args.max_p95_ms:.2f}ms.",
        )
        return 1

    print("[PASS] Soak thresholds satisfied.")
    return 0


def main() -> int:
    return asyncio.run(run())


if __name__ == "__main__":
    raise SystemExit(main())

