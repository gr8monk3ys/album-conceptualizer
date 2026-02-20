"""Coverage-focused tests for redis-backed collaboration realtime hub."""

from __future__ import annotations

import asyncio
import json
import sys
from types import ModuleType

import pytest

from album_conceptualizer.api.v1 import experience as experience_api


class _FakeWebSocket:
    def __init__(self) -> None:
        self.sent: list[dict] = []

    async def send_json(self, payload: dict) -> None:
        self.sent.append(payload)


class _FakePipeline:
    def __init__(self, redis: _FakeRedis) -> None:
        self._redis = redis
        self._ops: list[tuple] = []

    def expire(self, key: str, ttl_seconds: int) -> _FakePipeline:
        self._ops.append(("expire", key, ttl_seconds))
        return self

    def sadd(self, key: str, *values: str) -> _FakePipeline:
        self._ops.append(("sadd", key, values))
        return self

    def srem(self, key: str, *values: str) -> _FakePipeline:
        self._ops.append(("srem", key, values))
        return self

    def hset(self, key: str, field: str, value: str) -> _FakePipeline:
        self._ops.append(("hset", key, field, value))
        return self

    def hdel(self, key: str, *fields: str) -> _FakePipeline:
        self._ops.append(("hdel", key, fields))
        return self

    def smembers(self, key: str) -> _FakePipeline:
        self._ops.append(("smembers", key))
        return self

    def hgetall(self, key: str) -> _FakePipeline:
        self._ops.append(("hgetall", key))
        return self

    async def execute(self) -> list[object]:
        results: list[object] = []
        for op in self._ops:
            match op[0]:
                case "expire":
                    _, key, ttl_seconds = op
                    self._redis.expiry[key] = ttl_seconds
                    results.append(True)
                case "sadd":
                    _, key, values = op
                    members = self._redis.sets.setdefault(key, set())
                    before = len(members)
                    members.update(str(value) for value in values)
                    results.append(len(members) - before)
                case "srem":
                    _, key, values = op
                    members = self._redis.sets.setdefault(key, set())
                    removed = 0
                    for value in values:
                        if value in members:
                            members.remove(value)
                            removed += 1
                    results.append(removed)
                case "hset":
                    _, key, field, value = op
                    self._redis.hashes.setdefault(key, {})[field] = value
                    results.append(True)
                case "hdel":
                    _, key, fields = op
                    bucket = self._redis.hashes.setdefault(key, {})
                    removed = 0
                    for field in fields:
                        if field in bucket:
                            del bucket[field]
                            removed += 1
                    results.append(removed)
                case "smembers":
                    _, key = op
                    results.append(set(self._redis.sets.get(key, set())))
                case "hgetall":
                    _, key = op
                    results.append(dict(self._redis.hashes.get(key, {})))
        self._ops.clear()
        return results


class _StreamingPubSub:
    def __init__(self) -> None:
        self.subscribed: set[str] = set()
        self.messages: list[dict] = []
        self.closed = False

    async def subscribe(self, channel: str) -> None:
        self.subscribed.add(channel)

    async def unsubscribe(self, channel: str) -> None:
        self.subscribed.discard(channel)

    async def close(self) -> None:
        self.closed = True

    async def listen(self):
        while True:
            if self.messages:
                yield self.messages.pop(0)
                continue
            await asyncio.sleep(0.005)


class _FinitePubSub:
    def __init__(self, messages: list[dict]) -> None:
        self._messages = list(messages)

    async def listen(self):
        for message in self._messages:
            yield message


class _RaisingPubSub:
    async def listen(self):
        raise RuntimeError("pubsub offline")
        yield {}  # pragma: no cover


