"""Gamification experience endpoints: challenges and creator memory."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from .experience_shared import (
    ChallengeProfile,
    CreatorMemoryEvent,
    CreatorMemoryProfileResponse,
    _creator_memory_response,
    _dedupe_tokens,
    _get_album,
    _get_experience_store,
    _load_challenge_profile,
    _profile_display_name,
    _profile_id_for_request,
    _save_challenge_profile,
)


router = APIRouter()


# -- Models (gamification-specific) --


class ChallengeDefinition(BaseModel):
    """Creative challenge definition for gamified writing sessions."""

    id: str
    title: str
    difficulty: str
    description: str
    objective: str
    points: int = Field(ge=10, le=500)
    bonus: str | None = None


CREATIVE_CHALLENGES: list[ChallengeDefinition] = [
    ChallengeDefinition(
        id="hook-marathon",
        title="Hook Marathon",
        difficulty="beginner",
        description="Write concise hooks for multiple tracks in one sprint.",
        objective="Ship at least 3 chorus hook candidates across your album.",
        points=80,
        bonus="Add one contrasting melodic contour per hook.",
    ),
    ChallengeDefinition(
        id="story-pivot",
        title="Story Pivot",
        difficulty="intermediate",
        description="Strengthen narrative contrast between adjacent tracks.",
        objective="Rewrite two narrative summaries to increase conflict and payoff.",
        points=120,
        bonus="Introduce one callback lyric in both tracks.",
    ),
    ChallengeDefinition(
        id="motif-lab",
        title="Motif Lab",
        difficulty="advanced",
        description="Transform a motif through different harmonic contexts.",
        objective="Reuse one motif in three tracks with distinct chord environments.",
        points=160,
        bonus="Map each motif appearance in the timeline board.",
    ),
    ChallengeDefinition(
        id="arrangement-speedrun",
        title="Arrangement Speedrun",
        difficulty="intermediate",
        description="Draft quick section maps for unfinished songs.",
        objective="Bring two songs from 0 to 2+ sections in one session.",
        points=110,
        bonus="Add a dynamic contrast note for each section.",
    ),
]


class WeeklyChallengeResponse(BaseModel):
    """Current weekly challenge payload."""

    week_id: str
    challenge: ChallengeDefinition
    tip: str


class ChallengeRunCard(BaseModel):
    """Track-specific challenge card."""

    track_number: int
    song_title: str
    target: str
    bonus: str | None = None


class ChallengeRunResponse(BaseModel):
    """Guided challenge run plan for selected tracks."""

    challenge: ChallengeDefinition
    cards: list[ChallengeRunCard]
    motivational_prompt: str


class CompleteChallengeRequest(BaseModel):
    """Challenge completion payload."""

    completed_tracks: list[int] = Field(default_factory=list)
    minutes_spent: int = Field(default=30, ge=1, le=600)
    quality_rating: int = Field(default=3, ge=1, le=5)
    notes: str | None = Field(default=None, max_length=500)


class ChallengeScorecard(BaseModel):
    """Gamified challenge scorecard and streak state."""

    profile_id: str
    streak_days: int
    total_points: int
    level: str
    badges: list[str]
    recent_challenges: list[str]
    last_completed_on: date | None


class ChallengeLeaderboardEntry(BaseModel):
    """Ranked challenge leaderboard row."""

    rank: int = Field(ge=1)
    profile_id: str
    display_name: str
    points: int = Field(ge=0)
    level: str
    streak_days: int = Field(ge=0)
    badges: list[str]
    last_completed_on: date | None


class ChallengeLeaderboardResponse(BaseModel):
    """Challenge leaderboard payload."""

    scope: str
    generated_on: date
    entries: list[ChallengeLeaderboardEntry]


class UpdateCreatorMemoryRequest(BaseModel):
    """Payload for updating creator memory preferences."""

    display_name: str | None = Field(default=None, min_length=2, max_length=80)
    preferred_genres: list[str] = Field(default_factory=list, max_length=12)
    preferred_themes: list[str] = Field(default_factory=list, max_length=20)
    preferred_moods: list[str] = Field(default_factory=list, max_length=20)
    workflow_preferences: list[str] = Field(default_factory=list, max_length=20)
    goals: list[str] = Field(default_factory=list, max_length=20)


class LogCreatorMemoryEventRequest(BaseModel):
    """Payload for logging creator-memory events."""

    event_type: str = Field(..., min_length=2, max_length=80)
    label: str = Field(..., min_length=2, max_length=160)
    album_id: str | None = None
    metadata: dict[str, str] = Field(default_factory=dict)


class CreatorMemoryRecommendationsResponse(BaseModel):
    """Recommendations generated from creator memory and album state."""

    profile_id: str
    album_id: str
    recommendations: list[str]
    jam_focus: str
    release_angle: str


# ---------------------------------------------------------------------------
# Gamification-only helpers
# ---------------------------------------------------------------------------


def _challenge_level(points: int) -> str:
    if points >= 1500:
        return "headliner"
    if points >= 700:
        return "touring"
    if points >= 250:
        return "opening-act"
    return "demo"


def _pick_challenge(challenge_id: str) -> ChallengeDefinition:
    for challenge in CREATIVE_CHALLENGES:
        if challenge.id == challenge_id:
            return challenge
    raise HTTPException(status_code=404, detail="Challenge not found")


def _week_id(offset_weeks: int = 0) -> str:
    target = date.today() + timedelta(days=offset_weeks * 7)
    iso = target.isocalendar()
    return f"{iso.year}-W{iso.week:02d}"


def _weekly_challenge(offset_weeks: int = 0) -> ChallengeDefinition:
    target = date.today() + timedelta(days=offset_weeks * 7)
    iso_week = target.isocalendar().week
    index = (iso_week - 1) % len(CREATIVE_CHALLENGES)
    return CREATIVE_CHALLENGES[index]


# ---------------------------------------------------------------------------
# Endpoints — Challenges
# ---------------------------------------------------------------------------


@router.get("/experience/challenges", response_model=list[ChallengeDefinition])
async def list_challenges(
    difficulty: str | None = Query(None, description="Optional difficulty filter"),
) -> list[ChallengeDefinition]:
    """List challenge mode definitions."""
    if not difficulty:
        return CREATIVE_CHALLENGES
    lowered = difficulty.strip().lower()
    return [challenge for challenge in CREATIVE_CHALLENGES if challenge.difficulty == lowered]


@router.get("/experience/challenges/weekly", response_model=WeeklyChallengeResponse)
async def get_weekly_challenge(
    week_offset: int = Query(0, ge=-12, le=12, description="Week offset from current week"),
) -> WeeklyChallengeResponse:
    """Return a deterministic weekly challenge to drive user streaks."""
    challenge = _weekly_challenge(week_offset)
    tips = {
        "hook-marathon": "Time-box each hook draft to 8 minutes to avoid over-editing.",
        "story-pivot": "Use one concrete object to bridge both summaries.",
        "motif-lab": "Change register or rhythm each time the motif appears.",
        "arrangement-speedrun": "Start with section labels before writing any lyrics.",
    }
    return WeeklyChallengeResponse(
        week_id=_week_id(week_offset),
        challenge=challenge,
        tip=tips.get(challenge.id, "Keep momentum high and ship one imperfect draft."),
    )


@router.post(
    "/albums/{album_id}/experience/challenges/{challenge_id}/run",
    response_model=ChallengeRunResponse,
)
async def run_challenge_plan(
    request: Request,
    album_id: str,
    challenge_id: str,
    track_numbers: Annotated[list[int] | None, Query()] = None,
) -> ChallengeRunResponse:
    """Build actionable challenge cards for selected album tracks."""
    album = _get_album(request, album_id)
    challenge = _pick_challenge(challenge_id)
    songs = sorted(album.songs, key=lambda song: song.track_number)
    if track_numbers:
        selected_tracks = set(track_numbers)
        songs = [song for song in songs if song.track_number in selected_tracks]
    if not songs:
        raise HTTPException(status_code=400, detail="No tracks available for challenge run")

    cards: list[ChallengeRunCard] = []
    for song in songs:
        task_target = challenge.objective
        if challenge.id == "hook-marathon":
            task_target = f"Write three hook variants for '{song.title}'."
        elif challenge.id == "story-pivot":
            task_target = f"Upgrade narrative conflict in '{song.title}' summary."
        elif challenge.id == "motif-lab":
            task_target = f"Rework one motif in a fresh harmonic frame for '{song.title}'."
        elif challenge.id == "arrangement-speedrun":
            task_target = f"Draft at least two sections for '{song.title}'."
        cards.append(
            ChallengeRunCard(
                track_number=song.track_number,
                song_title=song.title,
                target=task_target,
                bonus=challenge.bonus,
            )
        )

    prompt = f"Challenge '{challenge.title}': stay focused, ship drafts fast, and prioritize progress over polish."
    return ChallengeRunResponse(challenge=challenge, cards=cards, motivational_prompt=prompt)


@router.post(
    "/experience/challenges/{challenge_id}/complete",
    response_model=ChallengeScorecard,
)
async def complete_challenge(
    request: Request,
    challenge_id: str,
    data: CompleteChallengeRequest,
) -> ChallengeScorecard:
    """Record challenge completion and return updated streak/points scorecard."""
    challenge = _pick_challenge(challenge_id)
    profile_id = _profile_id_for_request(request)
    profile = _load_challenge_profile(request, profile_id)

    today = date.today()
    if profile.last_completed_on is None:
        profile.streak_days = 1
    elif profile.last_completed_on == today:
        profile.streak_days = max(profile.streak_days, 1)
    elif profile.last_completed_on == today - timedelta(days=1):
        profile.streak_days += 1
    else:
        profile.streak_days = 1

    base_points = challenge.points
    track_points = min(len(data.completed_tracks), 6) * 10
    effort_points = min(data.minutes_spent, 180) // 10
    quality_points = data.quality_rating * 8
    earned_points = base_points + track_points + effort_points + quality_points
    profile.total_points += earned_points
    profile.last_completed_on = today
    profile.recent_challenges = [challenge.id, *profile.recent_challenges]
    profile.recent_challenges = profile.recent_challenges[:8]
    from .experience_shared import ChallengeHistoryEntry

    profile.challenge_history = [
        ChallengeHistoryEntry(
            challenge_id=challenge.id,
            completed_on=today,
            points_earned=earned_points,
            completed_tracks=len(data.completed_tracks),
            minutes_spent=data.minutes_spent,
            quality_rating=data.quality_rating,
        ),
        *profile.challenge_history,
    ][:100]
    if data.notes:
        profile.recent_memory_events = [
            CreatorMemoryEvent(
                event_type="challenge-note",
                label=data.notes.strip()[:160],
                metadata={"challenge_id": challenge.id},
            ),
            *profile.recent_memory_events,
        ][:30]

    if profile.streak_days >= 7 and "week-warrior" not in profile.badges:
        profile.badges.append("week-warrior")
    if profile.total_points >= 500 and "crowd-favorite" not in profile.badges:
        profile.badges.append("crowd-favorite")
    if challenge.id == "motif-lab" and "motif-architect" not in profile.badges:
        profile.badges.append("motif-architect")

    _save_challenge_profile(request, profile)
    return ChallengeScorecard(
        profile_id=profile.profile_id,
        streak_days=profile.streak_days,
        total_points=profile.total_points,
        level=_challenge_level(profile.total_points),
        badges=profile.badges,
        recent_challenges=profile.recent_challenges,
        last_completed_on=profile.last_completed_on,
    )


@router.get("/experience/challenges/scorecard", response_model=ChallengeScorecard)
async def get_challenge_scorecard(request: Request) -> ChallengeScorecard:
    """Get challenge scorecard for the current caller."""
    profile_id = _profile_id_for_request(request)
    profile = _load_challenge_profile(request, profile_id)
    return ChallengeScorecard(
        profile_id=profile.profile_id,
        streak_days=profile.streak_days,
        total_points=profile.total_points,
        level=_challenge_level(profile.total_points),
        badges=profile.badges,
        recent_challenges=profile.recent_challenges,
        last_completed_on=profile.last_completed_on,
    )


@router.get("/experience/challenges/leaderboard", response_model=ChallengeLeaderboardResponse)
async def get_challenge_leaderboard(
    request: Request,
    scope: str = Query("all", pattern="^(all|weekly)$"),
    limit: int = Query(20, ge=1, le=100),
) -> ChallengeLeaderboardResponse:
    """Return challenge leaderboard standings across profiles."""
    payloads = _get_experience_store(request).list_profiles()
    profiles: list[ChallengeProfile] = []
    for payload in payloads:
        try:
            profiles.append(ChallengeProfile.model_validate(payload))
        except Exception:
            continue

    cutoff = date.today() - timedelta(days=6)
    ranked_rows: list[tuple[ChallengeProfile, int]] = []
    for profile in profiles:
        if scope == "weekly":
            points = sum(
                entry.points_earned
                for entry in profile.challenge_history
                if entry.completed_on >= cutoff
            )
        else:
            points = profile.total_points
        if points <= 0:
            continue
        ranked_rows.append((profile, points))

    ranked_rows.sort(key=lambda row: (row[1], row[0].streak_days), reverse=True)
    entries: list[ChallengeLeaderboardEntry] = []
    for index, (profile, points) in enumerate(ranked_rows[:limit], start=1):
        entries.append(
            ChallengeLeaderboardEntry(
                rank=index,
                profile_id=profile.profile_id,
                display_name=_profile_display_name(profile),
                points=points,
                level=_challenge_level(profile.total_points),
                streak_days=profile.streak_days,
                badges=profile.badges,
                last_completed_on=profile.last_completed_on,
            )
        )

    return ChallengeLeaderboardResponse(
        scope=scope,
        generated_on=date.today(),
        entries=entries,
    )


# ---------------------------------------------------------------------------
# Endpoints — Creator Memory
# ---------------------------------------------------------------------------


@router.get("/experience/creator-memory", response_model=CreatorMemoryProfileResponse)
async def get_creator_memory(request: Request) -> CreatorMemoryProfileResponse:
    """Read the caller's personalized creator memory profile."""
    profile = _load_challenge_profile(request, _profile_id_for_request(request))
    return _creator_memory_response(profile)


