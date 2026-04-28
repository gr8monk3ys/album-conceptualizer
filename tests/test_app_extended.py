"""Additional FastAPI app coverage for startup/lifespan and middleware branches."""

from __future__ import annotations

import sys
from types import ModuleType

from fastapi.testclient import TestClient

from album_conceptualizer.api.app import create_app
from album_conceptualizer.config import reset_settings
from album_conceptualizer.storage import (
    FileAlbumStore,
    FileBibleStore,
    FileSubscriptionStore,
)


def _set_base_env(monkeypatch) -> None:
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEY", raising=False)
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEYS", raising=False)
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_STRICT_PRODUCTION", raising=False)
    monkeypatch.delenv("CHROMA_PERSIST_DIRECTORY", raising=False)


def test_create_app_initializes_file_backed_stores(monkeypatch, tmp_path):
    _set_base_env(monkeypatch)
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_STORAGE_BACKEND", "file")
    monkeypatch.setenv("OUTPUT_DIR", str(tmp_path / "output"))
    reset_settings()

    app = create_app()

    assert isinstance(app.state.album_store, FileAlbumStore)
    assert isinstance(app.state.bible_store, FileBibleStore)
    assert isinstance(app.state.subscription_store, FileSubscriptionStore)
    reset_settings()


def test_lifespan_initializes_vector_store_when_chroma_enabled(monkeypatch, tmp_path):
    _set_base_env(monkeypatch)
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_STORAGE_BACKEND", "memory")
    monkeypatch.setenv("CHROMA_PERSIST_DIRECTORY", str(tmp_path / "chroma"))
    reset_settings()

    fake_embeddings = ModuleType("album_conceptualizer.rag.embeddings")
    fake_vector_store = ModuleType("album_conceptualizer.rag.vector_store")

    def get_embedding_model(*, model_type: str, model_name: str):
        return {"model_type": model_type, "model_name": model_name}

    class FakeChromaVectorStore:
        def __init__(self, *, collection_name, embedding_model, persist_directory):
            self.collection_name = collection_name
            self.embedding_model = embedding_model
            self.persist_directory = persist_directory

    fake_embeddings.get_embedding_model = get_embedding_model
    fake_vector_store.ChromaVectorStore = FakeChromaVectorStore
    monkeypatch.setitem(sys.modules, "album_conceptualizer.rag.embeddings", fake_embeddings)
    monkeypatch.setitem(sys.modules, "album_conceptualizer.rag.vector_store", fake_vector_store)

    app = create_app()
    with TestClient(app):
        pass

    assert isinstance(app.state.vector_store, FakeChromaVectorStore)
    reset_settings()


def test_lifespan_sets_vector_store_none_when_rag_init_raises(monkeypatch, tmp_path):
    _set_base_env(monkeypatch)
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_STORAGE_BACKEND", "memory")
    monkeypatch.setenv("CHROMA_PERSIST_DIRECTORY", str(tmp_path / "chroma"))
    reset_settings()

    fake_embeddings = ModuleType("album_conceptualizer.rag.embeddings")
    fake_vector_store = ModuleType("album_conceptualizer.rag.vector_store")

    def get_embedding_model(*, model_type: str, model_name: str):
        raise RuntimeError("embedding load failure")

    class FakeChromaVectorStore:
        def __init__(self, *, collection_name, embedding_model, persist_directory):
            self.collection_name = collection_name
            self.embedding_model = embedding_model
            self.persist_directory = persist_directory

    fake_embeddings.get_embedding_model = get_embedding_model
    fake_vector_store.ChromaVectorStore = FakeChromaVectorStore
    monkeypatch.setitem(sys.modules, "album_conceptualizer.rag.embeddings", fake_embeddings)
    monkeypatch.setitem(sys.modules, "album_conceptualizer.rag.vector_store", fake_vector_store)

    app = create_app()
    with TestClient(app):
        pass

    assert app.state.vector_store is None
    reset_settings()


def test_create_app_uses_redis_quota_and_rate_limit_middleware(monkeypatch):
    _set_base_env(monkeypatch)
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_STORAGE_BACKEND", "memory")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_QUOTA_ENABLED", "true")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_QUOTA_BACKEND", "redis")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_RATE_LIMIT_ENABLED", "true")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_RATE_LIMIT_BACKEND", "redis")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_REDIS_URL", "redis://localhost:6379/0")
    reset_settings()

    app = create_app()
    middleware_class_names = {entry.cls.__name__ for entry in app.user_middleware}

    assert "RedisQuota" in middleware_class_names
    assert "RedisRateLimiter" in middleware_class_names
    reset_settings()


def test_disabled_redis_backends_do_not_require_redis_url(monkeypatch):
    _set_base_env(monkeypatch)
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_STORAGE_BACKEND", "memory")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_QUOTA_ENABLED", "false")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_QUOTA_BACKEND", "redis")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_RATE_LIMIT_ENABLED", "false")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_RATE_LIMIT_BACKEND", "redis")
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_REDIS_URL", raising=False)
    reset_settings()

    app = create_app()
    with TestClient(app) as client:
        assert client.get("/api/v1/health").status_code == 200
    reset_settings()


def test_global_exception_handler_records_error_metric(monkeypatch):
    _set_base_env(monkeypatch)
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_STORAGE_BACKEND", "memory")
    reset_settings()

    app = create_app()

    @app.get("/boom")
    async def boom() -> None:
        raise RuntimeError("boom")

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/boom")

    assert response.status_code == 500
    assert response.json()["detail"] == "Internal server error"
    assert "type" not in response.json()  # exception type must not leak
    assert app.state.metrics.error_count >= 1
    reset_settings()
