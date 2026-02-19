"""Tests for File and SQLite experience state storage backends."""

from pathlib import Path

import pytest

from album_conceptualizer.experience_state import (
    FileExperienceStateStore,
    InMemoryExperienceStateStore,
    SQLiteExperienceStateStore,
)


SAMPLE_ROOM = {"session_id": "s1", "participants": ["alice", "bob"], "active": True}
SAMPLE_PROFILE = {"profile_id": "p1", "score": 42, "badges": ["first-album"]}


def _run_store_contract(store) -> None:
    """Exercise the full ExperienceStateStore API contract."""
    # Rooms: save and retrieve
    store.save_room("album-1", "room-1", SAMPLE_ROOM)
    room = store.get_room("album-1", "room-1")
    assert room is not None
    assert room["session_id"] == "s1"

    # list_rooms
    store.save_room("album-1", "room-2", {"session_id": "s2", "active": False})
    rooms = store.list_rooms("album-1")
    assert len(rooms) == 2

    # list_rooms for unknown album
    assert store.list_rooms("album-unknown") == []

    # get_room - missing
    assert store.get_room("album-1", "room-99") is None

    # Profiles: save and retrieve
    store.save_profile("profile-1", SAMPLE_PROFILE)
    profile = store.get_profile("profile-1")
    assert profile is not None
    assert profile["score"] == 42

    # list_profiles
    store.save_profile("profile-2", {"score": 0})
    profiles = store.list_profiles()
    assert len(profiles) == 2

    # get_profile - missing
    assert store.get_profile("no-such-profile") is None

    # overwrite room
    updated_room = dict(SAMPLE_ROOM)
    updated_room["active"] = False
    store.save_room("album-1", "room-1", updated_room)
    assert store.get_room("album-1", "room-1")["active"] is False


class TestInMemoryExperienceStateStore:
    def test_full_contract(self) -> None:
        store = InMemoryExperienceStateStore()
        _run_store_contract(store)


class TestFileExperienceStateStore:
    def test_full_contract(self, tmp_path: Path) -> None:
        store = FileExperienceStateStore(root=tmp_path / "exp")
        _run_store_contract(store)

    def test_corrupt_room_file_skipped(self, tmp_path: Path) -> None:
        root = tmp_path / "exp"
        store = FileExperienceStateStore(root=root)
        # Create valid structure then corrupt a room file
        store.save_room("album-1", "room-1", SAMPLE_ROOM)
        room_dir = root / "rooms" / "album-1"
        (room_dir / "corrupt.json").write_text("{NOT JSON}")
        rooms = store.list_rooms("album-1")
        # Corrupt file is skipped; only valid rooms returned
        assert len(rooms) == 1

    def test_corrupt_profile_file_skipped(self, tmp_path: Path) -> None:
        root = tmp_path / "exp"
        store = FileExperienceStateStore(root=root)
        store.save_profile("p1", SAMPLE_PROFILE)
        (root / "profiles" / "corrupt.json").write_text("NOPE")
        profiles = store.list_profiles()
        assert len(profiles) == 1

    def test_corrupt_room_get_returns_none(self, tmp_path: Path) -> None:
        root = tmp_path / "exp"
        store = FileExperienceStateStore(root=root)
        store.save_room("album-x", "room-x", SAMPLE_ROOM)
        room_path = root / "rooms" / "album-x" / "room-x.json"
        room_path.write_text("{BROKEN}")
        assert store.get_room("album-x", "room-x") is None

    def test_corrupt_profile_get_returns_none(self, tmp_path: Path) -> None:
        root = tmp_path / "exp"
        store = FileExperienceStateStore(root=root)
        profile_path = root / "profiles" / "myprofile.json"
        profile_path.parent.mkdir(parents=True, exist_ok=True)
        profile_path.write_text("{CORRUPT")
        assert store.get_profile("myprofile") is None

    def test_special_chars_in_ids(self, tmp_path: Path) -> None:
        store = FileExperienceStateStore(root=tmp_path / "exp")
        store.save_room("album/with/slashes", "room?id=1", {"data": "ok"})
        room = store.get_room("album/with/slashes", "room?id=1")
        assert room is not None
        assert room["data"] == "ok"


class TestSQLiteExperienceStateStore:
    def test_full_contract(self, tmp_path: Path) -> None:
        store = SQLiteExperienceStateStore(path=tmp_path / "exp.db")
        _run_store_contract(store)

    def test_room_overwrite(self, tmp_path: Path) -> None:
        store = SQLiteExperienceStateStore(path=tmp_path / "exp.db")
        store.save_room("a1", "r1", {"v": 1})
        store.save_room("a1", "r1", {"v": 2})
        assert store.get_room("a1", "r1")["v"] == 2

    def test_profile_overwrite(self, tmp_path: Path) -> None:
        store = SQLiteExperienceStateStore(path=tmp_path / "exp.db")
        store.save_profile("p1", {"score": 1})
        store.save_profile("p1", {"score": 99})
        assert store.get_profile("p1")["score"] == 99

    def test_multiple_albums_rooms_are_isolated(self, tmp_path: Path) -> None:
        store = SQLiteExperienceStateStore(path=tmp_path / "exp.db")
        store.save_room("album-A", "room-1", {"owner": "A"})
        store.save_room("album-B", "room-1", {"owner": "B"})
        rooms_a = store.list_rooms("album-A")
        assert len(rooms_a) == 1
        assert rooms_a[0]["owner"] == "A"
