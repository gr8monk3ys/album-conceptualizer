#!/usr/bin/env python3
"""Simple load test for the Album Conceptualizer API.

Usage:
    python scripts/load-test.py [base_url] [num_requests] [concurrency]

    Defaults: http://localhost:8000 100 10
"""
import argparse
import asyncio
import json
import statistics
import time
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError


async def run_request(base_url: str, endpoint: str, method: str = "GET", body: dict | None = None) -> dict:
    """Run a single HTTP request and return timing info."""
    url = f"{base_url}{endpoint}"
    start = time.perf_counter()
    status = 0
    error = None

    try:
        req = Request(url, method=method)
        req.add_header("Content-Type", "application/json")
        if body:
            req.data = json.dumps(body).encode()

        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(None, lambda: urlopen(req, timeout=10))
        status = response.status
    except HTTPError as exc:
        status = exc.code
    except URLError as exc:
        error = str(exc)
    except Exception as exc:
        error = str(exc)

    elapsed = (time.perf_counter() - start) * 1000  # ms
    return {"endpoint": endpoint, "status": status, "elapsed_ms": elapsed, "error": error}


async def run_load_test(base_url: str, num_requests: int, concurrency: int):
    """Run the load test."""
    endpoints = [
        ("/api/v1/health", "GET"),
        ("/api/v1/ready", "GET"),
        ("/api/v1/metrics", "GET"),
    ]

    print(f"\nLoad Test: {base_url}")
    print(f"Requests: {num_requests} | Concurrency: {concurrency}")
    print("=" * 60)

    semaphore = asyncio.Semaphore(concurrency)

    async def bounded_request(endpoint, method):
        async with semaphore:
            return await run_request(base_url, endpoint, method)

    tasks = []
    for i in range(num_requests):
        endpoint, method = endpoints[i % len(endpoints)]
        tasks.append(bounded_request(endpoint, method))

    start = time.perf_counter()
    results = await asyncio.gather(*tasks)
    total_time = time.perf_counter() - start

    # Analyze results
    timings = [r["elapsed_ms"] for r in results if r["error"] is None]
    errors = [r for r in results if r["error"] is not None]
    status_counts = {}
    for r in results:
        s = r["status"]
        status_counts[s] = status_counts.get(s, 0) + 1

    print(f"\nResults ({total_time:.2f}s total):")
    print(f"  Requests/sec: {num_requests / total_time:.1f}")
    print(f"  Success: {status_counts.get(200, 0)} | Errors: {len(errors)} | Rate limited: {status_counts.get(429, 0)}")

    if timings:
        print(f"\n  Latency:")
        print(f"    Min:    {min(timings):.1f}ms")
        print(f"    Avg:    {statistics.mean(timings):.1f}ms")
        print(f"    Median: {statistics.median(timings):.1f}ms")
        print(f"    P95:    {sorted(timings)[int(len(timings) * 0.95)]:.1f}ms")
        print(f"    P99:    {sorted(timings)[int(len(timings) * 0.99)]:.1f}ms")
        print(f"    Max:    {max(timings):.1f}ms")

    print(f"\n  Status codes: {status_counts}")

    if errors:
        print(f"\n  Sample errors:")
        for e in errors[:3]:
            print(f"    {e['endpoint']}: {e['error']}")


def main():
    parser = argparse.ArgumentParser(description="Load test the Album Conceptualizer API")
    parser.add_argument("base_url", nargs="?", default="http://localhost:8000")
    parser.add_argument("num_requests", nargs="?", type=int, default=100)
    parser.add_argument("concurrency", nargs="?", type=int, default=10)
    args = parser.parse_args()

    asyncio.run(run_load_test(args.base_url, args.num_requests, args.concurrency))


if __name__ == "__main__":
    main()