class _FakeRedis:
    def __init__(self) -> None:
        self.sets: dict[str, set[str]] = {}
        self.hashes: dict[str, dict[str, str]] = {}
        self.expiry: dict[str, int] = {}
        self.published: list[tuple[str, str]] = []
        self.pubsubs: list[_StreamingPubSub] = []

    def pipeline(self) -> _FakePipeline:
        return _FakePipeline(self)

    async def publish(self, channel: str, message: str) -> int:
        self.published.append((channel, message))
        for pubsub in self.pubsubs:
            if channel in pubsub.subscribed:
                pubsub.messages.append({"type": "message", "data": message})
        return 1

    def pubsub(self) -> _StreamingPubSub:
        pubsub = _StreamingPubSub()
        self.pubsubs.append(pubsub)
        return pubsub

    async def smembers(self, key: str) -> set[str] | object:
        return set(self.sets.get(key, set()))

    async def sadd(self, key: str, value: str) -> int:
        members = self.sets.setdefault(key, set())
        before = len(members)
        members.add(value)
        return len(members) - before

    async def srem(self, key: str, value: str) -> int:
        members = self.sets.setdefault(key, set())
        if value in members:
            members.remove(value)
            return 1
        return 0

    async def hgetall(self, key: str) -> dict[str, str] | object:
        return dict(self.hashes.get(key, {}))

    async def hget(self, key: str, field: str) -> str | None:
        return self.hashes.get(key, {}).get(field)

    async def hset(self, key: str, field: str, value: str) -> int:
        self.hashes.setdefault(key, {})[field] = value
        return 1

    async def hdel(self, key: str, *fields: str) -> int:
        bucket = self.hashes.setdefault(key, {})
        removed = 0
        for field in fields:
            if field in bucket:
                del bucket[field]
                removed += 1
        return removed


def _install_fake_redis_module(monkeypatch, redis_instance: _FakeRedis) -> None:
    redis_module = ModuleType("redis")
    redis_async_module = ModuleType("redis.asyncio")

    def from_url(redis_url: str, *, decode_responses: bool):
        del redis_url, decode_responses
        return redis_instance

    redis_async_module.from_url = from_url  # type: ignore[attr-defined]
    redis_module.asyncio = redis_async_module  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "redis", redis_module)
    monkeypatch.setitem(sys.modules, "redis.asyncio", redis_async_module)


@pytest.mark.asyncio
async def test_redis_realtime_hub_init_validates_url_and_import(monkeypatch):
    with pytest.raises(ValueError, match="redis_url is required"):
        experience_api.RedisCollabRealtimeHub(redis_url="")

    redis_module = ModuleType("redis")
    monkeypatch.setitem(sys.modules, "redis", redis_module)
    monkeypatch.setitem(sys.modules, "redis.asyncio", None)
    with pytest.raises(RuntimeError, match="requires the 'redis' package"):
        experience_api.RedisCollabRealtimeHub(redis_url="redis://localhost:6379/0")


@pytest.mark.asyncio
async def test_redis_realtime_hub_helpers_and_snapshots(monkeypatch):
    fake_redis = _FakeRedis()
    _install_fake_redis_module(monkeypatch, fake_redis)
    hub = experience_api.RedisCollabRealtimeHub(
        redis_url="redis://localhost:6379/0", ttl_seconds=10
    )
    room_key = hub._room_key("album-1", "room-1")

    assert hub._ttl_seconds == 30
    assert hub._channel_key(room_key).endswith(":events")
    assert hub._presence_key(room_key).endswith(":presence")
    assert hub._typing_key(room_key).endswith(":typing")
    assert hub._locks_key(room_key).endswith(":locks")

    await hub._set_presence_member(room_key, "instance:1", "  alice  ")
    await hub._touch_room_keys(room_key)
    assert await hub._presence_snapshot(room_key) == ["alice"]

    fake_redis.sets[hub._typing_key(room_key)] = {" alice ", "", "bob"}
    assert await hub._typing_snapshot(room_key) == ["alice", "bob"]

    fake_redis.hashes[hub._locks_key(room_key)] = {
        123: "bad-key-type",  # type: ignore[dict-item]
        "bad-holder": 99,  # type: ignore[dict-item]
        " verse ": "alice",
        "": "ignored",
        "bad": "",
    }
    assert await hub._lock_snapshot(room_key) == {"verse": "alice"}
    released = await hub._release_locks_for_alias(room_key, "alice")
    assert released == ["verse"]

    await hub._publish_event(
        room_key,
        experience_api.CollabRealtimeEvent(
            type="heartbeat", room_id="room-1", payload={"ok": True}
        ),
        sender_alias="alice",
        exclude_sender=True,
        only_alias="bob",
    )
    assert fake_redis.published

    async def non_set_members(_: str) -> object:
        return ["not-a-set"]

    async def non_dict_hash(_: str) -> object:
        return ["not-a-dict"]

    monkeypatch.setattr(fake_redis, "smembers", non_set_members)
    monkeypatch.setattr(fake_redis, "hgetall", non_dict_hash)
    assert await hub._typing_snapshot(room_key) == []
    assert await hub._lock_snapshot(room_key) == {}

    class _BadSnapshotPipeline:
        def smembers(self, key: str):
            del key
            return self

        def hgetall(self, key: str):
            del key
            return self

        async def execute(self) -> list[object]:
            return [["bad-members"], ["bad-alias-lookup"]]

    def _bad_pipeline() -> _BadSnapshotPipeline:
        return _BadSnapshotPipeline()

    monkeypatch.setattr(fake_redis, "pipeline", _bad_pipeline)
    assert await hub._presence_snapshot(room_key) == []


