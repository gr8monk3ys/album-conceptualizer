"""In-memory job store and runner for the engine's async work (agent workflows, renders).

Work that outlives an HTTP request is submitted here: the caller gets a job id back at once
and polls. The runner supervises each job on a background thread with a hard timeout, so a
job always ends COMPLETED or FAILED, never stuck RUNNING. Jobs started on behalf of an owner
are visible only to that owner.
"""

from __future__ import annotations

import builtins
import logging
import threading
import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeoutError
from dataclasses import dataclass, field, replace
from enum import StrEnum
from typing import Literal
from uuid import uuid4


logger = logging.getLogger(__name__)

Outcome = Literal["completed", "timeout", "error"]


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

    _UPDATABLE_FIELDS = frozenset({"status", "result", "error", "completed_at"})

    _TERMINAL_STATUSES = frozenset({JobStatus.COMPLETED, JobStatus.FAILED})

    def update(self, job_id: str, **kwargs: object) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            for key, value in kwargs.items():
                if key not in self._UPDATABLE_FIELDS:
                    continue
                setattr(job, key, value)

            # Stamp completion time whenever a job reaches a terminal state
            # without one. _evict_stale() only considers jobs with a
            # completed_at, so a terminal job that never gets one is immortal
            # — it occupies the store forever and still counts against nothing.
            # Every production call site already passes completed_at
            # explicitly, which is why this has not leaked in practice; that
            # makes the invariant a matter of caller discipline rather than
            # something the store guarantees. Enforcing it here costs nothing
            # (an explicit value is set above and left alone) and removes the
            # whole class of mistake.
            if job.status in self._TERMINAL_STATUSES and job.completed_at is None:
                job.completed_at = time.time()

    @staticmethod
    def _visible(job: Job, owner_id: str | None) -> bool:
        # An owned job is visible only to its owner; a job started without an owner is
        # visible to anyone. 404 rather than 403 elsewhere keeps job ids unenumerable.
        return job.owner_id is None or job.owner_id == owner_id

    def get_for(self, job_id: str, owner_id: str | None) -> Job | None:
        """The job, if it exists and ``owner_id`` may see it."""
        job = self.get(job_id)
        return job if job is not None and self._visible(job, owner_id) else None

    def list_for(self, owner_id: str | None, status: JobStatus | None = None) -> builtins.list[Job]:
        return [job for job in self.list(status=status) if self._visible(job, owner_id)]

    def submit(
        self,
        kind: str,
        work: Callable[[], dict],
        *,
        owner_id: str | None,
        timeout_seconds: float,
        timeout_message: str,
        expected_errors: tuple[type[BaseException], ...] = (),
        on_finish: Callable[[Outcome], None] | None = None,
    ) -> Job:
        """Create a job and run ``work`` for it on a supervised background thread.

        Returns a snapshot of the job as submitted (PENDING); poll ``get_for`` for progress.

        ``work`` returns the job's result. It fails the job if it raises or runs past
        ``timeout_seconds``. Exceptions in ``expected_errors`` are already written for
        people and are logged as warnings; anything else is logged with its traceback.
        """
        job = self.create(kind, owner_id=owner_id)
        # The caller gets the job as submitted; the live record changes under the worker.
        submitted = replace(job)
        thread = threading.Thread(
            target=self._supervise,
            args=(job.id, kind, work, timeout_seconds, timeout_message, expected_errors, on_finish),
            daemon=True,
        )
        thread.start()
        return submitted

    def _supervise(
        self,
        job_id: str,
        kind: str,
        work: Callable[[], dict],
        timeout_seconds: float,
        timeout_message: str,
        expected_errors: tuple[type[BaseException], ...],
        on_finish: Callable[[Outcome], None] | None,
    ) -> None:
        self.update(job_id, status=JobStatus.RUNNING)
        outcome: Outcome
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(work)
            try:
                result = future.result(timeout=timeout_seconds)
                self.update(
                    job_id, status=JobStatus.COMPLETED, result=result, completed_at=time.time()
                )
                outcome = "completed"
            except FutureTimeoutError:
                future.cancel()
                self.update(
                    job_id, status=JobStatus.FAILED, error=timeout_message, completed_at=time.time()
                )
                logger.warning("job_timeout", extra={"job_id": job_id, "kind": kind})
                outcome = "timeout"
            except Exception as exc:  # a job must never die silently
                self.update(
                    job_id, status=JobStatus.FAILED, error=str(exc), completed_at=time.time()
                )
                if isinstance(exc, expected_errors):
                    logger.warning(
                        "job_failed", extra={"job_id": job_id, "kind": kind, "error": str(exc)}
                    )
                else:
                    logger.exception(
                        "job_error", exc_info=exc, extra={"job_id": job_id, "kind": kind}
                    )
                outcome = "error"
        if on_finish is not None:
            on_finish(outcome)

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
