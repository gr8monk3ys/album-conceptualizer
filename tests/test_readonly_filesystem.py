"""The engine must boot on a read-only filesystem.

ensure_directories() runs from get_settings(), which runs at import time, so
an OSError there takes the process down before a single route is served. On a
read-only deployment -- serverless, a hardened container, a distroless image --
that turned a fully working engine into an opaque 500 on every endpoint, with
"OSError: [Errno 30] Read-only file system: 'data'" visible only in the
platform's own logs.

Nothing needed to answer a theory, export or health request lives in those
directories.
"""

from __future__ import annotations

from pathlib import Path

from album_conceptualizer.config import Settings


READ_ONLY = Path("/proc/definitely-not-writable")


def _readonly_settings() -> Settings:
    s = Settings()
    s.data_dir = READ_ONLY / "data"
    s.cache_dir = READ_ONLY / "cache"
    s.output_dir = READ_ONLY / "output"
    return s


def test_ensure_directories_does_not_raise_on_a_read_only_filesystem():
    _readonly_settings().ensure_directories()  # must not raise


def test_the_failure_is_recorded_rather_than_swallowed():
    s = _readonly_settings()
    s.ensure_directories()
    assert len(s.unwritable_directories) == 3
    assert all("data" in d or "cache" in d or "output" in d for d in s.unwritable_directories)


def test_a_writable_filesystem_reports_nothing_unwritable(tmp_path):
    s = Settings()
    s.data_dir, s.cache_dir, s.output_dir = (tmp_path / "d", tmp_path / "c", tmp_path / "o")
    s.ensure_directories()
    assert s.unwritable_directories == []
    assert (tmp_path / "d").is_dir()


def test_directories_are_overridable_by_env(monkeypatch, tmp_path):
    """So a read-only deploy can point them somewhere writable."""
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_DATA_DIR", str(tmp_path / "envdata"))
    s = Settings()
    assert s.data_dir == tmp_path / "envdata"


def test_the_app_still_builds_when_the_filesystem_is_read_only(monkeypatch):
    """The end-to-end property that actually matters."""
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_DATA_DIR", str(READ_ONLY / "data"))
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_CACHE_DIR", str(READ_ONLY / "cache"))
    monkeypatch.setenv("ALBUM_CONCEPTUALIZER_OUTPUT_DIR", str(READ_ONLY / "output"))
    import album_conceptualizer.config as cfg

    cfg._settings = None  # force a fresh read of the environment
    try:
        from album_conceptualizer.api.app import create_app

        app = create_app()
        v1 = [r.path for r in app.routes if getattr(r, "path", "").startswith("/api/v1")]
        assert len(v1) > 50, f"app came up with only {len(v1)} routes"
    finally:
        cfg._settings = None
