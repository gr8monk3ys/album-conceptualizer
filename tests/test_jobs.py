"""Tests for the in-memory job store."""

import threading
import time

from album_conceptualizer.api.jobs import JobStatus, JobStore


class TestJobStore:
    def test_create_job(self) -> None:
        store = JobStore()
        job = store.create("ideation")
        assert job.status == JobStatus.PENDING
        assert job.crew_type == "ideation"
        assert job.id

    def test_get_job(self) -> None:
        store = JobStore()
        job = store.create("ideation")
        fetched = store.get(job.id)
        assert fetched is not None
        assert fetched.id == job.id

    def test_get_missing_returns_none(self) -> None:
        store = JobStore()
        assert store.get("nonexistent") is None

    def test_update_job_status(self) -> None:
        store = JobStore()
        job = store.create("ideation")
        store.update(job.id, status=JobStatus.RUNNING)
        assert store.get(job.id).status == JobStatus.RUNNING

    def test_update_job_result(self) -> None:
        store = JobStore()
        job = store.create("ideation")
        store.update(job.id, status=JobStatus.COMPLETED, result={"output": "done"})
        fetched = store.get(job.id)
        assert fetched.status == JobStatus.COMPLETED
        assert fetched.result == {"output": "done"}

    def test_update_job_error(self) -> None:
        store = JobStore()
        job = store.create("ideation")
        store.update(job.id, status=JobStatus.FAILED, error="boom")
        fetched = store.get(job.id)
        assert fetched.status == JobStatus.FAILED
        assert fetched.error == "boom"

    def test_list_all_jobs(self) -> None:
        store = JobStore()
        store.create("ideation")
        store.create("song_development")
        assert len(store.list()) == 2

    def test_list_filtered_by_status(self) -> None:
        store = JobStore()
        j1 = store.create("ideation")
        store.create("song_development")
        store.update(j1.id, status=JobStatus.RUNNING)
        running = store.list(status=JobStatus.RUNNING)
        assert len(running) == 1
        assert running[0].id == j1.id

    def test_delete_job(self) -> None:
        store = JobStore()
        job = store.create("ideation")
        assert store.delete(job.id) is True
        assert store.get(job.id) is None

    def test_delete_missing_returns_false(self) -> None:
        store = JobStore()
        assert store.delete("ghost") is False

    def test_evict_stale_jobs(self) -> None:
        store = JobStore(ttl_seconds=0)
        job = store.create("ideation")
        store.update(job.id, status=JobStatus.COMPLETED)
        # Eviction runs on next access
        time.sleep(0.01)
        assert store.get(job.id) is None

    def test_thread_safety(self) -> None:
        store = JobStore()
        jobs = []

        def create_jobs():
            for _ in range(50):
                jobs.append(store.create("ideation"))

        threads = [threading.Thread(target=create_jobs) for _ in range(4)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        assert len(store.list()) == 200
