"""Shared utilities, models, and constants for experience sub-routers."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, cast

from fastapi import HTTPException, Request
from pydantic import BaseModel, Field

from album_conceptualizer.api.deps import hash_api_key
from album_conceptualizer.experience_state import ExperienceStateStore, InMemoryExperienceStateStore
from album_conceptualizer.models.album import Album, Song
from album_conceptualizer.models.album_bible import AlbumBible
from album_conceptualizer.storage import BibleStore

from .albums import get_album_store


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFAULT_PROGRESSIONS: dict[str, list[str]] = {
    "C": ["C", "G", "Am", "F"],
    "D": ["D", "A", "Bm", "G"],
    "E": ["E", "B", "C#m", "A"],
    "F": ["F", "C", "Dm", "Bb"],
    "G": ["G", "D", "Em", "C"],
    "A": ["A", "E", "F#m", "D"],
    "B": ["B", "F#", "G#m", "E"],
    "Bb": ["Bb", "F", "Gm", "Eb"],
    "Eb": ["Eb", "Bb", "Cm", "Ab"],
}


# ---------------------------------------------------------------------------
# Shared Pydantic models
# ---------------------------------------------------------------------------


class PromptPack(BaseModel):
    """Creative challenge pack for jam sessions."""

    id: str
    name: str
    vibe: str
    difficulty: str
    description: str
    constraints: list[str]
    bonus_objectives: list[str] = Field(default_factory=list)


class ReferenceTrackInput(BaseModel):
    """Reference track metadata for style capture."""

    title: str = Field(..., min_length=1, max_length=200)
    artist: str | None = None
    key: str | None = None
    tempo: int | None = Field(default=None, ge=20, le=320)
    chord_progression: list[str] = Field(default_factory=list)
    mood_tags: list[str] = Field(default_factory=list)
    production_tags: list[str] = Field(default_factory=list)


class ChallengeHistoryEntry(BaseModel):
    """One historical challenge completion entry."""

    challenge_id: str
    completed_on: date
    points_earned: int = Field(ge=1)
    completed_tracks: int = Field(ge=0, le=100)
    minutes_spent: int = Field(ge=1, le=600)
    quality_rating: int = Field(ge=1, le=5)


class CreatorMemoryEvent(BaseModel):
    """One creator-memory event."""

    event_type: str
    label: str
    album_id: str | None = None
    metadata: dict[str, str] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ChallengeProfile(BaseModel):
    """Internal challenge profile keyed by API key hash."""

    profile_id: str
    display_name: str | None = None
    streak_days: int = 0
    total_points: int = 0
    badges: list[str] = Field(default_factory=list)
    recent_challenges: list[str] = Field(default_factory=list)
    challenge_history: list[ChallengeHistoryEntry] = Field(default_factory=list)
    last_completed_on: date | None = None
    preferred_genres: list[str] = Field(default_factory=list)
    preferred_themes: list[str] = Field(default_factory=list)
    preferred_moods: list[str] = Field(default_factory=list)
    workflow_preferences: list[str] = Field(default_factory=list)
    goals: list[str] = Field(default_factory=list)
    recent_memory_events: list[CreatorMemoryEvent] = Field(default_factory=list)


class CreatorMemoryProfileResponse(BaseModel):
    """Creator memory profile payload."""

    profile_id: str
    display_name: str
    preferred_genres: list[str]
    preferred_themes: list[str]
    preferred_moods: list[str]
    workflow_preferences: list[str]
    goals: list[str]
    recent_memory_events: list[CreatorMemoryEvent]
    memory_strength: int = Field(ge=0, le=100)
    personalized_prompt: str


# ---------------------------------------------------------------------------
# Shared helper functions
# ---------------------------------------------------------------------------


def _extract_root(chord_symbol: str) -> str | None:
    chord = chord_symbol.strip()
    if not chord:
        return None
    if len(chord) > 1 and chord[1] in {"#", "b"}:
        return f"{chord[0].upper()}{chord[1]}"
    return chord[0].upper()


def _get_album(request: Request, album_id: str) -> Album:
    album = get_album_store(request).get(album_id)
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    return album


def _get_bible(request: Request, album_id: str) -> AlbumBible | None:
    bible_store = cast("BibleStore", request.app.state.bible_store)
    return bible_store.get(album_id)


def _seed_progression(song: Song) -> list[str]:
    for section in song.sections:
        if section.chord_progression:
            return section.chord_progression[:4]

    root = None
    if song.key:
        key_token = song.key.split()[0]
        root = _extract_root(key_token)

    if root and root in DEFAULT_PROGRESSIONS:
        return DEFAULT_PROGRESSIONS[root]
    return DEFAULT_PROGRESSIONS["C"]


def _extract_token_from_request(request: Request) -> str | None:
    token = request.headers.get("x-api-key")
    if token:
        return token
    authorization = request.headers.get("authorization")
    if not authorization:
        return None
    parts = authorization.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None


def _get_experience_store_from_app(app: Any) -> ExperienceStateStore:
    store = getattr(app.state, "experience_store", None)
    if store is None:
        store = InMemoryExperienceStateStore()
        app.state.experience_store = store
    return cast("ExperienceStateStore", store)


def _get_experience_store(request: Request) -> ExperienceStateStore:
    return _get_experience_store_from_app(request.app)


def _load_challenge_profile(request: Request, profile_id: str) -> ChallengeProfile:
    payload = _get_experience_store(request).get_profile(profile_id)
    if payload is None:
        return ChallengeProfile(profile_id=profile_id)
    try:
        return ChallengeProfile.model_validate(payload)
    except Exception:
        return ChallengeProfile(profile_id=profile_id)


def _save_challenge_profile(request: Request, profile: ChallengeProfile) -> None:
    _get_experience_store(request).save_profile(
        profile.profile_id,
        profile.model_dump(mode="json"),
    )


def _profile_id_for_request(request: Request) -> str:
    token = _extract_token_from_request(request)
    if token:
        return hash_api_key(token)
    return "anonymous"


def _safe_slug(value: str) -> str:
    normalized = value.strip().lower()
    cleaned = "".join(char if char.isalnum() else "_" for char in normalized)
    compact = "_".join(part for part in cleaned.split("_") if part)
    return compact or "untitled"


def _dedupe_tokens(tokens: list[str], *, limit: int) -> list[str]:
    seen: set[str] = set()
    cleaned: list[str] = []
    for token in tokens:
        normalized = token.strip().lower()
        if not normalized or normalized in seen:
            continue
        cleaned.append(normalized)
        seen.add(normalized)
        if len(cleaned) >= limit:
            break
    return cleaned


def _profile_display_name(profile: ChallengeProfile) -> str:
    if profile.display_name:
        return profile.display_name
    if profile.profile_id == "anonymous":
        return "anonymous"
    return f"creator-{profile.profile_id[:8]}"


def _build_creator_memory_prompt(profile: ChallengeProfile) -> str:
    genres = ", ".join(profile.preferred_genres[:3]) or "alt-pop"
    themes = ", ".join(profile.preferred_themes[:4]) or "identity, motion, memory"
    moods = ", ".join(profile.preferred_moods[:3]) or "cinematic, intimate, energetic"
    workflow = ", ".join(profile.workflow_preferences[:3]) or "tight writing sprints"
    goals = ", ".join(profile.goals[:2]) or "ship cohesive album drafts weekly"
    return (
        f"Create sessions for {_profile_display_name(profile)} with genre focus {genres}, themes {themes}, "
        f"moods {moods}, workflow {workflow}. Primary goals: {goals}."
    )


def _memory_strength(profile: ChallengeProfile) -> int:
    points = 0
    if profile.preferred_genres:
        points += 20
    if profile.preferred_themes:
        points += 20
    if profile.preferred_moods:
        points += 15
    if profile.workflow_preferences:
        points += 15
    if profile.goals:
        points += 15
    if profile.recent_memory_events:
        points += 15
    return min(points, 100)


def _creator_memory_response(profile: ChallengeProfile) -> CreatorMemoryProfileResponse:
    return CreatorMemoryProfileResponse(
        profile_id=profile.profile_id,
        display_name=_profile_display_name(profile),
        preferred_genres=profile.preferred_genres,
        preferred_themes=profile.preferred_themes,
        preferred_moods=profile.preferred_moods,
        workflow_preferences=profile.workflow_preferences,
        goals=profile.goals,
        recent_memory_events=profile.recent_memory_events[:12],
        memory_strength=_memory_strength(profile),
        personalized_prompt=_build_creator_memory_prompt(profile),
    )
