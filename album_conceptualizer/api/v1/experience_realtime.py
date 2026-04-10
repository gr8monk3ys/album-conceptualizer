"""Realtime collaboration hub primitives for experience endpoints."""

from __future__ import annotations

import asyncio
import json
from contextlib import suppress
from typing import Any, cast
from uuid import uuid4

from fastapi import WebSocket
from pydantic import BaseModel, Field

from album_conceptualizer.config import get_settings


class CollabRealtimeEvent(BaseModel):
    """Realtime collaboration websocket event envelope."""

    type: str
    room_id: str
    payload: dict[str, Any] = Field(default_factory=dict)


class CollabRealtimeHub:
    """In-process websocket hub for live collaboration room events."""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._connections: dict[str, dict[int, tuple[str, WebSocket]]] = {}
        self._typing: dict[str, set[str]] = {}
        self._locks: dict[str, dict[str, str]] = {}

    @staticmethod
    def _room_key(album_id: str, room_id: str) -> str:
        return f"{album_id}:{room_id}"

    def _presence_locked(self, room_key: str) -> list[str]:
        room_connections = self._connections.get(room_key, {})
        return sorted({alias for alias, _ in room_connections.values()})

    async def _send_event(self, websocket: WebSocket, event: CollabRealtimeEvent) -> None:
        try:
            await websocket.send_json(event.model_dump(mode="json"))
        except Exception:
            return

    async def connect(self, album_id: str, room_id: str, alias: str, websocket: WebSocket) -> None:
        room_key = self._room_key(album_id, room_id)
        connection_id = id(websocket)
        async with self._lock:
            room_connections = self._connections.setdefault(room_key, {})
            room_connections[connection_id] = (alias, websocket)
            snapshot = CollabRealtimeEvent(
                type="snapshot",
                room_id=room_id,
                payload={
                    "alias": alias,
                    "presence": self._presence_locked(room_key),
                    "typing": sorted(self._typing.get(room_key, set())),
                    "locks": dict(self._locks.get(room_key, {})),
                },
            )
            joined = CollabRealtimeEvent(
                type="presence_joined",
                room_id=room_id,
                payload={"alias": alias, "presence": self._presence_locked(room_key)},
            )
            peers = [
                peer for peer_id, (_, peer) in room_connections.items() if peer_id != connection_id
            ]

        await self._send_event(websocket, snapshot)
        for peer in peers:
            await self._send_event(peer, joined)

    async def disconnect(self, album_id: str, room_id: str, websocket: WebSocket) -> None:
        room_key = self._room_key(album_id, room_id)
        connection_id = id(websocket)
        async with self._lock:
            room_connections = self._connections.get(room_key, {})
            removed = room_connections.pop(connection_id, None)
            if not removed:
                return
            alias = removed[0]
            alias_still_present = any(
                existing_alias == alias for existing_alias, _ in room_connections.values()
            )
            released_targets: list[str] = []
            if not alias_still_present:
                self._typing.setdefault(room_key, set()).discard(alias)
                room_locks = self._locks.setdefault(room_key, {})
                for target, holder in list(room_locks.items()):
                    if holder == alias:
                        room_locks.pop(target, None)
                        released_targets.append(target)

            peers = [peer for _, peer in room_connections.values()]
            presence = self._presence_locked(room_key)
            if not room_connections:
                self._connections.pop(room_key, None)
                self._typing.pop(room_key, None)
                self._locks.pop(room_key, None)

        if not alias_still_present:
            left_event = CollabRealtimeEvent(
                type="presence_left",
                room_id=room_id,
                payload={"alias": alias, "presence": presence},
            )
            for peer in peers:
                await self._send_event(peer, left_event)

        for target in released_targets:
            released_event = CollabRealtimeEvent(
                type="edit_released",
                room_id=room_id,
                payload={"alias": alias, "target": target},
            )
            for peer in peers:
                await self._send_event(peer, released_event)

    async def _send_error(self, room_id: str, websocket: WebSocket, message: str) -> None:
        await self._send_event(
            websocket,
            CollabRealtimeEvent(
                type="error",
                room_id=room_id,
                payload={"message": message},
            ),
        )

    async def handle_message(
        self,
        album_id: str,
        room_id: str,
        alias: str,
        websocket: WebSocket,
        payload: dict[str, Any],
    ) -> None:
        room_key = self._room_key(album_id, room_id)
        event_type = str(payload.get("type", "")).strip().lower()
        target = payload.get("target")
        target_value = target.strip() if isinstance(target, str) else None

        if event_type == "typing_start":
            if not target_value:
                await self._send_error(room_id, websocket, "typing_start requires target")
                return
            async with self._lock:
                self._typing.setdefault(room_key, set()).add(alias)
                peers = [
                    peer
                    for _, peer in self._connections.get(room_key, {}).values()
                    if peer is not websocket
                ]
                typing = sorted(self._typing.get(room_key, set()))
            event = CollabRealtimeEvent(
                type="typing",
                room_id=room_id,
                payload={
                    "alias": alias,
                    "target": target_value,
                    "state": "start",
                    "typing": typing,
                },
            )
            for peer in peers:
                await self._send_event(peer, event)
            return

        if event_type == "typing_stop":
            async with self._lock:
                self._typing.setdefault(room_key, set()).discard(alias)
                peers = [
                    peer
                    for _, peer in self._connections.get(room_key, {}).values()
                    if peer is not websocket
                ]
                typing = sorted(self._typing.get(room_key, set()))
            event = CollabRealtimeEvent(
                type="typing",
                room_id=room_id,
                payload={"alias": alias, "target": target_value, "state": "stop", "typing": typing},
            )
            for peer in peers:
                await self._send_event(peer, event)
            return

        if event_type == "claim_edit":
            if not target_value:
                await self._send_error(room_id, websocket, "claim_edit requires target")
                return
            force_claim = bool(payload.get("force", False))
            async with self._lock:
                room_locks = self._locks.setdefault(room_key, {})
                holder = room_locks.get(target_value)
                room_peers = [peer for _, peer in self._connections.get(room_key, {}).values()]

                if holder is None or holder == alias:
                    room_locks[target_value] = alias
                    event = CollabRealtimeEvent(
                        type="edit_claimed",
                        room_id=room_id,
                        payload={"alias": alias, "target": target_value},
                    )
                    recipients = room_peers
                elif force_claim:
                    room_locks[target_value] = alias
                    event = CollabRealtimeEvent(
                        type="conflict_resolved",
                        room_id=room_id,
                        payload={
                            "alias": alias,
                            "target": target_value,
                            "previous_holder": holder,
                        },
                    )
                    recipients = room_peers
                else:
                    event = CollabRealtimeEvent(
                        type="edit_conflict",
                        room_id=room_id,
                        payload={
                            "alias": alias,
                            "target": target_value,
                            "holder": holder,
                            "hint": "Use force=true to take over edit lock.",
                        },
                    )
                    recipients = [websocket]

            for recipient in recipients:
                await self._send_event(recipient, event)
            return

        if event_type == "release_edit":
            if not target_value:
                await self._send_error(room_id, websocket, "release_edit requires target")
                return
            async with self._lock:
                room_locks = self._locks.setdefault(room_key, {})
                holder = room_locks.get(target_value)
                if holder != alias:
                    recipients = [websocket]
                    event = CollabRealtimeEvent(
                        type="edit_conflict",
                        room_id=room_id,
                        payload={
                            "alias": alias,
                            "target": target_value,
                            "holder": holder,
                            "hint": "Only the current holder can release this edit lock.",
                        },
                    )
                else:
                    room_locks.pop(target_value, None)
                    recipients = [peer for _, peer in self._connections.get(room_key, {}).values()]
                    event = CollabRealtimeEvent(
                        type="edit_released",
                        room_id=room_id,
                        payload={"alias": alias, "target": target_value},
                    )
            for recipient in recipients:
                await self._send_event(recipient, event)
            return

        if event_type == "heartbeat":
            await self._send_event(
                websocket,
                CollabRealtimeEvent(type="heartbeat", room_id=room_id, payload={"ok": True}),
            )
            return

        await self._send_error(
            room_id, websocket, f"Unsupported event type: {event_type or '<missing>'}"
        )


