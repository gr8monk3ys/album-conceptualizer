"""In-memory job store for async agent workflows."""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from enum import StrEnum
from uuid import uuid4


class JobStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class Job:
    id: str
    crew_type: str
    status: JobStatus = JobStatus.PENDING
    created_at: float = field(default_factory=time.time)
    completed_at: float | None = None
    result: dict | None = None
    error: str | None = None
    owner_id: str | None = None


class JobStore:
    """Thread-safe in-memory job store with TTL eviction."""

    def __init__(self, ttl_seconds: int = 3600) -> None:
        self._jobs: dict[str, Job] = {}
        self._ttl = ttl_seconds
        self._lock = threading.Lock()

    def create(self, crew_type: str, owner_id: str | None = None) -> Job:
        job = Job(id=uuid4().hex, crew_type=crew_type, owner_id=owner_id)
        with self._lock:
            self._jobs[job.id] = job
        return job

    def count_active(self, owner_id: str | None = None) -> int:
        """Count jobs with PENDING or RUNNING status, optionally filtered by owner."""
        with self._lock:
            self._evict_stale()
            return sum(
                1
                for job in self._jobs.values()
                if job.status in (JobStatus.PENDING, JobStatus.RUNNING)
                and (owner_id is None or job.owner_id == owner_id)
            )

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            self._evict_stale()
            return self._jobs.get(job_id)

    def list(self, status: JobStatus | None = None) -> list[Job]:
        with self._lock:
            self._evict_stale()
            jobs = list(self._jobs.values())
        if status is not None:
            jobs = [j for j in jobs if j.status == status]
        return jobs

    def update(self, job_id: str, **kwargs: object) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            for key, value in kwargs.items():
                setattr(job, key, value)
            if job.status in (JobStatus.COMPLETED, JobStatus.FAILED) and job.completed_at is None:
                job.completed_at = time.time()

    def delete(self, job_id: str) -> bool:
        with self._lock:
            return self._jobs.pop(job_id, None) is not None

    def _evict_stale(self) -> None:
        """Remove completed/failed jobs older than TTL. Caller holds lock."""
        now = time.time()
        stale = [
            jid
            for jid, job in self._jobs.items()
            if job.completed_at is not None and (now - job.completed_at) > self._ttl
        ]
        for jid in stale:
            del self._jobs[jid]
