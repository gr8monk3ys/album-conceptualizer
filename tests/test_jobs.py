"""Tests for the in-memory job store."""

import threading
import time

import pytest

from album_conceptualizer.api.jobs import JobLimitError, JobStatus, JobStore


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


class TestSubmit:
    """The runner: every submitted job ends COMPLETED or FAILED, and owners see only theirs."""

    def _wait(self, store, job_id, owner=None):
        import time as _time

        for _ in range(100):
            job = store.get_for(job_id, owner)
            if job and job.status in (JobStatus.COMPLETED, JobStatus.FAILED):
                return job
            _time.sleep(0.02)
        raise AssertionError("job did not finish")

    def test_completes_with_result_and_returns_pending_snapshot(self):
        store = JobStore()
        outcomes = []
        job = store.submit(
            "k",
            lambda: {"ok": 1},
            owner_id="a",
            timeout_seconds=5,
            timeout_message="late",
            on_finish=outcomes.append,
        )
        assert job.status == JobStatus.PENDING
        done = self._wait(store, job.id, "a")
        assert done.status == JobStatus.COMPLETED
        assert done.result == {"ok": 1}
        assert outcomes == ["completed"]

    def test_timeout_fails_with_message(self):
        import time as _time

        store = JobStore()
        job = store.submit(
            "k",
            lambda: _time.sleep(1) or {},
            owner_id=None,
            timeout_seconds=0.1,
            timeout_message="Timed out.",
        )
        done = self._wait(store, job.id)
        assert done.status == JobStatus.FAILED
        assert done.error == "Timed out."

    def test_error_fails_with_its_message(self):
        store = JobStore()

        def boom():
            raise ValueError("provider said no")

        job = store.submit(
            "k",
            boom,
            owner_id=None,
            timeout_seconds=5,
            timeout_message="late",
            expected_errors=(ValueError,),
        )
        done = self._wait(store, job.id)
        assert done.status == JobStatus.FAILED
        assert done.error == "provider said no"

    def test_owned_jobs_are_visible_only_to_their_owner(self):
        store = JobStore()
        owned = store.create("k", owner_id="alice")
        shared = store.create("k", owner_id=None)
        assert store.get_for(owned.id, "alice") is not None
        assert store.get_for(owned.id, "bob") is None
        assert store.get_for(owned.id, None) is None
        assert store.get_for(shared.id, "bob") is not None
        assert {j.id for j in store.list_for("bob")} == {shared.id}


class TestAdmission:
    """submit() admits against the caps atomically and holds a slot until the work ends."""

    def _submit(self, store, gate, owner=None, timeout=5.0, **limits):
        return store.submit(
            "k",
            lambda: gate.wait(5) and {},
            owner_id=owner,
            timeout_seconds=timeout,
            timeout_message="late",
            **limits,
        )

    def test_concurrent_submits_never_exceed_the_global_cap(self):
        store = JobStore()
        gate = threading.Event()
        barrier = threading.Barrier(20)
        admitted, rejected = [], []

        def attempt(i):
            barrier.wait()
            try:
                admitted.append(self._submit(store, gate, owner=f"o{i}", max_active=3))
            except JobLimitError as exc:
                rejected.append(exc)

        threads = [threading.Thread(target=attempt, args=(i,)) for i in range(20)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        try:
            assert len(admitted) == 3
            assert len(rejected) == 17
            assert all(exc.scope == "global" and exc.limit == 3 for exc in rejected)
        finally:
            gate.set()

    def test_concurrent_submits_by_one_owner_never_exceed_the_owner_cap(self):
        store = JobStore()
        gate = threading.Event()
        barrier = threading.Barrier(10)
        admitted, rejected = [], []

        def attempt():
            barrier.wait()
            try:
                admitted.append(
                    self._submit(store, gate, owner="alice", max_active=5, max_active_per_owner=2)
                )
            except JobLimitError as exc:
                rejected.append(exc)

        threads = [threading.Thread(target=attempt) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        try:
            assert len(admitted) == 2
            assert {exc.scope for exc in rejected} == {"owner"}
            # Another owner still gets a slot.
            assert self._submit(store, gate, owner="bob", max_active=5, max_active_per_owner=2)
        finally:
            gate.set()

    def test_ownerless_jobs_are_bound_only_by_the_global_cap(self):
        store = JobStore()
        gate = threading.Event()
        try:
            for _ in range(3):
                self._submit(store, gate, max_active=3, max_active_per_owner=1)
            with pytest.raises(JobLimitError):
                self._submit(store, gate, max_active=3, max_active_per_owner=1)
        finally:
            gate.set()

    def test_timed_out_job_holds_its_slot_until_its_work_ends(self):
        store = JobStore()
        gate = threading.Event()
        job = self._submit(store, gate, owner="alice", timeout=0.05, max_active=1)
        for _ in range(100):
            if store.get(job.id).status == JobStatus.FAILED:
                break
            time.sleep(0.01)
        assert store.get(job.id).status == JobStatus.FAILED
        # The crew is still running: its slot is still taken.
        assert store.count_active() == 1
        assert store.count_active(owner_id="alice") == 1
        with pytest.raises(JobLimitError):
            self._submit(store, gate, max_active=1)
        # Deleting the record does not free the slot either.
        store.delete(job.id)
        assert store.count_active() == 1

        gate.set()
        for _ in range(100):
            if store.count_active() == 0:
                break
            time.sleep(0.01)
        assert store.count_active() == 0
        self._submit(store, gate, max_active=1)

    def test_failed_thread_start_releases_the_slot(self, monkeypatch):
        store = JobStore()

        def refuse(self):
            raise RuntimeError("can't start new thread")

        monkeypatch.setattr(threading.Thread, "start", refuse)
        with pytest.raises(RuntimeError):
            store.submit(
                "k", dict, owner_id=None, timeout_seconds=1, timeout_message="x", max_active=1
            )
        assert store.count_active() == 0
        assert store.list()[0].status == JobStatus.FAILED