@pytest.mark.asyncio
async def test_redis_realtime_hub_listen_room_filters_messages(monkeypatch):
    fake_redis = _FakeRedis()
    _install_fake_redis_module(monkeypatch, fake_redis)
    hub = experience_api.RedisCollabRealtimeHub(redis_url="redis://localhost:6379/0")
    room_key = hub._room_key("album-2", "room-2")
    alice = _FakeWebSocket()
    bob = _FakeWebSocket()
    hub._connections[room_key] = {id(alice): ("alice", alice), id(bob): ("bob", bob)}

    valid_event = experience_api.CollabRealtimeEvent(
        type="typing",
        room_id="room-2",
        payload={"alias": "alice", "target": "hook", "state": "start", "typing": ["alice"]},
    ).model_dump(mode="json")

    pubsub = _FinitePubSub(
        [
            {"type": "subscribe", "data": ""},
            {"type": "message", "data": 123},
            {"type": "message", "data": "{bad-json"},
            {"type": "message", "data": json.dumps({"event": "not-a-dict"})},
            {"type": "message", "data": json.dumps({"event": {"type": "broken"}})},
            {
                "type": "message",
                "data": json.dumps(
                    {"event": valid_event, "exclude_sender": True, "sender_alias": "alice"}
                ),
            },
            {
                "type": "message",
                "data": json.dumps({"event": valid_event, "only_alias": "bob"}),
            },
        ]
    )

    await hub._listen_room(room_key, pubsub)
    assert not alice.sent
    assert len(bob.sent) == 2

    await hub._listen_room(room_key, _RaisingPubSub())


@pytest.mark.asyncio
async def test_redis_realtime_hub_listener_lifecycle(monkeypatch):
    fake_redis = _FakeRedis()
    _install_fake_redis_module(monkeypatch, fake_redis)
    hub = experience_api.RedisCollabRealtimeHub(redis_url="redis://localhost:6379/0")
    room_key = hub._room_key("album-3", "room-3")

    await hub._ensure_room_listener(room_key)
    assert room_key in hub._room_listener_tasks
    await hub._ensure_room_listener(room_key)

    await hub._stop_room_listener(room_key)
    assert room_key not in hub._room_listener_tasks
    assert room_key not in hub._room_pubsubs

    await hub._stop_room_listener(room_key)