class RedisCollabRealtimeHub(CollabRealtimeHub):
    """Redis-backed websocket hub with shared locks and pub/sub fan-out."""

    def __init__(self, redis_url: str, ttl_seconds: int = 90) -> None:
        super().__init__()
        if not redis_url:
            raise ValueError("redis_url is required for RedisCollabRealtimeHub")
        try:
            import redis.asyncio as redis_asyncio
        except ImportError as exc:
            raise RuntimeError(
                "Redis realtime backend requires the 'redis' package. "
                "Install with `pip install redis`."
            ) from exc

        self._redis = redis_asyncio.from_url(redis_url, decode_responses=True)
        self._ttl_seconds = max(ttl_seconds, 30)
        self._instance_id = uuid4().hex
        self._presence_members: dict[str, dict[int, str]] = {}
        self._room_pubsubs: dict[str, Any] = {}
        self._room_listener_tasks: dict[str, asyncio.Task[None]] = {}

    def _channel_key(self, room_key: str) -> str:
        return f"album_conceptualizer:collab:{room_key}:events"

    def _presence_key(self, room_key: str) -> str:
        return f"album_conceptualizer:collab:{room_key}:presence"

    def _presence_alias_map_key(self, room_key: str) -> str:
        return f"album_conceptualizer:collab:{room_key}:presence_aliases"

    def _typing_key(self, room_key: str) -> str:
        return f"album_conceptualizer:collab:{room_key}:typing"

    def _locks_key(self, room_key: str) -> str:
        return f"album_conceptualizer:collab:{room_key}:locks"

    async def _touch_room_keys(self, room_key: str) -> None:
        pipeline = self._redis.pipeline()
        pipeline.expire(self._presence_key(room_key), self._ttl_seconds)
        pipeline.expire(self._presence_alias_map_key(room_key), self._ttl_seconds)
        pipeline.expire(self._typing_key(room_key), self._ttl_seconds)
        pipeline.expire(self._locks_key(room_key), self._ttl_seconds)
        await pipeline.execute()

    async def _set_presence_member(self, room_key: str, member_key: str, alias: str) -> None:
        pipeline = self._redis.pipeline()
        pipeline.sadd(self._presence_key(room_key), member_key)
        pipeline.hset(self._presence_alias_map_key(room_key), member_key, alias)
        pipeline.expire(self._presence_key(room_key), self._ttl_seconds)
        pipeline.expire(self._presence_alias_map_key(room_key), self._ttl_seconds)
        await pipeline.execute()

    async def _presence_snapshot(self, room_key: str) -> list[str]:
        pipeline = self._redis.pipeline()
        pipeline.smembers(self._presence_key(room_key))
        pipeline.hgetall(self._presence_alias_map_key(room_key))
        members, alias_lookup = await pipeline.execute()
        if not isinstance(members, set) or not isinstance(alias_lookup, dict):
            return []
        aliases = {
            alias_lookup.get(member, "").strip()
            for member in members
            if isinstance(member, str) and alias_lookup.get(member)
        }
        return sorted(alias for alias in aliases if alias)

    async def _typing_snapshot(self, room_key: str) -> list[str]:
        typing_aliases = await self._redis.smembers(self._typing_key(room_key))
        if not isinstance(typing_aliases, set):
            return []
        return sorted(
            alias.strip() for alias in typing_aliases if isinstance(alias, str) and alias.strip()
        )

    async def _lock_snapshot(self, room_key: str) -> dict[str, str]:
        locks = await self._redis.hgetall(self._locks_key(room_key))
        if not isinstance(locks, dict):
            return {}
        cleaned: dict[str, str] = {}
        for target, holder in locks.items():
            if not isinstance(target, str) or not isinstance(holder, str):
                continue
            target_name = target.strip()
            holder_alias = holder.strip()
            if target_name and holder_alias:
                cleaned[target_name] = holder_alias
        return cleaned

    async def _release_locks_for_alias(self, room_key: str, alias: str) -> list[str]:
        lock_snapshot = await self._lock_snapshot(room_key)
        targets = [target for target, holder in lock_snapshot.items() if holder == alias]
        if targets:
            await self._redis.hdel(self._locks_key(room_key), *targets)
        return targets

    async def _local_room_websockets(
        self,
        room_key: str,
        *,
        exclude_alias: str | None = None,
    ) -> list[WebSocket]:
        async with self._lock:
            entries = list(self._connections.get(room_key, {}).values())
        recipients: list[WebSocket] = []
        for alias, websocket in entries:
            if exclude_alias and alias == exclude_alias:
                continue
            recipients.append(websocket)
        return recipients

    async def _publish_event(
        self,
        room_key: str,
        event: CollabRealtimeEvent,
        *,
        sender_alias: str | None = None,
        exclude_sender: bool = False,
        only_alias: str | None = None,
    ) -> None:
        envelope: dict[str, Any] = {
            "event": event.model_dump(mode="json"),
            "exclude_sender": exclude_sender,
        }
        if sender_alias:
            envelope["sender_alias"] = sender_alias
        if only_alias:
            envelope["only_alias"] = only_alias
        await self._redis.publish(self._channel_key(room_key), json.dumps(envelope))

    async def _listen_room(self, room_key: str, pubsub: Any) -> None:
        try:
            async for message in pubsub.listen():
                if message.get("type") != "message":
                    continue
                data = message.get("data")
                if not isinstance(data, str):
                    continue
                try:
                    envelope = json.loads(data)
                except json.JSONDecodeError:
                    continue
                event_payload = envelope.get("event")
                if not isinstance(event_payload, dict):
                    continue
                try:
                    event = CollabRealtimeEvent.model_validate(event_payload)
                except Exception:
                    continue
                sender_alias = envelope.get("sender_alias")
                exclude_sender = bool(envelope.get("exclude_sender", False))
                only_alias = envelope.get("only_alias")

                async with self._lock:
                    room_entries = list(self._connections.get(room_key, {}).values())
                for alias, websocket in room_entries:
                    if isinstance(only_alias, str) and only_alias and alias != only_alias:
                        continue
                    if exclude_sender and isinstance(sender_alias, str) and alias == sender_alias:
                        continue
                    await self._send_event(websocket, event)
        except asyncio.CancelledError:
            raise
        except Exception:
            return

    async def _ensure_room_listener(self, room_key: str) -> None:
        if room_key in self._room_listener_tasks:
            return
        pubsub = self._redis.pubsub()
        await pubsub.subscribe(self._channel_key(room_key))
        self._room_pubsubs[room_key] = pubsub
        self._room_listener_tasks[room_key] = asyncio.create_task(
            self._listen_room(room_key, pubsub)
        )

    async def _stop_room_listener(self, room_key: str) -> None:
        task = self._room_listener_tasks.pop(room_key, None)
        pubsub = self._room_pubsubs.pop(room_key, None)
        if pubsub is not None:
            with suppress(Exception):
                await pubsub.unsubscribe(self._channel_key(room_key))
            with suppress(Exception):
                await pubsub.close()
        if task is not None:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
            except Exception:
                pass

    async def connect(self, album_id: str, room_id: str, alias: str, websocket: WebSocket) -> None:
        room_key = self._room_key(album_id, room_id)
        connection_id = id(websocket)
        member_key = f"{self._instance_id}:{connection_id}"

        async with self._lock:
            room_connections = self._connections.setdefault(room_key, {})
            room_connections[connection_id] = (alias, websocket)
            self._presence_members.setdefault(room_key, {})[connection_id] = member_key
            should_start_listener = room_key not in self._room_listener_tasks

        if should_start_listener:
            await self._ensure_room_listener(room_key)

        await self._set_presence_member(room_key, member_key, alias)
        await self._touch_room_keys(room_key)

        snapshot = CollabRealtimeEvent(
            type="snapshot",
            room_id=room_id,
            payload={
                "alias": alias,
                "presence": await self._presence_snapshot(room_key),
                "typing": await self._typing_snapshot(room_key),
                "locks": await self._lock_snapshot(room_key),
            },
        )
        await self._send_event(websocket, snapshot)

        joined = CollabRealtimeEvent(
            type="presence_joined",
            room_id=room_id,
            payload={"alias": alias, "presence": await self._presence_snapshot(room_key)},
        )
        try:
            await self._publish_event(
                room_key,
                joined,
                sender_alias=alias,
                exclude_sender=True,
            )
        except Exception:
            for peer in await self._local_room_websockets(room_key, exclude_alias=alias):
                await self._send_event(peer, joined)

    async def disconnect(self, album_id: str, room_id: str, websocket: WebSocket) -> None:
        room_key = self._room_key(album_id, room_id)
        connection_id = id(websocket)

        async with self._lock:
            room_connections = self._connections.get(room_key, {})
            removed = room_connections.pop(connection_id, None)
            member_key = self._presence_members.get(room_key, {}).pop(connection_id, None)
            should_stop_listener = not room_connections
            if should_stop_listener:
                self._connections.pop(room_key, None)
                self._presence_members.pop(room_key, None)

        if removed is None:
            if should_stop_listener:
                await self._stop_room_listener(room_key)
            return

        alias = removed[0]
        if member_key:
            pipeline = self._redis.pipeline()
            pipeline.srem(self._presence_key(room_key), member_key)
            pipeline.hdel(self._presence_alias_map_key(room_key), member_key)
            await pipeline.execute()
            await self._touch_room_keys(room_key)

        presence = await self._presence_snapshot(room_key)
        alias_still_present = alias in presence
        released_targets: list[str] = []
        if not alias_still_present:
            await self._redis.srem(self._typing_key(room_key), alias)
            released_targets = await self._release_locks_for_alias(room_key, alias)
            await self._touch_room_keys(room_key)

            left_event = CollabRealtimeEvent(
                type="presence_left",
                room_id=room_id,
                payload={"alias": alias, "presence": presence},
            )
            try:
                await self._publish_event(room_key, left_event, sender_alias=alias)
            except Exception:
                for peer in await self._local_room_websockets(room_key):
                    await self._send_event(peer, left_event)

        for target in released_targets:
            released_event = CollabRealtimeEvent(
                type="edit_released",
                room_id=room_id,
                payload={"alias": alias, "target": target},
            )
            try:
                await self._publish_event(room_key, released_event, sender_alias=alias)
            except Exception:
                for peer in await self._local_room_websockets(room_key):
                    await self._send_event(peer, released_event)

        if should_stop_listener:
            await self._stop_room_listener(room_key)

    async def handle_message(
        self,
        album_id: str,
        room_id: str,
        alias: str,
        websocket: WebSocket,
        payload: dict[str, Any],
    ) -> None:
        room_key = self._room_key(album_id, room_id)
        event_type = str(payload.get("type", "")).strip().lower()
        target = payload.get("target")
        target_value = target.strip() if isinstance(target, str) else None

        if event_type == "typing_start":
            if not target_value:
                await self._send_error(room_id, websocket, "typing_start requires target")
                return
            await self._redis.sadd(self._typing_key(room_key), alias)
            await self._touch_room_keys(room_key)
            typing = await self._typing_snapshot(room_key)
            event = CollabRealtimeEvent(
                type="typing",
                room_id=room_id,
                payload={
                    "alias": alias,
                    "target": target_value,
                    "state": "start",
                    "typing": typing,
                },
            )
            try:
                await self._publish_event(
                    room_key,
                    event,
                    sender_alias=alias,
                    exclude_sender=True,
                )
            except Exception:
                for peer in await self._local_room_websockets(room_key, exclude_alias=alias):
                    await self._send_event(peer, event)
            return

        if event_type == "typing_stop":
            await self._redis.srem(self._typing_key(room_key), alias)
            await self._touch_room_keys(room_key)
            typing = await self._typing_snapshot(room_key)
            event = CollabRealtimeEvent(
                type="typing",
                room_id=room_id,
                payload={"alias": alias, "target": target_value, "state": "stop", "typing": typing},
            )
            try:
                await self._publish_event(
                    room_key,
                    event,
                    sender_alias=alias,
                    exclude_sender=True,
                )
            except Exception:
                for peer in await self._local_room_websockets(room_key, exclude_alias=alias):
                    await self._send_event(peer, event)
            return

        if event_type == "claim_edit":
            if not target_value:
                await self._send_error(room_id, websocket, "claim_edit requires target")
                return
            force_claim = bool(payload.get("force", False))
            holder_raw = await self._redis.hget(self._locks_key(room_key), target_value)
            holder = (
                holder_raw.strip() if isinstance(holder_raw, str) and holder_raw.strip() else None
            )
            if holder is None or holder == alias:
                await self._redis.hset(self._locks_key(room_key), target_value, alias)
                await self._touch_room_keys(room_key)
                event = CollabRealtimeEvent(
                    type="edit_claimed",
                    room_id=room_id,
                    payload={"alias": alias, "target": target_value},
                )
                try:
                    await self._publish_event(room_key, event, sender_alias=alias)
                except Exception:
                    for peer in await self._local_room_websockets(room_key):
                        await self._send_event(peer, event)
                return
            if force_claim:
                await self._redis.hset(self._locks_key(room_key), target_value, alias)
                await self._touch_room_keys(room_key)
                event = CollabRealtimeEvent(
                    type="conflict_resolved",
                    room_id=room_id,
                    payload={
                        "alias": alias,
                        "target": target_value,
                        "previous_holder": holder,
                    },
                )
                try:
                    await self._publish_event(room_key, event, sender_alias=alias)
                except Exception:
                    for peer in await self._local_room_websockets(room_key):
                        await self._send_event(peer, event)
                return
            await self._send_event(
                websocket,
                CollabRealtimeEvent(
                    type="edit_conflict",
                    room_id=room_id,
                    payload={
                        "alias": alias,
                        "target": target_value,
                        "holder": holder,
                        "hint": "Use force=true to take over edit lock.",
                    },
                ),
            )
            return

        if event_type == "release_edit":
            if not target_value:
                await self._send_error(room_id, websocket, "release_edit requires target")
                return
            holder_raw = await self._redis.hget(self._locks_key(room_key), target_value)
            holder = (
                holder_raw.strip() if isinstance(holder_raw, str) and holder_raw.strip() else None
            )
            if holder != alias:
                await self._send_event(
                    websocket,
                    CollabRealtimeEvent(
                        type="edit_conflict",
                        room_id=room_id,
                        payload={
                            "alias": alias,
                            "target": target_value,
                            "holder": holder,
                            "hint": "Only the current holder can release this edit lock.",
                        },
                    ),
                )
                return
            await self._redis.hdel(self._locks_key(room_key), target_value)
            await self._touch_room_keys(room_key)
            event = CollabRealtimeEvent(
                type="edit_released",
                room_id=room_id,
                payload={"alias": alias, "target": target_value},
            )
            try:
                await self._publish_event(room_key, event, sender_alias=alias)
            except Exception:
                for peer in await self._local_room_websockets(room_key):
                    await self._send_event(peer, event)
            return

        if event_type == "heartbeat":
            connection_id = id(websocket)
            async with self._lock:
                member_key = self._presence_members.get(room_key, {}).get(connection_id)
            if member_key:
                await self._set_presence_member(room_key, member_key, alias)
            await self._touch_room_keys(room_key)
            await self._send_event(
                websocket,
                CollabRealtimeEvent(type="heartbeat", room_id=room_id, payload={"ok": True}),
            )
            return

        await self._send_error(
            room_id,
            websocket,
            f"Unsupported event type: {event_type or '<missing>'}",
        )


