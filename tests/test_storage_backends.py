"""Tests for File and SQLite storage backends."""

from pathlib import Path

import pytest

from album_conceptualizer.models.album import Album, Section, SectionType, Song
from album_conceptualizer.models.album_bible import AlbumBible, Theme
from album_conceptualizer.models.subscription import (
    AccountSubscription,
    BillingPlan,
    SubscriptionStatus,
)
from album_conceptualizer.storage import (
    FileAlbumStore,
    FileBibleStore,
    FileSubscriptionStore,
    SQLiteAlbumStore,
    SQLiteBibleStore,
    SQLiteSubscriptionStore,
)


def _make_album(title: str = "Test Album") -> Album:
    return Album(
        title=title,
        artist="Test Artist",
        songs=[Song(title="Track 1", track_number=1, key="C major", tempo=120)],
    )


def _make_bible() -> AlbumBible:
    return AlbumBible(
        album_title="Test Album",
        logline="A tale of two cities.",
        synopsis="Long synopsis.",
        themes=[Theme(name="Duality", description="Light and dark")],
    )


def _make_subscription(key_hash: str = "hash123") -> AccountSubscription:
    from datetime import UTC, datetime, timedelta

    return AccountSubscription(
        api_key_hash=key_hash,
        plan=BillingPlan.PRO,
        status=SubscriptionStatus.ACTIVE,
        current_period_end=datetime.now(UTC) + timedelta(days=30),
    )


# ---------------------------------------------------------------------------
# FileAlbumStore
# ---------------------------------------------------------------------------


class TestFileAlbumStore:
    def test_save_and_get(self, tmp_path: Path) -> None:
        store = FileAlbumStore(root=tmp_path / "albums")
        album = _make_album()
        store.save(album)
        fetched = store.get(str(album.id))
        assert fetched is not None
        assert fetched.title == album.title

    def test_list_returns_all(self, tmp_path: Path) -> None:
        store = FileAlbumStore(root=tmp_path / "albums")
        for i in range(3):
            store.save(_make_album(f"Album {i}"))
        assert len(store.list()) == 3

    def test_get_missing_returns_none(self, tmp_path: Path) -> None:
        store = FileAlbumStore(root=tmp_path / "albums")
        assert store.get("nonexistent") is None

    def test_delete_removes_entry(self, tmp_path: Path) -> None:
        store = FileAlbumStore(root=tmp_path / "albums")
        album = _make_album()
        store.save(album)
        store.delete(str(album.id))
        assert store.get(str(album.id)) is None

    def test_delete_nonexistent_is_noop(self, tmp_path: Path) -> None:
        store = FileAlbumStore(root=tmp_path / "albums")
        store.delete("does-not-exist")  # must not raise

    def test_list_skips_corrupt_files(self, tmp_path: Path) -> None:
        root = tmp_path / "albums"
        root.mkdir(parents=True)
        (root / "corrupt.json").write_text("NOT JSON {{{")
        store = FileAlbumStore(root=root)
        # Must not raise; corrupt file is silently skipped
        albums = store.list()
        assert isinstance(albums, list)
        assert len(albums) == 0

    def test_overwrite_existing(self, tmp_path: Path) -> None:
        store = FileAlbumStore(root=tmp_path / "albums")
        album = _make_album("Original")
        store.save(album)
        album.title = "Updated"
        store.save(album)
        assert store.get(str(album.id)).title == "Updated"


# ---------------------------------------------------------------------------
# FileBibleStore
# ---------------------------------------------------------------------------