@router.post("/experience/creator-memory/preferences", response_model=CreatorMemoryProfileResponse)
async def update_creator_memory_preferences(
    request: Request,
    data: UpdateCreatorMemoryRequest,
) -> CreatorMemoryProfileResponse:
    """Update creator memory preferences for future recommendations."""
    profile = _load_challenge_profile(request, _profile_id_for_request(request))
    if data.display_name is not None:
        profile.display_name = data.display_name.strip() or None
    profile.preferred_genres = _dedupe_tokens(data.preferred_genres, limit=12)
    profile.preferred_themes = _dedupe_tokens(data.preferred_themes, limit=20)
    profile.preferred_moods = _dedupe_tokens(data.preferred_moods, limit=20)
    profile.workflow_preferences = _dedupe_tokens(data.workflow_preferences, limit=20)
    profile.goals = _dedupe_tokens(data.goals, limit=20)
    _save_challenge_profile(request, profile)
    return _creator_memory_response(profile)


@router.post("/experience/creator-memory/events", response_model=CreatorMemoryProfileResponse)
async def log_creator_memory_event(
    request: Request,
    data: LogCreatorMemoryEventRequest,
) -> CreatorMemoryProfileResponse:
    """Log an event to keep creator memory fresh."""
    profile = _load_challenge_profile(request, _profile_id_for_request(request))
    metadata = {key.strip(): value.strip() for key, value in data.metadata.items() if key.strip()}
    profile.recent_memory_events = [
        CreatorMemoryEvent(
            event_type=data.event_type.strip().lower(),
            label=data.label.strip(),
            album_id=data.album_id,
            metadata=metadata,
        ),
        *profile.recent_memory_events,
    ][:30]
    _save_challenge_profile(request, profile)
    return _creator_memory_response(profile)


