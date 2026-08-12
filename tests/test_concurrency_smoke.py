"""Stress test: concurrent writes to the SQLite storage backend."""

from __future__ import annotations

import concurrent.futures
import uuid

import pytest
from fastapi.testclient import TestClient

from album_conceptualizer.api.app import create_app
from album_conceptualizer.config import reset_settings


@pytest.fixture
def sqlite_stress_client(monkeypatch, tmp_path):
    """Client wired to a real SQLite database for concurrent-write testing."""
    db_path = str(tmp_path / "stress.db")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_STORAGE_BACKEND", "sqlite")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_STORAGE_DB", db_path)
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEY", raising=False)
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEYS", raising=False)
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_STRICT_PRODUCTION", raising=False)
    reset_settings()
    app = create_app()
    with TestClient(app) as tc:
        yield tc
    reset_settings()


class TestConcurrentAlbumCreation:
    def test_50_concurrent_creates_no_corruption(self, sqlite_stress_client):
        """Fire 50 album creations concurrently. All should succeed, no data loss."""
        client = sqlite_stress_client
        count = 50

        def create_album(index: int) -> dict:
            resp = client.post(
                "/api/v1/albums",
                json={
                    "title": f"Stress Album {index}",
                    "artist": f"Artist {index}",
                    "id": str(uuid.uuid4()),
                },
            )
            assert resp.status_code == 201, f"Album {index} failed: {resp.text}"
            return resp.json()

        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
            futures = [pool.submit(create_album, i) for i in range(count)]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]

        assert len(results) == count

        # Verify all albums are persisted and retrievable.
        list_resp = client.get(f"/api/v1/albums?page_size={count + 10}")
        assert list_resp.status_code == 200
        data = list_resp.json()
        total = data.get("total", len(data.get("items", data)))
        assert total >= count, f"Expected at least {count} albums, got {total}"

    def test_concurrent_create_and_read(self, sqlite_stress_client):
        """Interleave creates and reads. No lock errors should occur."""
        client = sqlite_stress_client

        def create_and_read(index: int) -> str:
            resp = client.post(
                "/api/v1/albums",
                json={"title": f"Album {index}", "artist": "Test"},
            )
            assert resp.status_code == 201
            album_id = resp.json()["id"]
            # Immediately read it back.
            get_resp = client.get(f"/api/v1/albums/{album_id}")
            assert get_resp.status_code == 200
            assert get_resp.json()["title"] == f"Album {index}"
            return album_id

        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            futures = [pool.submit(create_and_read, i) for i in range(30)]
            ids = [f.result() for f in concurrent.futures.as_completed(futures)]

        assert len(ids) == 30
