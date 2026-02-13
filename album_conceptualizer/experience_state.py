"""Persistence backends for experience toolkit state."""

from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from threading import RLock
from typing import Any, Protocol


class ExperienceStateStore(Protocol):
    """Storage protocol for collaboration rooms and challenge profiles."""

    def list_rooms(self, album_id: str) -> list[dict[str, Any]]:
        """List all collaboration rooms for one album."""

    def get_room(self, album_id: str, room_id: str) -> dict[str, Any] | None:
        """Return one collaboration room payload."""

    def save_room(self, album_id: str, room_id: str, payload: dict[str, Any]) -> None:
        """Persist one collaboration room payload."""

    def get_profile(self, profile_id: str) -> dict[str, Any] | None:
        """Return one challenge profile payload."""

    def save_profile(self, profile_id: str, payload: dict[str, Any]) -> None:
        """Persist one challenge profile payload."""

    def list_profiles(self) -> list[dict[str, Any]]:
        """List all challenge profile payloads."""


class InMemoryExperienceStateStore:
    """In-memory experience state store."""

    def __init__(self) -> None:
        self._rooms: dict[str, dict[str, dict[str, Any]]] = {}
        self._profiles: dict[str, dict[str, Any]] = {}
        self._lock = RLock()

    def list_rooms(self, album_id: str) -> list[dict[str, Any]]:
        with self._lock:
            rooms = self._rooms.get(album_id, {})
            return [dict(payload) for payload in rooms.values()]

    def get_room(self, album_id: str, room_id: str) -> dict[str, Any] | None:
        with self._lock:
            payload = self._rooms.get(album_id, {}).get(room_id)
            return dict(payload) if payload else None

    def save_room(self, album_id: str, room_id: str, payload: dict[str, Any]) -> None:
        with self._lock:
            self._rooms.setdefault(album_id, {})[room_id] = dict(payload)

    def get_profile(self, profile_id: str) -> dict[str, Any] | None:
        with self._lock:
            payload = self._profiles.get(profile_id)
            return dict(payload) if payload else None

    def save_profile(self, profile_id: str, payload: dict[str, Any]) -> None:
        with self._lock:
            self._profiles[profile_id] = dict(payload)

    def list_profiles(self) -> list[dict[str, Any]]:
        with self._lock:
            return [dict(payload) for payload in self._profiles.values()]


def _safe_path_token(value: str) -> str:
    token = "".join(char if char.isalnum() or char in {"-", "_"} else "_" for char in value)
    collapsed = "_".join(part for part in token.split("_") if part)
    return collapsed or "item"


@dataclass
class FileExperienceStateStore:
    """File-backed experience state store."""

    root: Path
    _lock: RLock = field(default_factory=RLock, init=False, repr=False)

    def __post_init__(self) -> None:
        (self.root / "rooms").mkdir(parents=True, exist_ok=True)
        (self.root / "profiles").mkdir(parents=True, exist_ok=True)

    def _room_dir(self, album_id: str) -> Path:
        room_dir = self.root / "rooms" / _safe_path_token(album_id)
        room_dir.mkdir(parents=True, exist_ok=True)
        return room_dir

    def _room_path(self, album_id: str, room_id: str) -> Path:
        return self._room_dir(album_id) / f"{_safe_path_token(room_id)}.json"

    def _profile_path(self, profile_id: str) -> Path:
        profile_dir = self.root / "profiles"
        profile_dir.mkdir(parents=True, exist_ok=True)
        return profile_dir / f"{_safe_path_token(profile_id)}.json"

    def list_rooms(self, album_id: str) -> list[dict[str, Any]]:
        with self._lock:
            room_dir = self._room_dir(album_id)
            rooms: list[dict[str, Any]] = []
            for path in room_dir.glob("*.json"):
                try:
                    rooms.append(json.loads(path.read_text()))
                except Exception:
                    continue
            return rooms

    def get_room(self, album_id: str, room_id: str) -> dict[str, Any] | None:
        with self._lock:
            path = self._room_path(album_id, room_id)
            if not path.exists():
                return None
            try:
                return dict(json.loads(path.read_text()))
            except Exception:
                return None

    def save_room(self, album_id: str, room_id: str, payload: dict[str, Any]) -> None:
        with self._lock:
            path = self._room_path(album_id, room_id)
            path.write_text(json.dumps(payload, indent=2))

    def get_profile(self, profile_id: str) -> dict[str, Any] | None:
        with self._lock:
            path = self._profile_path(profile_id)
            if not path.exists():
                return None
            try:
                return dict(json.loads(path.read_text()))
            except Exception:
                return None

    def save_profile(self, profile_id: str, payload: dict[str, Any]) -> None:
        with self._lock:
            path = self._profile_path(profile_id)
            path.write_text(json.dumps(payload, indent=2))

    def list_profiles(self) -> list[dict[str, Any]]:
        with self._lock:
            profile_dir = self.root / "profiles"
            profile_dir.mkdir(parents=True, exist_ok=True)
            profiles: list[dict[str, Any]] = []
            for path in profile_dir.glob("*.json"):
                try:
                    profiles.append(dict(json.loads(path.read_text())))
                except Exception:
                    continue
            return profiles


