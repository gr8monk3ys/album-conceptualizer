"""Shared pytest fixtures available to all test modules."""

import inspect

import pytest
from fastapi.testclient import TestClient

from album_conceptualizer.api.app import create_app
from album_conceptualizer.config import reset_settings


@pytest.fixture(autouse=True)
def _default_memory_storage(monkeypatch):
    """Force in-memory storage for all tests unless explicitly overridden.

    Prevents tests from accidentally writing to the shared SQLite database on disk
    now that the production default is 'sqlite'.
    """
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_STORAGE_BACKEND", "memory")
    # Tests use /identity/register which creates unverified accounts;
    # disable the verified-email gate so workspace tokens work in tests.
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_IDENTITY_REQUIRE_VERIFIED_EMAIL", "false")


@pytest.fixture
def client(monkeypatch):
    """Test client with no authentication and in-memory storage."""
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_STORAGE_BACKEND", "memory")
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEY", raising=False)
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEYS", raising=False)
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_STRICT_PRODUCTION", raising=False)
    reset_settings()
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client
    reset_settings()


@pytest.fixture
def sqlite_client(monkeypatch, tmp_path):
    """Test client backed by a real SQLite database in a temporary directory."""
    db_path = tmp_path / "test.db"
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_STORAGE_BACKEND", "sqlite")
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_STORAGE_DB", str(db_path))
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEY", raising=False)
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEYS", raising=False)
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_STRICT_PRODUCTION", raising=False)
    reset_settings()
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client
    reset_settings()


@pytest.fixture
def auth_client(monkeypatch):
    """Test client with API key 'test-secret' required."""
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_API_KEY", "test-secret")
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_API_KEYS", raising=False)
    monkeypatch.delenv("ALBUM_CONCEPTUALIZER_STRICT_PRODUCTION", raising=False)
    reset_settings()
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client
    reset_settings()


def _is_unit_focus_file(path: str) -> bool:
    return path.endswith(
        (
            "/tests/test_models.py",
            "/tests/test_models_extended.py",
            "/tests/test_ui_helpers.py",
            "/tests/test_ui_helpers_extended.py",
        )
    )


def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:
    for item in items:
        item_path = str(getattr(item, "path", item.fspath))
        normalized = item_path.replace("\\", "/")
        if not _is_unit_focus_file(normalized):
            item.add_marker(pytest.mark.integration)
        if "/tests/integration/" not in normalized:
            item.add_marker(pytest.mark.unit)

        fixture_names = set(getattr(item, "fixturenames", ()))

        test_obj = getattr(item, "obj", None)
        params: dict[str, inspect.Parameter] = {}
        if test_obj is not None:
            try:
                params = dict(inspect.signature(test_obj).parameters)
            except (TypeError, ValueError):
                params = {}
        if (
            "_default_memory_storage" in fixture_names
            or "monkeypatch" in params
            or "mocker" in params
        ):
            item.add_marker(pytest.mark.mock)
