"""Social experience endpoints: collab rooms and remix battles."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from .experience_realtime import (
    CollabRealtimeEvent,
    _get_collab_realtime_hub,
)
from .experience_shared import (
    _get_album,
    _get_experience_store,
    _get_experience_store_from_app,
    _safe_slug,
)


router = APIRouter()


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

REMIX_BATTLE_REGISTRY_PROFILE_ID = "__remix_battle_registry__"


# -- Models (social-specific) --


class CollabParticipant(BaseModel):
    """Participant present in a collaboration room."""

    alias: str
    role: str = "member"
    joined_at: datetime = Field(default_factory=datetime.utcnow)


class CollabComment(BaseModel):
    """One discussion comment in a collaboration room."""

    alias: str
    message: str
    track_number: int | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class CollabSnapshot(BaseModel):
    """Saved room checkpoint to capture progress notes."""

    alias: str
    summary: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class CollabBoardVote(BaseModel):
    """One board-item vote."""

    alias: str
    value: int = Field(default=1, ge=-1, le=1)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class CollabBoardItem(BaseModel):
    """Prioritized idea card on the shared collaboration board."""

    id: str
    alias: str
    title: str
    detail: str | None = None
    track_number: int | None = None
    status: str = Field(default="idea", pattern="^(idea|active|done)$")
    votes: list[CollabBoardVote] = Field(default_factory=list)
    vote_score: int = 0
    voter_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class CollabRoom(BaseModel):
    """Collaboration room state for live co-writing."""

    id: str
    album_id: str
    name: str
    focus: str | None = None
    visibility: str = "private"
    participants: list[CollabParticipant] = Field(default_factory=list)
    comments: list[CollabComment] = Field(default_factory=list)
    snapshots: list[CollabSnapshot] = Field(default_factory=list)
    board_items: list[CollabBoardItem] = Field(default_factory=list)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class CreateCollabRoomRequest(BaseModel):
    """Payload for creating a collaboration room."""

    name: str = Field(..., min_length=3, max_length=120)
    host_alias: str = Field(..., min_length=2, max_length=80)
    focus: str | None = Field(default=None, max_length=300)
    visibility: str = Field(default="private", pattern="^(private|team|public)$")


class JoinCollabRoomRequest(BaseModel):
    """Payload for joining a collaboration room."""

    alias: str = Field(..., min_length=2, max_length=80)
    role: str = Field(default="member", max_length=40)


class AddCollabCommentRequest(BaseModel):
    """Payload for posting a collaboration room comment."""

    alias: str = Field(..., min_length=2, max_length=80)
    message: str = Field(..., min_length=2, max_length=1000)
    track_number: int | None = Field(default=None, ge=1)


class SaveCollabSnapshotRequest(BaseModel):
    """Payload for persisting a collaboration room checkpoint."""

    alias: str = Field(..., min_length=2, max_length=80)
    summary: str = Field(..., min_length=5, max_length=1000)


class CreateCollabBoardItemRequest(BaseModel):
    """Payload for adding one card to the shared board."""

    alias: str = Field(..., min_length=2, max_length=80)
    title: str = Field(..., min_length=3, max_length=240)
    detail: str | None = Field(default=None, max_length=1000)
    track_number: int | None = Field(default=None, ge=1)
    status: str = Field(default="idea", pattern="^(idea|active|done)$")


class VoteCollabBoardItemRequest(BaseModel):
    """Payload for voting on one shared board card."""

    alias: str = Field(..., min_length=2, max_length=80)
    value: int = Field(default=1, ge=-1, le=1)


class RemixBattleVote(BaseModel):
    """One vote on a remix battle submission."""

    alias: str
    score: int = Field(ge=1, le=5)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class RemixBattleSubmission(BaseModel):
    """One remix battle submission entry."""

    id: str
    alias: str
    title: str
    concept: str
    preview_hook: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    votes: list[RemixBattleVote] = Field(default_factory=list)
    average_score: float = Field(default=0.0, ge=0.0, le=5.0)
    vote_count: int = Field(default=0, ge=0)


class RemixBattle(BaseModel):
    """Remix battle room with submissions and public sharing."""

    id: str
    album_id: str
    title: str
    prompt: str
    status: str = Field(default="open", pattern="^(open|closed)$")
    created_by: str
    share_slug: str
    submissions: list[RemixBattleSubmission] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class CreateRemixBattleRequest(BaseModel):
    """Payload for creating a remix battle."""

    alias: str = Field(..., min_length=2, max_length=80)
    title: str = Field(..., min_length=3, max_length=140)
    prompt: str = Field(..., min_length=8, max_length=500)


class SubmitRemixBattleSubmissionRequest(BaseModel):
    """Payload for submitting a remix concept entry."""

    alias: str = Field(..., min_length=2, max_length=80)
    title: str = Field(..., min_length=3, max_length=140)
    concept: str = Field(..., min_length=8, max_length=1200)
    preview_hook: str | None = Field(default=None, max_length=240)


class VoteRemixBattleSubmissionRequest(BaseModel):
    """Payload for voting on a remix battle submission."""

    alias: str = Field(..., min_length=2, max_length=80)
    score: int = Field(..., ge=1, le=5)


class RemixBattlePublicPage(BaseModel):
    """Public remix battle page payload."""

    share_slug: str
    battle_id: str
    album_id: str
    title: str
    prompt: str
    status: str
    submissions: list[RemixBattleSubmission]
    leaderboard_summary: list[str]


class CloseRemixBattleRequest(BaseModel):
    """Payload for closing a remix battle."""

    alias: str = Field(..., min_length=2, max_length=80)


# ---------------------------------------------------------------------------
# Social-only helpers
# ---------------------------------------------------------------------------


def _save_room(request: Request, room: CollabRoom) -> None:
    _get_experience_store(request).save_room(
        room.album_id,
        room.id,
        room.model_dump(mode="json"),
    )


def _list_room_models(request: Request, album_id: str) -> list[CollabRoom]:
    payloads = _get_experience_store(request).list_rooms(album_id)
    rooms: list[CollabRoom] = []
    for payload in payloads:
        try:
            rooms.append(CollabRoom.model_validate(payload))
        except Exception:
            continue
    return rooms


def _get_room(request: Request, album_id: str, room_id: str) -> CollabRoom:
    payload = _get_experience_store(request).get_room(album_id, room_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Collaboration room not found")
    try:
        return CollabRoom.model_validate(payload)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Corrupt collaboration room state") from exc


def _ensure_participant(room: CollabRoom, alias: str, role: str = "guest") -> None:
    if any(participant.alias.lower() == alias.lower() for participant in room.participants):
        return
    room.participants.append(CollabParticipant(alias=alias, role=role))


def _find_board_item(room: CollabRoom, item_id: str) -> CollabBoardItem:
    for item in room.board_items:
        if item.id == item_id:
            return item
    raise HTTPException(status_code=404, detail="Board item not found")


def _refresh_board_item_votes(item: CollabBoardItem) -> None:
    item.vote_score = sum(vote.value for vote in item.votes)
    item.voter_count = len(item.votes)
    item.updated_at = datetime.utcnow()


def _load_remix_registry(request: Request) -> dict[str, dict[str, Any]]:
    payload = _get_experience_store(request).get_profile(REMIX_BATTLE_REGISTRY_PROFILE_ID) or {}
    battles_payload = payload.get("battles") if isinstance(payload, dict) else None
    if not isinstance(battles_payload, dict):
        return {}
    normalized: dict[str, dict[str, Any]] = {}
    for battle_id, battle_payload in battles_payload.items():
        if isinstance(battle_id, str) and isinstance(battle_payload, dict):
            normalized[battle_id] = dict(battle_payload)
    return normalized


def _save_remix_registry(request: Request, registry: dict[str, dict[str, Any]]) -> None:
    _get_experience_store(request).save_profile(
        REMIX_BATTLE_REGISTRY_PROFILE_ID,
        {"battles": registry},
    )


def _refresh_remix_submission(submission: RemixBattleSubmission) -> None:
    submission.vote_count = len(submission.votes)
    if not submission.votes:
        submission.average_score = 0.0
        return
    submission.average_score = round(
        sum(vote.score for vote in submission.votes) / len(submission.votes),
        2,
    )


def _sort_remix_submissions(
    submissions: list[RemixBattleSubmission],
) -> list[RemixBattleSubmission]:
    return sorted(
        submissions,
        key=lambda item: (
            item.average_score,
            item.vote_count,
            item.created_at,
        ),
        reverse=True,
    )


def _load_remix_battle(request: Request, album_id: str, battle_id: str) -> RemixBattle:
    registry = _load_remix_registry(request)
    payload = registry.get(battle_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Remix battle not found")
    try:
        battle = RemixBattle.model_validate(payload)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Corrupt remix battle state") from exc
    if battle.album_id != album_id:
        raise HTTPException(status_code=404, detail="Remix battle not found")
    return battle


def _save_remix_battle(request: Request, battle: RemixBattle) -> None:
    registry = _load_remix_registry(request)
    registry[battle.id] = battle.model_dump(mode="json")
    _save_remix_registry(request, registry)


def _list_remix_battles(request: Request, album_id: str) -> list[RemixBattle]:
    registry = _load_remix_registry(request)
    battles: list[RemixBattle] = []
    for payload in registry.values():
        try:
            battle = RemixBattle.model_validate(payload)
        except Exception:
            continue
        if battle.album_id == album_id:
            battles.append(battle)
    return sorted(battles, key=lambda item: item.updated_at, reverse=True)


def _remix_leaderboard_summary(battle: RemixBattle) -> list[str]:
    ranked = _sort_remix_submissions(battle.submissions)
    summary: list[str] = []
    for index, submission in enumerate(ranked[:3], start=1):
        summary.append(
            f"#{index} {submission.title} by {submission.alias} "
            f"({submission.average_score:.2f}/5 from {submission.vote_count} votes)"
        )
    return summary


# ---------------------------------------------------------------------------
# Endpoints — Collab Rooms
# ---------------------------------------------------------------------------


@router.post("/albums/{album_id}/experience/collab-rooms", response_model=CollabRoom)
async def create_collab_room(
    request: Request,
    album_id: str,
    data: CreateCollabRoomRequest,
) -> CollabRoom:
    """Create a new collaboration room tied to an album."""
    _get_album(request, album_id)
    room_id = f"room_{uuid4().hex[:12]}"
    room = CollabRoom(
        id=room_id,
        album_id=album_id,
        name=data.name.strip(),
        focus=data.focus.strip() if data.focus else None,
        visibility=data.visibility,
        participants=[CollabParticipant(alias=data.host_alias.strip(), role="host")],
    )
    _save_room(request, room)
    return room


@router.get("/albums/{album_id}/experience/collab-rooms", response_model=list[CollabRoom])
async def list_collab_rooms(request: Request, album_id: str) -> list[CollabRoom]:
    """List collaboration rooms for one album."""
    _get_album(request, album_id)
    rooms = _list_room_models(request, album_id)
    return sorted(rooms, key=lambda room: room.updated_at, reverse=True)


@router.get("/albums/{album_id}/experience/collab-rooms/{room_id}", response_model=CollabRoom)
async def get_collab_room(request: Request, album_id: str, room_id: str) -> CollabRoom:
    """Get one collaboration room state."""
    _get_album(request, album_id)
    return _get_room(request, album_id, room_id)


@router.websocket("/albums/{album_id}/experience/collab-rooms/{room_id}/ws")
async def collab_room_realtime_ws(
    websocket: WebSocket,
    album_id: str,
    room_id: str,
    alias: str = Query(..., min_length=2, max_length=80),
) -> None:
    """Websocket stream for live presence, typing, and edit-lock conflict resolution."""
    album_store = getattr(websocket.app.state, "album_store", None)
    if album_store is None or not album_store.get(album_id):
        await websocket.close(code=4404, reason="Album not found")
        return

    store = _get_experience_store_from_app(websocket.app)
    room_payload = store.get_room(album_id, room_id)
    if room_payload is None:
        await websocket.close(code=4404, reason="Collaboration room not found")
        return

    try:
        room = CollabRoom.model_validate(room_payload)
    except Exception:
        await websocket.close(code=1011, reason="Corrupt collaboration room state")
        return

    cleaned_alias = alias.strip()
    _ensure_participant(room, cleaned_alias, role="guest")
    room.updated_at = datetime.utcnow()
    store.save_room(album_id, room_id, room.model_dump(mode="json"))

    await websocket.accept()
    hub = _get_collab_realtime_hub(websocket.app)
    await hub.connect(album_id, room_id, cleaned_alias, websocket)
    try:
        while True:
            incoming = await websocket.receive_json()
            if not isinstance(incoming, dict):
                await websocket.send_json(
                    CollabRealtimeEvent(
                        type="error",
                        room_id=room_id,
                        payload={"message": "Incoming websocket payload must be a JSON object."},
                    ).model_dump(mode="json")
                )
                continue
            await hub.handle_message(album_id, room_id, cleaned_alias, websocket, incoming)
    except WebSocketDisconnect:
        pass
    finally:
        await hub.disconnect(album_id, room_id, websocket)


@router.post("/albums/{album_id}/experience/collab-rooms/{room_id}/join", response_model=CollabRoom)
async def join_collab_room(
    request: Request,
    album_id: str,
    room_id: str,
    data: JoinCollabRoomRequest,
) -> CollabRoom:
    """Join a collaboration room."""
    _get_album(request, album_id)
    room = _get_room(request, album_id, room_id)
    alias = data.alias.strip()
    _ensure_participant(room, alias, role=data.role.strip() or "member")
    room.updated_at = datetime.utcnow()
    _save_room(request, room)
    return room


@router.post(
    "/albums/{album_id}/experience/collab-rooms/{room_id}/comments",
    response_model=CollabRoom,
)
async def add_collab_comment(
    request: Request,
    album_id: str,
    room_id: str,
    data: AddCollabCommentRequest,
) -> CollabRoom:
    """Post a collaboration room comment."""
    _get_album(request, album_id)
    room = _get_room(request, album_id, room_id)
    alias = data.alias.strip()
    _ensure_participant(room, alias, role="guest")
    room.comments.append(
        CollabComment(
            alias=alias,
            message=data.message.strip(),
            track_number=data.track_number,
        )
    )
    room.updated_at = datetime.utcnow()
    _save_room(request, room)
    return room


@router.post(
    "/albums/{album_id}/experience/collab-rooms/{room_id}/snapshots",
    response_model=CollabRoom,
)
async def save_collab_snapshot(
    request: Request,
    album_id: str,
    room_id: str,
    data: SaveCollabSnapshotRequest,
) -> CollabRoom:
    """Save a progress checkpoint in a collaboration room."""
    _get_album(request, album_id)
    room = _get_room(request, album_id, room_id)
    room.snapshots.append(
        CollabSnapshot(
            alias=data.alias.strip(),
            summary=data.summary.strip(),
        )
    )
    room.updated_at = datetime.utcnow()
    _save_room(request, room)
    return room


@router.post(
    "/albums/{album_id}/experience/collab-rooms/{room_id}/board-items",
    response_model=CollabRoom,
)
async def add_collab_board_item(
    request: Request,
    album_id: str,
    room_id: str,
    data: CreateCollabBoardItemRequest,
) -> CollabRoom:
    """Add one prioritized item to the shared collaboration board."""
    _get_album(request, album_id)
    room = _get_room(request, album_id, room_id)
    alias = data.alias.strip()
    _ensure_participant(room, alias, role="guest")
    item = CollabBoardItem(
        id=f"board_{uuid4().hex[:10]}",
        alias=alias,
        title=data.title.strip(),
        detail=data.detail.strip() if data.detail else None,
        track_number=data.track_number,
        status=data.status,
    )
    room.board_items.append(item)
    room.board_items.sort(
        key=lambda board_item: (board_item.vote_score, board_item.created_at), reverse=True
    )
    room.updated_at = datetime.utcnow()
    _save_room(request, room)
    return room


@router.post(
    "/albums/{album_id}/experience/collab-rooms/{room_id}/board-items/{item_id}/vote",
    response_model=CollabRoom,
)
async def vote_collab_board_item(
    request: Request,
    album_id: str,
    room_id: str,
    item_id: str,
    data: VoteCollabBoardItemRequest,
) -> CollabRoom:
    """Upvote or downvote a shared board item."""
    _get_album(request, album_id)
    room = _get_room(request, album_id, room_id)
    alias = data.alias.strip()
    _ensure_participant(room, alias, role="guest")
    item = _find_board_item(room, item_id)

    prior_vote_index = next(
        (
            index
            for index, existing_vote in enumerate(item.votes)
            if existing_vote.alias.lower() == alias.lower()
        ),
        None,
    )
    new_vote = CollabBoardVote(alias=alias, value=data.value)
    if prior_vote_index is None:
        item.votes.append(new_vote)
    else:
        item.votes[prior_vote_index] = new_vote

    _refresh_board_item_votes(item)
    room.board_items.sort(
        key=lambda board_item: (board_item.vote_score, board_item.created_at), reverse=True
    )
    room.updated_at = datetime.utcnow()
    _save_room(request, room)
    return room


# ---------------------------------------------------------------------------
# Endpoints — Remix Battles
# ---------------------------------------------------------------------------


@router.post("/albums/{album_id}/experience/remix-battles", response_model=RemixBattle)
async def create_remix_battle(
    request: Request,
    album_id: str,
    data: CreateRemixBattleRequest,
) -> RemixBattle:
    """Create a remix battle and issue a public share slug."""
    _get_album(request, album_id)
    battle = RemixBattle(
        id=f"battle_{uuid4().hex[:12]}",
        album_id=album_id,
        title=data.title.strip(),
        prompt=data.prompt.strip(),
        created_by=data.alias.strip(),
        share_slug=f"{_safe_slug(data.title)}-{uuid4().hex[:6]}",
    )
    _save_remix_battle(request, battle)
    return battle


@router.get("/albums/{album_id}/experience/remix-battles", response_model=list[RemixBattle])
async def list_remix_battles(request: Request, album_id: str) -> list[RemixBattle]:
    """List remix battles for one album."""
    _get_album(request, album_id)
    return _list_remix_battles(request, album_id)


@router.get("/albums/{album_id}/experience/remix-battles/{battle_id}", response_model=RemixBattle)
async def get_remix_battle(
    request: Request,
    album_id: str,
    battle_id: str,
) -> RemixBattle:
    """Get one remix battle state."""
    _get_album(request, album_id)
    return _load_remix_battle(request, album_id, battle_id)


@router.post(
    "/albums/{album_id}/experience/remix-battles/{battle_id}/submissions",
    response_model=RemixBattle,
)
async def submit_remix_battle_entry(
    request: Request,
    album_id: str,
    battle_id: str,
    data: SubmitRemixBattleSubmissionRequest,
) -> RemixBattle:
    """Submit an entry to an active remix battle."""
    _get_album(request, album_id)
    battle = _load_remix_battle(request, album_id, battle_id)
    if battle.status != "open":
        raise HTTPException(status_code=409, detail="Remix battle is closed")

    alias = data.alias.strip()
    existing = next(
        (item for item in battle.submissions if item.alias.lower() == alias.lower()), None
    )
    if existing:
        existing.title = data.title.strip()
        existing.concept = data.concept.strip()
        existing.preview_hook = data.preview_hook.strip() if data.preview_hook else None
        existing.created_at = datetime.utcnow()
    else:
        battle.submissions.append(
            RemixBattleSubmission(
                id=f"entry_{uuid4().hex[:10]}",
                alias=alias,
                title=data.title.strip(),
                concept=data.concept.strip(),
                preview_hook=data.preview_hook.strip() if data.preview_hook else None,
            )
        )
    for submission in battle.submissions:
        _refresh_remix_submission(submission)
    battle.submissions = _sort_remix_submissions(battle.submissions)
    battle.updated_at = datetime.utcnow()
    _save_remix_battle(request, battle)
    return battle


@router.post(
    "/albums/{album_id}/experience/remix-battles/{battle_id}/submissions/{submission_id}/vote",
    response_model=RemixBattle,
)
async def vote_remix_battle_submission(
    request: Request,
    album_id: str,
    battle_id: str,
    submission_id: str,
    data: VoteRemixBattleSubmissionRequest,
) -> RemixBattle:
    """Vote on a remix battle submission."""
    _get_album(request, album_id)
    battle = _load_remix_battle(request, album_id, battle_id)
    if battle.status != "open":
        raise HTTPException(status_code=409, detail="Remix battle is closed")

    submission = next((item for item in battle.submissions if item.id == submission_id), None)
    if submission is None:
        raise HTTPException(status_code=404, detail="Remix submission not found")

    alias = data.alias.strip()
    vote = RemixBattleVote(alias=alias, score=data.score)
    prior_vote_index = next(
        (
            index
            for index, existing_vote in enumerate(submission.votes)
            if existing_vote.alias.lower() == alias.lower()
        ),
        None,
    )
    if prior_vote_index is None:
        submission.votes.append(vote)
    else:
        submission.votes[prior_vote_index] = vote
    _refresh_remix_submission(submission)
    battle.submissions = _sort_remix_submissions(battle.submissions)
    battle.updated_at = datetime.utcnow()
    _save_remix_battle(request, battle)
    return battle


@router.post(
    "/albums/{album_id}/experience/remix-battles/{battle_id}/close",
    response_model=RemixBattle,
)
async def close_remix_battle(
    request: Request,
    album_id: str,
    battle_id: str,
    data: CloseRemixBattleRequest,
) -> RemixBattle:
    """Close a remix battle to freeze rankings and voting."""
    _get_album(request, album_id)
    battle = _load_remix_battle(request, album_id, battle_id)
    if battle.status == "closed":
        return battle
    if data.alias.strip().lower() != battle.created_by.lower():
        raise HTTPException(status_code=403, detail="Only the battle creator can close this battle")
    battle.status = "closed"
    battle.updated_at = datetime.utcnow()
    _save_remix_battle(request, battle)
    return battle


@router.get("/experience/remix-battles/share/{share_slug}", response_model=RemixBattlePublicPage)
async def get_public_remix_battle_page(
    request: Request,
    share_slug: str,
) -> RemixBattlePublicPage:
    """Return a shareable public page payload for a remix battle."""
    registry = _load_remix_registry(request)
    battle: RemixBattle | None = None
    for payload in registry.values():
        try:
            candidate = RemixBattle.model_validate(payload)
        except Exception:
            continue
        if candidate.share_slug == share_slug:
            battle = candidate
            break
    if battle is None:
        raise HTTPException(status_code=404, detail="Shared remix battle page not found")

    battle.submissions = _sort_remix_submissions(battle.submissions)
    return RemixBattlePublicPage(
        share_slug=battle.share_slug,
        battle_id=battle.id,
        album_id=battle.album_id,
        title=battle.title,
        prompt=battle.prompt,
        status=battle.status,
        submissions=battle.submissions,
        leaderboard_summary=_remix_leaderboard_summary(battle),
    )
