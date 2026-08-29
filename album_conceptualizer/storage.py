"""Storage backends for API persistence."""

from __future__ import annotations

import sqlite3
import threading
from dataclasses import dataclass, field
from pathlib import Path

from album_conceptualizer.logging import get_logger
from album_conceptualizer.models.album import Album
from album_conceptualizer.models.album_bible import AlbumBible
from album_conceptualizer.models.subscription import AccountSubscription


logger = get_logger("album_conceptualizer.storage")


def _open_sqlite(path: Path) -> sqlite3.Connection:
    """Open a SQLite connection with WAL mode and relaxed sync for performance."""
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    return conn


def _safe_child(root: Path, filename: str) -> Path:
    """Resolve *filename* under *root* and verify it stays within the directory.

    Raises ``ValueError`` if the resolved path escapes *root* (path traversal).
    """
    target = (root / filename).resolve()
    if not target.is_relative_to(root.resolve()):
        raise ValueError(f"Path traversal detected in ID: {filename!r}")
    return target


class AlbumStore:
    """Abstract album storage interface."""

    def list(self) -> list[Album]:
        raise NotImplementedError

    def get(self, album_id: str) -> Album | None:
        raise NotImplementedError

    def save(self, album: Album) -> None:
        raise NotImplementedError

    def delete(self, album_id: str) -> None:
        raise NotImplementedError


class BibleStore:
    """Abstract album bible storage interface."""

    def get(self, album_id: str) -> AlbumBible | None:
        raise NotImplementedError

    def save(self, album_id: str, bible: AlbumBible) -> None:
        raise NotImplementedError

    def delete(self, album_id: str) -> None:
        raise NotImplementedError


class SubscriptionStore:
    """Abstract subscription storage interface."""

    def list(self) -> list[AccountSubscription]:
        raise NotImplementedError

    def get(self, api_key_hash: str) -> AccountSubscription | None:
        raise NotImplementedError

    def save(self, subscription: AccountSubscription) -> None:
        raise NotImplementedError

    def delete(self, api_key_hash: str) -> None:
        raise NotImplementedError


class InMemoryAlbumStore(AlbumStore):
    """In-memory album store (default)."""

    def __init__(self) -> None:
        self._albums: dict[str, Album] = {}

    def list(self) -> list[Album]:
        return list(self._albums.values())

    def get(self, album_id: str) -> Album | None:
        return self._albums.get(album_id)

    def save(self, album: Album) -> None:
        self._albums[str(album.id)] = album

    def delete(self, album_id: str) -> None:
        if album_id in self._albums:
            del self._albums[album_id]


class InMemoryBibleStore(BibleStore):
    """In-memory album bible store (default)."""

    def __init__(self) -> None:
        self._bibles: dict[str, AlbumBible] = {}

    def get(self, album_id: str) -> AlbumBible | None:
        return self._bibles.get(album_id)

    def save(self, album_id: str, bible: AlbumBible) -> None:
        self._bibles[album_id] = bible

    def delete(self, album_id: str) -> None:
        if album_id in self._bibles:
            del self._bibles[album_id]


class InMemorySubscriptionStore(SubscriptionStore):
    """In-memory subscription store."""

    def __init__(self) -> None:
        self._subscriptions: dict[str, AccountSubscription] = {}

    def list(self) -> list[AccountSubscription]:
        return list(self._subscriptions.values())

    def get(self, api_key_hash: str) -> AccountSubscription | None:
        return self._subscriptions.get(api_key_hash)

    def save(self, subscription: AccountSubscription) -> None:
        self._subscriptions[subscription.api_key_hash] = subscription

    def delete(self, api_key_hash: str) -> None:
        if api_key_hash in self._subscriptions:
            del self._subscriptions[api_key_hash]


@dataclass
class FileAlbumStore(AlbumStore):
    """File-backed album store (JSON per album)."""

    root: Path

    def __post_init__(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)

    def _path_for(self, album_id: str) -> Path:
        return _safe_child(self.root, f"{album_id}.json")

    def list(self) -> list[Album]:
        albums: list[Album] = []
        for path in self.root.glob("*.json"):
            try:
                albums.append(Album.model_validate_json(path.read_text()))
            except Exception:
                logger.warning("album_deserialize_failed", extra={"path": str(path)}, exc_info=True)
                continue
        return albums

    def get(self, album_id: str) -> Album | None:
        path = self._path_for(album_id)
        if not path.exists():
            return None
        try:
            return Album.model_validate_json(path.read_text())
        except Exception:
            logger.warning("album_deserialize_failed", extra={"path": str(path)}, exc_info=True)
            return None

    def save(self, album: Album) -> None:
        path = self._path_for(str(album.id))
        path.write_text(album.model_dump_json(indent=2))

    def delete(self, album_id: str) -> None:
        path = self._path_for(album_id)
        if path.exists():
            path.unlink()


@dataclass
class FileBibleStore(BibleStore):
    """File-backed album bible store (JSON per album)."""

    root: Path

    def __post_init__(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)

    def _path_for(self, album_id: str) -> Path:
        return _safe_child(self.root, f"{album_id}.json")

    def get(self, album_id: str) -> AlbumBible | None:
        path = self._path_for(album_id)
        if not path.exists():
            return None
        return AlbumBible.model_validate_json(path.read_text())

    def save(self, album_id: str, bible: AlbumBible) -> None:
        path = self._path_for(album_id)
        path.write_text(bible.model_dump_json(indent=2))

    def delete(self, album_id: str) -> None:
        path = self._path_for(album_id)
        if path.exists():
            path.unlink()