def _get_collab_realtime_hub(app: Any) -> CollabRealtimeHub:
    hub = getattr(app.state, "collab_realtime_hub", None)
    if hub is None:
        settings = getattr(app.state, "settings", None) or get_settings()
        backend = str(getattr(settings, "collab_realtime_backend", "memory")).strip().lower()
        ttl_seconds = int(getattr(settings, "collab_realtime_ttl_seconds", 90))
        strict_production = bool(getattr(settings, "strict_production", False))
        redis_url = getattr(settings, "redis_url", None)

        if backend == "redis":
            if not redis_url:
                if strict_production:
                    raise RuntimeError(
                        "ALBUM_CONCEPTUALIZER_REDIS_URL is required when "
                        "ALBUM_CONCEPTUALIZER_COLLAB_REALTIME_BACKEND=redis"
                    )
                hub = CollabRealtimeHub()
            else:
                try:
                    hub = RedisCollabRealtimeHub(redis_url=redis_url, ttl_seconds=ttl_seconds)
                except Exception as exc:
                    if strict_production:
                        raise RuntimeError(
                            "Failed to initialize Redis collaboration realtime backend"
                        ) from exc
                    hub = CollabRealtimeHub()
        else:
            hub = CollabRealtimeHub()
        app.state.collab_realtime_hub = hub
    return cast("CollabRealtimeHub", hub)