@router.get(
    "/albums/{album_id}/experience/creator-memory/recommendations",
    response_model=CreatorMemoryRecommendationsResponse,
)
async def get_creator_memory_recommendations(
    request: Request,
    album_id: str,
) -> CreatorMemoryRecommendationsResponse:
    """Generate personalized recommendations for one album."""
    album = _get_album(request, album_id)
    profile = _load_challenge_profile(request, _profile_id_for_request(request))
    theme_focus = profile.preferred_themes[:2] or album.central_themes[:2] or ["identity"]
    genre_focus = (
        profile.preferred_genres[0]
        if profile.preferred_genres
        else (album.primary_genre or "alt-pop")
    )
    recommendations = [
        f"Lean next writing sprint into {', '.join(theme_focus)} while maintaining {genre_focus} framing.",
        "Prioritize chorus-first drafting on two tracks, then backfill verse imagery from your motif map.",
        "Capture one 30-second voice memo after each session and convert it into a board item for voting.",
    ]
    if profile.goals:
        recommendations.insert(0, f"Goal lock: {profile.goals[0]}.")
    jam_focus = (
        profile.workflow_preferences[0]
        if profile.workflow_preferences
        else "Run 45-minute focused writing blocks with one concrete output each block."
    )
    release_angle = (
        f"Position campaign around {profile.preferred_moods[0]} mood storytelling."
        if profile.preferred_moods
        else "Position campaign around narrative continuity and behind-the-scenes process."
    )
    return CreatorMemoryRecommendationsResponse(
        profile_id=profile.profile_id,
        album_id=album_id,
        recommendations=recommendations[:5],
        jam_focus=jam_focus,
        release_angle=release_angle,
    )