@dataclass
class FileSubscriptionStore(SubscriptionStore):
    """File-backed subscription store (JSON per API key hash)."""

    root: Path

    def __post_init__(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)

    def _path_for(self, api_key_hash: str) -> Path:
        return _safe_child(self.root, f"{api_key_hash}.json")

    def list(self) -> list[AccountSubscription]:
        items: list[AccountSubscription] = []
        for path in self.root.glob("*.json"):
            try:
                items.append(AccountSubscription.model_validate_json(path.read_text()))
            except Exception:
                logger.warning(
                    "subscription_deserialize_failed", extra={"path": str(path)}, exc_info=True
                )
                continue
        return items

    def get(self, api_key_hash: str) -> AccountSubscription | None:
        path = self._path_for(api_key_hash)
        if not path.exists():
            return None
        return AccountSubscription.model_validate_json(path.read_text())

    def save(self, subscription: AccountSubscription) -> None:
        path = self._path_for(subscription.api_key_hash)
        path.write_text(subscription.model_dump_json(indent=2))

    def delete(self, api_key_hash: str) -> None:
        path = self._path_for(api_key_hash)
        if path.exists():
            path.unlink()


@dataclass
class SQLiteAlbumStore(AlbumStore):
    """SQLite-backed album store (JSON payloads)."""

    path: Path
    _conn: sqlite3.Connection = field(init=False, repr=False)
    _lock: threading.Lock = field(init=False, repr=False, default_factory=threading.Lock)

    def __post_init__(self) -> None:
        self._conn = _open_sqlite(self.path)
        self._conn.execute(
            "CREATE TABLE IF NOT EXISTS albums (id TEXT PRIMARY KEY, payload TEXT NOT NULL)"
        )
        self._conn.commit()

    def list(self) -> list[Album]:
        with self._lock:
            rows = self._conn.execute("SELECT payload FROM albums").fetchall()
        albums: list[Album] = []
        for (payload,) in rows:
            try:
                albums.append(Album.model_validate_json(payload))
            except Exception:
                logger.warning("album_deserialize_failed", extra={"store": "sqlite"}, exc_info=True)
                continue
        return albums

    def get(self, album_id: str) -> Album | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT payload FROM albums WHERE id = ?", (album_id,)
            ).fetchone()
        if not row:
            return None
        return Album.model_validate_json(row[0])

    def save(self, album: Album) -> None:
        payload = album.model_dump_json(indent=2)
        with self._lock:
            self._conn.execute(
                "INSERT OR REPLACE INTO albums (id, payload) VALUES (?, ?)",
                (str(album.id), payload),
            )
            self._conn.commit()

    def delete(self, album_id: str) -> None:
        with self._lock:
            self._conn.execute("DELETE FROM albums WHERE id = ?", (album_id,))
            self._conn.commit()


@dataclass
class SQLiteBibleStore(BibleStore):
    """SQLite-backed album bible store (JSON payloads)."""

    path: Path
    _conn: sqlite3.Connection = field(init=False, repr=False)
    _lock: threading.Lock = field(init=False, repr=False, default_factory=threading.Lock)

    def __post_init__(self) -> None:
        self._conn = _open_sqlite(self.path)
        self._conn.execute(
            "CREATE TABLE IF NOT EXISTS bibles (album_id TEXT PRIMARY KEY, payload TEXT NOT NULL)"
        )
        self._conn.commit()

    def get(self, album_id: str) -> AlbumBible | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT payload FROM bibles WHERE album_id = ?", (album_id,)
            ).fetchone()
        if not row:
            return None
        return AlbumBible.model_validate_json(row[0])

    def save(self, album_id: str, bible: AlbumBible) -> None:
        payload = bible.model_dump_json(indent=2)
        with self._lock:
            self._conn.execute(
                "INSERT OR REPLACE INTO bibles (album_id, payload) VALUES (?, ?)",
                (album_id, payload),
            )
            self._conn.commit()

    def delete(self, album_id: str) -> None:
        with self._lock:
            self._conn.execute("DELETE FROM bibles WHERE album_id = ?", (album_id,))
            self._conn.commit()


@dataclass
class SQLiteSubscriptionStore(SubscriptionStore):
    """SQLite-backed subscription store (JSON payloads)."""

    path: Path
    _conn: sqlite3.Connection = field(init=False, repr=False)
    _lock: threading.Lock = field(init=False, repr=False, default_factory=threading.Lock)

    def __post_init__(self) -> None:
        self._conn = _open_sqlite(self.path)
        self._conn.execute(
            "CREATE TABLE IF NOT EXISTS subscriptions ("
            "api_key_hash TEXT PRIMARY KEY, payload TEXT NOT NULL)"
        )
        self._conn.commit()

    def list(self) -> list[AccountSubscription]:
        with self._lock:
            rows = self._conn.execute("SELECT payload FROM subscriptions").fetchall()
        items: list[AccountSubscription] = []
        for (payload,) in rows:
            try:
                items.append(AccountSubscription.model_validate_json(payload))
            except Exception:
                logger.warning(
                    "subscription_deserialize_failed", extra={"store": "sqlite"}, exc_info=True
                )
                continue
        return items

    def get(self, api_key_hash: str) -> AccountSubscription | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT payload FROM subscriptions WHERE api_key_hash = ?",
                (api_key_hash,),
            ).fetchone()
        if not row:
            return None
        return AccountSubscription.model_validate_json(row[0])

    def save(self, subscription: AccountSubscription) -> None:
        payload = subscription.model_dump_json(indent=2)
        with self._lock:
            self._conn.execute(
                "INSERT OR REPLACE INTO subscriptions (api_key_hash, payload) VALUES (?, ?)",
                (subscription.api_key_hash, payload),
            )
            self._conn.commit()

    def delete(self, api_key_hash: str) -> None:
        with self._lock:
            self._conn.execute("DELETE FROM subscriptions WHERE api_key_hash = ?", (api_key_hash,))
            self._conn.commit()
