"""Storage backends for API persistence."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import sqlite3

from album_conceptualizer.models.album import Album
from album_conceptualizer.models.album_bible import AlbumBible


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


@dataclass
class FileAlbumStore(AlbumStore):
    """File-backed album store (JSON per album)."""

    root: Path

    def __post_init__(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)

    def _path_for(self, album_id: str) -> Path:
        return self.root / f"{album_id}.json"

    def list(self) -> list[Album]:
        albums: list[Album] = []
        for path in self.root.glob("*.json"):
            try:
                albums.append(Album.model_validate_json(path.read_text()))
            except Exception:
                continue
        return albums

    def get(self, album_id: str) -> Album | None:
        path = self._path_for(album_id)
        if not path.exists():
            return None
        return Album.model_validate_json(path.read_text())

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
        return self.root / f"{album_id}.json"

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
class SQLiteAlbumStore(AlbumStore):
    """SQLite-backed album store (JSON payloads)."""

    path: Path

    def __post_init__(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self.path) as conn:
            conn.execute(
                "CREATE TABLE IF NOT EXISTS albums (id TEXT PRIMARY KEY, payload TEXT NOT NULL)"
            )

    def list(self) -> list[Album]:
        with sqlite3.connect(self.path) as conn:
            rows = conn.execute("SELECT payload FROM albums").fetchall()
        albums: list[Album] = []
        for (payload,) in rows:
            try:
                albums.append(Album.model_validate_json(payload))
            except Exception:
                continue
        return albums

    def get(self, album_id: str) -> Album | None:
        with sqlite3.connect(self.path) as conn:
            row = conn.execute(
                "SELECT payload FROM albums WHERE id = ?", (album_id,)
            ).fetchone()
        if not row:
            return None
        return Album.model_validate_json(row[0])

    def save(self, album: Album) -> None:
        payload = album.model_dump_json(indent=2)
        with sqlite3.connect(self.path) as conn:
            conn.execute(
                "INSERT OR REPLACE INTO albums (id, payload) VALUES (?, ?)",
                (str(album.id), payload),
            )
            conn.commit()

    def delete(self, album_id: str) -> None:
        with sqlite3.connect(self.path) as conn:
            conn.execute("DELETE FROM albums WHERE id = ?", (album_id,))
            conn.commit()


@dataclass
class SQLiteBibleStore(BibleStore):
    """SQLite-backed album bible store (JSON payloads)."""

    path: Path

    def __post_init__(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self.path) as conn:
            conn.execute(
                "CREATE TABLE IF NOT EXISTS bibles (album_id TEXT PRIMARY KEY, payload TEXT NOT NULL)"
            )

    def get(self, album_id: str) -> AlbumBible | None:
        with sqlite3.connect(self.path) as conn:
            row = conn.execute(
                "SELECT payload FROM bibles WHERE album_id = ?", (album_id,)
            ).fetchone()
        if not row:
            return None
        return AlbumBible.model_validate_json(row[0])

    def save(self, album_id: str, bible: AlbumBible) -> None:
        payload = bible.model_dump_json(indent=2)
        with sqlite3.connect(self.path) as conn:
            conn.execute(
                "INSERT OR REPLACE INTO bibles (album_id, payload) VALUES (?, ?)",
                (album_id, payload),
            )
            conn.commit()

    def delete(self, album_id: str) -> None:
        with sqlite3.connect(self.path) as conn:
            conn.execute("DELETE FROM bibles WHERE album_id = ?", (album_id,))
            conn.commit()