@dataclass
class SQLiteExperienceStateStore:
    """SQLite-backed experience state store."""

    path: Path
    _lock: RLock = field(default_factory=RLock, init=False, repr=False)

    def __post_init__(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self.path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS collab_rooms (
                    album_id TEXT NOT NULL,
                    room_id TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (album_id, room_id)
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS challenge_profiles (
                    profile_id TEXT PRIMARY KEY,
                    payload TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.commit()

    def list_rooms(self, album_id: str) -> list[dict[str, Any]]:
        with self._lock, sqlite3.connect(self.path) as conn:
            rows = conn.execute(
                "SELECT payload FROM collab_rooms WHERE album_id = ?",
                (album_id,),
            ).fetchall()
        rooms: list[dict[str, Any]] = []
        for (payload,) in rows:
            try:
                rooms.append(dict(json.loads(payload)))
            except Exception:
                continue
        return rooms

    def get_room(self, album_id: str, room_id: str) -> dict[str, Any] | None:
        with self._lock, sqlite3.connect(self.path) as conn:
            row = conn.execute(
                "SELECT payload FROM collab_rooms WHERE album_id = ? AND room_id = ?",
                (album_id, room_id),
            ).fetchone()
        if not row:
            return None
        try:
            return dict(json.loads(row[0]))
        except Exception:
            return None

    def save_room(self, album_id: str, room_id: str, payload: dict[str, Any]) -> None:
        serialized = json.dumps(payload)
        now = datetime.now(UTC).isoformat()
        with self._lock, sqlite3.connect(self.path) as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO collab_rooms (album_id, room_id, payload, updated_at)
                VALUES (?, ?, ?, ?)
                """,
                (album_id, room_id, serialized, now),
            )
            conn.commit()

    def get_profile(self, profile_id: str) -> dict[str, Any] | None:
        with self._lock, sqlite3.connect(self.path) as conn:
            row = conn.execute(
                "SELECT payload FROM challenge_profiles WHERE profile_id = ?",
                (profile_id,),
            ).fetchone()
        if not row:
            return None
        try:
            return dict(json.loads(row[0]))
        except Exception:
            return None

    def save_profile(self, profile_id: str, payload: dict[str, Any]) -> None:
        serialized = json.dumps(payload)
        now = datetime.now(UTC).isoformat()
        with self._lock, sqlite3.connect(self.path) as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO challenge_profiles (profile_id, payload, updated_at)
                VALUES (?, ?, ?)
                """,
                (profile_id, serialized, now),
            )
            conn.commit()

    def list_profiles(self) -> list[dict[str, Any]]:
        with self._lock, sqlite3.connect(self.path) as conn:
            rows = conn.execute("SELECT payload FROM challenge_profiles").fetchall()
        profiles: list[dict[str, Any]] = []
        for (payload,) in rows:
            try:
                profiles.append(dict(json.loads(payload)))
            except Exception:
                continue
        return profiles