class TestFileBibleStore:
    def test_save_and_get(self, tmp_path: Path) -> None:
        store = FileBibleStore(root=tmp_path / "bibles")
        bible = _make_bible()
        store.save("album-1", bible)
        fetched = store.get("album-1")
        assert fetched is not None
        assert fetched.logline == bible.logline

    def test_get_missing_returns_none(self, tmp_path: Path) -> None:
        store = FileBibleStore(root=tmp_path / "bibles")
        assert store.get("nonexistent") is None

    def test_delete_removes_entry(self, tmp_path: Path) -> None:
        store = FileBibleStore(root=tmp_path / "bibles")
        store.save("album-1", _make_bible())
        store.delete("album-1")
        assert store.get("album-1") is None

    def test_delete_nonexistent_is_noop(self, tmp_path: Path) -> None:
        store = FileBibleStore(root=tmp_path / "bibles")
        store.delete("no-such-album")  # must not raise


# ---------------------------------------------------------------------------
# FileSubscriptionStore
# ---------------------------------------------------------------------------


class TestFileSubscriptionStore:
    def test_save_and_get(self, tmp_path: Path) -> None:
        store = FileSubscriptionStore(root=tmp_path / "subs")
        sub = _make_subscription("key-hash-1")
        store.save(sub)
        fetched = store.get("key-hash-1")
        assert fetched is not None
        assert fetched.plan == BillingPlan.PRO

    def test_list_returns_all(self, tmp_path: Path) -> None:
        store = FileSubscriptionStore(root=tmp_path / "subs")
        for i in range(3):
            store.save(_make_subscription(f"hash-{i}"))
        assert len(store.list()) == 3

    def test_get_missing_returns_none(self, tmp_path: Path) -> None:
        store = FileSubscriptionStore(root=tmp_path / "subs")
        assert store.get("missing") is None

    def test_delete_removes_entry(self, tmp_path: Path) -> None:
        store = FileSubscriptionStore(root=tmp_path / "subs")
        sub = _make_subscription("to-delete")
        store.save(sub)
        store.delete("to-delete")
        assert store.get("to-delete") is None

    def test_delete_nonexistent_is_noop(self, tmp_path: Path) -> None:
        store = FileSubscriptionStore(root=tmp_path / "subs")
        store.delete("ghost")  # must not raise

    def test_list_skips_corrupt_files(self, tmp_path: Path) -> None:
        root = tmp_path / "subs"
        root.mkdir(parents=True)
        (root / "bad.json").write_text("{corrupted")
        store = FileSubscriptionStore(root=root)
        assert store.list() == []


# ---------------------------------------------------------------------------
# SQLiteAlbumStore
# ---------------------------------------------------------------------------


class TestSQLiteAlbumStore:
    def test_save_and_get(self, tmp_path: Path) -> None:
        store = SQLiteAlbumStore(path=tmp_path / "test.db")
        album = _make_album()
        store.save(album)
        fetched = store.get(str(album.id))
        assert fetched is not None
        assert fetched.title == album.title

    def test_list_returns_all(self, tmp_path: Path) -> None:
        store = SQLiteAlbumStore(path=tmp_path / "test.db")
        for i in range(3):
            store.save(_make_album(f"Album {i}"))
        assert len(store.list()) == 3

    def test_get_missing_returns_none(self, tmp_path: Path) -> None:
        store = SQLiteAlbumStore(path=tmp_path / "test.db")
        assert store.get("no-such-id") is None

    def test_delete_removes_entry(self, tmp_path: Path) -> None:
        store = SQLiteAlbumStore(path=tmp_path / "test.db")
        album = _make_album()
        store.save(album)
        store.delete(str(album.id))
        assert store.get(str(album.id)) is None

    def test_overwrite_existing(self, tmp_path: Path) -> None:
        store = SQLiteAlbumStore(path=tmp_path / "test.db")
        album = _make_album("Before")
        store.save(album)
        album.title = "After"
        store.save(album)
        assert store.get(str(album.id)).title == "After"

    def test_list_with_songs(self, tmp_path: Path) -> None:
        store = SQLiteAlbumStore(path=tmp_path / "test.db")
        album = Album(
            title="Rich Album",
            artist="Artist",
            songs=[
                Song(
                    title="Song A",
                    track_number=1,
                    sections=[
                        Section(section_type=SectionType.VERSE, order=1, lyrics="Hello world")
                    ],
                )
            ],
        )
        store.save(album)
        fetched = store.list()
        assert len(fetched) == 1
        assert fetched[0].songs[0].title == "Song A"