@pytest.mark.asyncio
async def test_redis_realtime_hub_connect_disconnect_and_message_paths(monkeypatch):
    fake_redis = _FakeRedis()
    _install_fake_redis_module(monkeypatch, fake_redis)
    hub = experience_api.RedisCollabRealtimeHub(redis_url="redis://localhost:6379/0")
    album_id = "album-4"
    room_id = "room-4"
    room_key = hub._room_key(album_id, room_id)
    alice = _FakeWebSocket()
    bob = _FakeWebSocket()

    async def failing_publish(*args, **kwargs):
        del args, kwargs
        raise RuntimeError("redis publish failed")

    monkeypatch.setattr(hub, "_publish_event", failing_publish)
    await hub.connect(album_id, room_id, "alice", alice)
    await hub.connect(album_id, room_id, "bob", bob)
    assert any(event["type"] == "snapshot" for event in alice.sent)
    assert any(event["type"] == "presence_joined" for event in alice.sent)
    assert any(event["type"] == "snapshot" for event in bob.sent)

    await hub.handle_message(album_id, room_id, "alice", alice, {"type": "typing_start"})
    await hub.handle_message(
        album_id,
        room_id,
        "alice",
        alice,
        {"type": "typing_start", "target": "track:1:hook"},
    )
    await hub.handle_message(album_id, room_id, "alice", alice, {"type": "typing_stop"})

    await hub.handle_message(album_id, room_id, "alice", alice, {"type": "claim_edit"})
    await hub.handle_message(
        album_id,
        room_id,
        "alice",
        alice,
        {"type": "claim_edit", "target": "track:1:hook"},
    )
    await fake_redis.hset(hub._locks_key(room_key), "track:1:hook", "bob")
    await hub.handle_message(
        album_id,
        room_id,
        "alice",
        alice,
        {"type": "claim_edit", "target": "track:1:hook"},
    )
    await hub.handle_message(
        album_id,
        room_id,
        "alice",
        alice,
        {"type": "claim_edit", "target": "track:1:hook", "force": True},
    )

    await hub.handle_message(album_id, room_id, "alice", alice, {"type": "release_edit"})
    await fake_redis.hset(hub._locks_key(room_key), "track:1:hook", "bob")
    await hub.handle_message(
        album_id,
        room_id,
        "alice",
        alice,
        {"type": "release_edit", "target": "track:1:hook"},
    )
    await fake_redis.hset(hub._locks_key(room_key), "track:1:hook", "alice")
    await hub.handle_message(
        album_id,
        room_id,
        "alice",
        alice,
        {"type": "release_edit", "target": "track:1:hook"},
    )

    hub._presence_members.setdefault(room_key, {})[id(alice)] = "instance:alice"
    await hub.handle_message(album_id, room_id, "alice", alice, {"type": "heartbeat"})
    await hub.handle_message(album_id, room_id, "alice", alice, {"type": "mystery"})

    assert any(event["type"] == "error" for event in alice.sent)
    assert any(event["type"] == "typing" for event in bob.sent)
    assert any(event["type"] == "edit_released" for event in bob.sent)
    assert any(event["type"] == "heartbeat" for event in alice.sent)

    await fake_redis.sadd(hub._typing_key(room_key), "bob")
    await fake_redis.hset(hub._locks_key(room_key), "track:2:verse", "bob")
    await hub.disconnect(album_id, room_id, bob)
    assert any(event["type"] == "presence_left" for event in alice.sent)
    assert any(event["type"] == "edit_released" for event in alice.sent)

    await hub.disconnect(album_id, room_id, _FakeWebSocket())
    await hub.disconnect(album_id, room_id, alice)
    await hub._stop_room_listener(room_key)


@pytest.mark.asyncio
async def test_in_memory_realtime_hub_release_and_heartbeat_branches():
    hub = experience_api.CollabRealtimeHub()
    album_id = "album-memory"
    room_id = "room-memory"
    alice = _FakeWebSocket()
    bob = _FakeWebSocket()

    await hub.connect(album_id, room_id, "alice", alice)
    await hub.connect(album_id, room_id, "bob", bob)
    await hub.disconnect(album_id, room_id, _FakeWebSocket())

    await hub.handle_message(album_id, room_id, "alice", alice, {"type": "typing_start"})
    await hub.handle_message(
        album_id,
        room_id,
        "alice",
        alice,
        {"type": "typing_start", "target": "track:1:chorus"},
    )
    await hub.handle_message(album_id, room_id, "alice", alice, {"type": "typing_stop"})
    await hub.handle_message(album_id, room_id, "alice", alice, {"type": "claim_edit"})
    await hub.handle_message(
        album_id,
        room_id,
        "alice",
        alice,
        {"type": "release_edit"},
    )

    await hub.handle_message(
        album_id,
        room_id,
        "bob",
        bob,
        {"type": "claim_edit", "target": "track:1:chorus"},
    )
    await hub.handle_message(
        album_id,
        room_id,
        "alice",
        alice,
        {"type": "release_edit", "target": "track:1:chorus"},
    )
    await hub.handle_message(
        album_id,
        room_id,
        "bob",
        bob,
        {"type": "release_edit", "target": "track:1:chorus"},
    )
    await hub.handle_message(album_id, room_id, "alice", alice, {"type": "heartbeat"})
    await hub.handle_message(album_id, room_id, "alice", alice, {"type": "unknown"})

    assert any(event["type"] == "error" for event in alice.sent)
    assert any(event["type"] == "typing" for event in bob.sent)
    assert any(event["type"] == "edit_conflict" for event in alice.sent)
    assert any(event["type"] == "edit_released" for event in alice.sent)
    assert any(event["type"] == "heartbeat" for event in alice.sent)


@pytest.mark.asyncio
async def test_in_memory_realtime_hub_send_event_swallows_websocket_errors():
    hub = experience_api.CollabRealtimeHub()

    class _FailingSocket:
        async def send_json(self, payload: dict) -> None:
            del payload
            raise RuntimeError("socket closed")

    await hub._send_event(
        _FailingSocket(),
        experience_api.CollabRealtimeEvent(type="heartbeat", room_id="room", payload={"ok": True}),
    )