# ---------------------------------------------------------------------------
# SQLiteBibleStore
# ---------------------------------------------------------------------------


class TestSQLiteBibleStore:
    def test_save_and_get(self, tmp_path: Path) -> None:
        store = SQLiteBibleStore(path=tmp_path / "test.db")
        bible = _make_bible()
        store.save("album-1", bible)
        fetched = store.get("album-1")
        assert fetched is not None
        assert fetched.logline == bible.logline

    def test_get_missing_returns_none(self, tmp_path: Path) -> None:
        store = SQLiteBibleStore(path=tmp_path / "test.db")
        assert store.get("no-album") is None

    def test_delete_removes_entry(self, tmp_path: Path) -> None:
        store = SQLiteBibleStore(path=tmp_path / "test.db")
        store.save("album-1", _make_bible())
        store.delete("album-1")
        assert store.get("album-1") is None

    def test_overwrite_updates(self, tmp_path: Path) -> None:
        store = SQLiteBibleStore(path=tmp_path / "test.db")
        store.save("album-1", _make_bible())
        updated = AlbumBible(
            album_title="Test Album", logline="New logline.", synopsis="Updated synopsis."
        )
        store.save("album-1", updated)
        assert store.get("album-1").logline == "New logline."


# ---------------------------------------------------------------------------
# SQLiteSubscriptionStore
# ---------------------------------------------------------------------------


class TestSQLiteSubscriptionStore:
    def test_save_and_get(self, tmp_path: Path) -> None:
        store = SQLiteSubscriptionStore(path=tmp_path / "test.db")
        sub = _make_subscription("hash-abc")
        store.save(sub)
        fetched = store.get("hash-abc")
        assert fetched is not None
        assert fetched.plan == BillingPlan.PRO

    def test_list_returns_all(self, tmp_path: Path) -> None:
        store = SQLiteSubscriptionStore(path=tmp_path / "test.db")
        for i in range(3):
            store.save(_make_subscription(f"hash-{i}"))
        assert len(store.list()) == 3

    def test_get_missing_returns_none(self, tmp_path: Path) -> None:
        store = SQLiteSubscriptionStore(path=tmp_path / "test.db")
        assert store.get("nope") is None

    def test_delete_removes_entry(self, tmp_path: Path) -> None:
        store = SQLiteSubscriptionStore(path=tmp_path / "test.db")
        sub = _make_subscription("del-hash")
        store.save(sub)
        store.delete("del-hash")
        assert store.get("del-hash") is None


# ---------------------------------------------------------------------------
# Path traversal protection
# ---------------------------------------------------------------------------


class TestPathTraversalProtection:
    """Verify that file-backed stores reject IDs containing path traversal."""

    @pytest.mark.parametrize("bad_id", ["../../etc/passwd", "../secret", "foo/../../bar"])
    def test_file_album_store_rejects_traversal(self, tmp_path: Path, bad_id: str) -> None:
        store = FileAlbumStore(root=tmp_path / "albums")
        with pytest.raises(ValueError, match="Path traversal"):
            store.get(bad_id)

    @pytest.mark.parametrize("bad_id", ["../../etc/passwd", "../secret"])
    def test_file_bible_store_rejects_traversal(self, tmp_path: Path, bad_id: str) -> None:
        store = FileBibleStore(root=tmp_path / "bibles")
        with pytest.raises(ValueError, match="Path traversal"):
            store.get(bad_id)

    @pytest.mark.parametrize("bad_id", ["../../etc/passwd", "../secret"])
    def test_file_subscription_store_rejects_traversal(self, tmp_path: Path, bad_id: str) -> None:
        store = FileSubscriptionStore(root=tmp_path / "subs")
        with pytest.raises(ValueError, match="Path traversal"):
            store.get(bad_id)
