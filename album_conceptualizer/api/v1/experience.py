"""Product experience endpoints for creative workflows and launch readiness."""

from __future__ import annotations

import csv
import json
import zipfile
from collections import Counter
from datetime import date, datetime, timedelta
from pathlib import Path
from statistics import median
from typing import Annotated, Any, cast
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from album_conceptualizer.api.deps import hash_api_key
from album_conceptualizer.experience_state import ExperienceStateStore, InMemoryExperienceStateStore
from album_conceptualizer.models.album import Album, Section, SectionType, Song
from album_conceptualizer.models.album_bible import AlbumBible
from album_conceptualizer.storage import BibleStore

from .albums import get_album_store
from .experience_realtime import (
    CollabRealtimeEvent,
    CollabRealtimeHub,
    RedisCollabRealtimeHub,
    _get_collab_realtime_hub,
)


__all__ = [
    "CollabRealtimeEvent",
    "CollabRealtimeHub",
    "RedisCollabRealtimeHub",
    "_get_collab_realtime_hub",
    "router",
]


router = APIRouter()


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


class PromptPack(BaseModel):
    """Creative challenge pack for jam sessions."""

    id: str
    name: str
    vibe: str
    difficulty: str
    description: str
    constraints: list[str]
    bonus_objectives: list[str] = Field(default_factory=list)


PROMPT_PACKS: list[PromptPack] = [
    PromptPack(
        id="cinematic-arc",
        name="Cinematic Arc",
        vibe="big-screen storytelling",
        difficulty="intermediate",
        description="Build tracks like scenes in a film with escalating stakes.",
        constraints=[
            "Every chorus must advance the story",
            "At least one perspective shift by track 4",
            "Use one recurring line that changes meaning",
        ],
        bonus_objectives=["Give each track a location cue", "End with a reflective epilogue"],
    ),
    PromptPack(
        id="midnight-mixtape",
        name="Midnight Mixtape",
        vibe="late-night neon confessional",
        difficulty="beginner",
        description="Write intimate tracks with strong hooks and sparse details.",
        constraints=[
            "Max 12 lyric lines per section draft",
            "One sensory image per verse",
            "Keep chord loops to 4 bars",
        ],
        bonus_objectives=["Include one spoken-word bridge"],
    ),
    PromptPack(
        id="parallel-lives",
        name="Parallel Lives",
        vibe="multi-character narrative",
        difficulty="advanced",
        description="Tell one story through multiple conflicting viewpoints.",
        constraints=[
            "At least two characters disagreeing on one key event",
            "Use mirrored motifs in tracks 2 and 6",
            "Final song reconciles timeline conflicts",
        ],
        bonus_objectives=["Hide a clue in each track title"],
    ),
    PromptPack(
        id="festival-ready",
        name="Festival Ready",
        vibe="anthemic and energetic",
        difficulty="intermediate",
        description="Optimize tracks for live crowd response and singalong moments.",
        constraints=[
            "Every track needs one crowd-call moment",
            "Chorus should land within 45 seconds",
            "Bridge must include a dynamic contrast",
        ],
        bonus_objectives=["Design one tempo-drop fakeout"],
    ),
    PromptPack(
        id="lofi-diary",
        name="Lo-Fi Diary",
        vibe="raw and personal",
        difficulty="beginner",
        description="Focus on emotional honesty with minimalist arrangement ideas.",
        constraints=[
            "Use first-person narration in most tracks",
            "No more than three chords in at least two songs",
            "Keep imagery grounded in everyday objects",
        ],
    ),
    PromptPack(
        id="mythic-revival",
        name="Mythic Revival",
        vibe="modern folklore",
        difficulty="advanced",
        description="Blend mythic symbolism with contemporary language and production.",
        constraints=[
            "Each track references one symbolic object",
            "Alternate intimate and epic song scale",
            "Reuse one motif in three musical forms",
        ],
        bonus_objectives=["Introduce a narrator twist by midpoint"],
    ),
]


class ReferenceTrackInput(BaseModel):
    """Reference track metadata for style capture."""

    title: str = Field(..., min_length=1, max_length=200)
    artist: str | None = None
    key: str | None = None
    tempo: int | None = Field(default=None, ge=20, le=320)
    chord_progression: list[str] = Field(default_factory=list)
    mood_tags: list[str] = Field(default_factory=list)
    production_tags: list[str] = Field(default_factory=list)


class StyleCaptureRequest(BaseModel):
    """Request model for style capture."""

    reference_tracks: list[ReferenceTrackInput] = Field(..., min_length=1, max_length=30)
    album_goal: str | None = None


class StyleCaptureResponse(BaseModel):
    """Aggregated style fingerprint and implementation hints."""

    tempo_range: tuple[int, int] | None
    median_tempo: int | None
    key_centers: list[str]
    common_chord_roots: list[str]
    mood_palette: list[str]
    production_palette: list[str]
    suggested_primary_genre: str
    suggested_prompt: str


class ReferenceTrackDiagnostic(BaseModel):
    """Per-reference diagnostics used by the analyzer."""

    title: str
    artist: str | None = None
    energy_band: str
    hook_density: str
    harmonic_signature: str
    production_signature: str


class ReferenceCluster(BaseModel):
    """Grouped references with shared characteristics."""

    label: str
    count: int = Field(ge=1)
    examples: list[str]


class ReferenceAnalyzerRequest(BaseModel):
    """Request for deep reference-track analysis."""

    reference_tracks: list[ReferenceTrackInput] = Field(..., min_length=1, max_length=30)
    album_goal: str | None = None
    target_track_count: int = Field(default=8, ge=1, le=30)
    desired_energy_curve: str = Field(default="rise", pattern="^(rise|wave|steady)$")


class ReferenceAnalyzerResponse(BaseModel):
    """Expanded reference analyzer output."""

    style_fingerprint: StyleCaptureResponse
    diagnostics: list[ReferenceTrackDiagnostic]
    clusters: list[ReferenceCluster]
    arrangement_cues: list[str]
    lyric_devices: list[str]
    risk_flags: list[str]
    recommended_track_blueprint: list[str]


class JamModeRequest(BaseModel):
    """Request model for jam mode planning."""

    pack_id: str | None = None
    focus: str | None = None
    target_tracks: list[int] = Field(default_factory=list)


class JamCard(BaseModel):
    """One guided creative card for a track."""

    track_number: int
    song_title: str
    objective: str
    lyric_prompt: str
    progression_seed: list[str]
    motif_callback: str | None = None


class JamModeResponse(BaseModel):
    """Jam mode response containing actionable writing cards."""

    pack: PromptPack
    focus: str
    album_hook: str
    cards: list[JamCard]


class TimelineRow(BaseModel):
    """One row in the narrative timeline board."""

    track_number: int
    song_title: str
    chronological_order: int | None
    narrative_position: str | None
    narrative_summary: str | None
    themes: list[str]
    motifs: list[str]
    characters: list[str]
    section_count: int


class TimelineWarning(BaseModel):
    """Narrative consistency warning."""

    severity: str
    message: str


class TimelineBoardResponse(BaseModel):
    """Narrative timeline board response."""

    rows: list[TimelineRow]
    warnings: list[TimelineWarning]
    coherence_score: int = Field(ge=0, le=100)


class ProgressItem(BaseModel):
    """Progress checklist item."""

    id: str
    label: str
    weight: int
    progress: float = Field(ge=0.0, le=1.0)
    status: str


class ProgressCoachResponse(BaseModel):
    """Progress coaching response."""

    completion_percent: int = Field(ge=0, le=100)
    readiness_tier: str
    checklist: list[ProgressItem]
    next_actions: list[str]


class TrackTeaser(BaseModel):
    """Teaser line for one track."""

    track_number: int
    title: str
    teaser: str


class ReleaseKitResponse(BaseModel):
    """Marketing copy package for launch preparation."""

    album_pitch: str
    press_blurb: str
    track_teasers: list[TrackTeaser]
    social_posts: list[str]
    cover_art_prompt: str
    launch_checklist: list[str]


class ReleaseKitExportRequest(BaseModel):
    """Options for one-click release kit bundle generation."""

    platform: str = "streaming"
    launch_date: str | None = None
    duration_days: int = Field(default=14, ge=7, le=60)
    include_campaign_csv: bool = True
    include_json_manifest: bool = True


class ReleaseKitExportResponse(BaseModel):
    """Release kit bundle metadata."""

    bundle_dir: str
    zip_path: str
    files: list[str]


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


class ChallengeHistoryEntry(BaseModel):
    """One historical challenge completion entry."""

    challenge_id: str
    completed_on: date
    points_earned: int = Field(ge=1)
    completed_tracks: int = Field(ge=0, le=100)
    minutes_spent: int = Field(ge=1, le=600)
    quality_rating: int = Field(ge=1, le=5)


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


class AudioPreviewRequest(BaseModel):
    """Request payload for MIDI-based audio preview generation."""

    track_numbers: list[int] = Field(default_factory=list)
    tempo_override: int | None = Field(default=None, ge=40, le=240)
    bars_per_chord: float = Field(default=2.0, ge=0.5, le=8.0)


class AudioPreviewTrack(BaseModel):
    """Per-track preview metadata."""

    track_number: int
    song_title: str
    tempo: int
    chord_count: int
    seed_source: str


class AudioPreviewResponse(BaseModel):
    """Generated audio preview metadata."""

    file_path: str
    estimated_duration_seconds: int
    tracks: list[AudioPreviewTrack]
    render_hint: str


class ReleaseCampaignItem(BaseModel):
    """One scheduled release campaign action."""

    day_offset: int
    publish_on: date
    channel: str
    objective: str
    message: str


class ReleaseCampaignResponse(BaseModel):
    """Campaign schedule and KPI focus."""

    campaign_name: str
    launch_date: date
    duration_days: int
    items: list[ReleaseCampaignItem]
    kpis: list[str]


class TemplateTrackBlueprint(BaseModel):
    """Starter track blueprint from a template."""

    title: str
    narrative_summary: str
    chord_seed: list[str]


class MarketplaceTemplate(BaseModel):
    """Template marketplace listing."""

    id: str
    name: str
    genre: str
    description: str
    concept_seed: str
    theme_seed: list[str]
    track_blueprints: list[TemplateTrackBlueprint]


TEMPLATE_MARKETPLACE: list[MarketplaceTemplate] = [
    MarketplaceTemplate(
        id="neon-city-arc",
        name="Neon City Arc",
        genre="Synth Pop",
        description="Night-drive concept arc with cinematic transitions.",
        concept_seed="A city journey from emotional static to lucid sunrise.",
        theme_seed=["reinvention", "memory", "movement"],
        track_blueprints=[
            TemplateTrackBlueprint(
                title="After Midnight",
                narrative_summary="A restless narrator steps into the city after a breakup.",
                chord_seed=["C", "G", "Am", "F"],
            ),
            TemplateTrackBlueprint(
                title="Signal Lights",
                narrative_summary="The first sign of hope appears in random street patterns.",
                chord_seed=["Dm", "Bb", "F", "C"],
            ),
            TemplateTrackBlueprint(
                title="First Train Home",
                narrative_summary="Resolution arrives as the narrator chooses a new direction.",
                chord_seed=["F", "C", "Dm", "Bb"],
            ),
        ],
    ),
    MarketplaceTemplate(
        id="mythic-folk-loop",
        name="Mythic Folk Loop",
        genre="Indie Folk",
        description="Modern folklore template with symbolic callbacks.",
        concept_seed="A small town retells one myth from three conflicting witnesses.",
        theme_seed=["legacy", "truth", "ritual"],
        track_blueprints=[
            TemplateTrackBlueprint(
                title="Ash & Honey",
                narrative_summary="The first witness frames the myth as a warning tale.",
                chord_seed=["G", "D", "Em", "C"],
            ),
            TemplateTrackBlueprint(
                title="Lantern Trial",
                narrative_summary="A second witness contradicts the original narrative.",
                chord_seed=["Am", "F", "C", "G"],
            ),
            TemplateTrackBlueprint(
                title="River Oath",
                narrative_summary="Conflicting stories converge into a shared memory.",
                chord_seed=["Em", "C", "G", "D"],
            ),
        ],
    ),
    MarketplaceTemplate(
        id="festival-burn",
        name="Festival Burn",
        genre="Alt Rock",
        description="Big-stage energy arc designed for live set momentum.",
        concept_seed="A one-night festival set mirrors a full emotional relapse and comeback.",
        theme_seed=["release", "risk", "recovery"],
        track_blueprints=[
            TemplateTrackBlueprint(
                title="Gate Open",
                narrative_summary="The opening surge introduces stakes and urgency.",
                chord_seed=["D", "A", "Bm", "G"],
            ),
            TemplateTrackBlueprint(
                title="Second Wind",
                narrative_summary="A setback turns into the loudest chorus moment.",
                chord_seed=["A", "E", "F#m", "D"],
            ),
            TemplateTrackBlueprint(
                title="Dawn Encore",
                narrative_summary="The set closes with reconciliatory calm.",
                chord_seed=["C", "Am", "F", "G"],
            ),
        ],
    ),
]


class ApplyTemplateRequest(BaseModel):
    """Apply-template behavior toggles."""

    mode: str = Field(default="merge", pattern="^(merge|replace)$")
    add_tracks: bool = True


class ApplyTemplateResponse(BaseModel):
    """Template apply result payload."""

    template_id: str
    mode: str
    added_tracks: list[str]
    updated_fields: list[str]
    album: Album


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


class DawHandoffRequest(BaseModel):
    """Request payload for generating DAW handoff packs."""

    daw_targets: list[str] = Field(default_factory=lambda: ["ableton", "logic"])
    include_midi_guides: bool = True
    bpm_strategy: str = Field(default="median", pattern="^(median|fixed)$")
    fixed_bpm: int | None = Field(default=None, ge=40, le=240)
    package_name: str | None = Field(default=None, max_length=120)
    reference_tracks: list[ReferenceTrackInput] = Field(default_factory=list, max_length=30)


class DawHandoffResponse(BaseModel):
    """Generated DAW handoff bundle metadata."""

    bundle_dir: str
    zip_path: str
    files: list[str]
    recommended_tempo: int
    daw_targets: list[str]
    analysis_summary: str


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


def _pick_pack(pack_id: str | None) -> PromptPack:
    if not pack_id:
        return PROMPT_PACKS[0]
    for pack in PROMPT_PACKS:
        if pack.id == pack_id:
            return pack
    raise HTTPException(status_code=404, detail="Prompt pack not found")


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


def _readiness_tier(score: int) -> str:
    if score >= 85:
        return "launch-ready"
    if score >= 65:
        return "beta-ready"
    if score >= 40:
        return "prototype"
    return "early-draft"


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


def _get_room(request: Request, album_id: str, room_id: str) -> CollabRoom:
    payload = _get_experience_store(request).get_room(album_id, room_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Collaboration room not found")
    try:
        return CollabRoom.model_validate(payload)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Corrupt collaboration room state") from exc


def _get_template(template_id: str) -> MarketplaceTemplate:
    for template in TEMPLATE_MARKETPLACE:
        if template.id == template_id:
            return template
    raise HTTPException(status_code=404, detail="Template not found")


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


def _build_style_capture_response(
    reference_tracks: list[ReferenceTrackInput],
    album_goal: str | None,
) -> StyleCaptureResponse:
    tempos = [track.tempo for track in reference_tracks if track.tempo]
    keys = Counter(track.key for track in reference_tracks if track.key)

    roots: Counter[str] = Counter()
    for track in reference_tracks:
        for symbol in track.chord_progression:
            root = _extract_root(symbol)
            if root:
                roots[root] += 1

    moods = Counter(
        mood.strip().lower()
        for track in reference_tracks
        for mood in track.mood_tags
        if mood.strip()
    )
    production = Counter(
        tag.strip().lower()
        for track in reference_tracks
        for tag in track.production_tags
        if tag.strip()
    )

    top_keys = [item for item, _ in keys.most_common(3)]
    top_roots = [item for item, _ in roots.most_common(5)]
    top_moods = [item for item, _ in moods.most_common(5)]
    top_production = [item for item, _ in production.most_common(5)]

    if tempos:
        tempo_range = (min(tempos), max(tempos))
        median_tempo = int(median(tempos))
    else:
        tempo_range = None
        median_tempo = None

    high_energy = median_tempo is not None and median_tempo >= 128
    suggested_genre = "electro-pop" if high_energy else "alt-pop"
    if "cinematic" in top_moods or "orchestral" in top_production:
        suggested_genre = "cinematic pop"
    elif "gritty" in top_moods:
        suggested_genre = "alt-rock"

    goal_fragment = f" Goal: {album_goal}." if album_goal else ""
    prompt = (
        f"Build a cohesive {suggested_genre} album around keys {', '.join(top_keys) or 'C major'} "
        f"with chord gravity on {', '.join(top_roots[:3]) or 'C-G-A'} and moods "
        f"{', '.join(top_moods[:3]) or 'intimate, cinematic, hopeful'}.{goal_fragment}"
    )

    return StyleCaptureResponse(
        tempo_range=tempo_range,
        median_tempo=median_tempo,
        key_centers=top_keys,
        common_chord_roots=top_roots,
        mood_palette=top_moods,
        production_palette=top_production,
        suggested_primary_genre=suggested_genre,
        suggested_prompt=prompt,
    )


def _energy_band(tempo: int | None) -> str:
    if tempo is None:
        return "unknown"
    if tempo < 95:
        return "low"
    if tempo < 125:
        return "medium"
    return "high"


def _hook_density(track: ReferenceTrackInput) -> str:
    hook_signals = 0
    for mood in track.mood_tags:
        mood_token = mood.lower()
        if mood_token in {"anthemic", "hooky", "catchy", "energetic"}:
            hook_signals += 1
    if track.tempo and track.tempo >= 130:
        hook_signals += 1
    if len(track.chord_progression) <= 4:
        hook_signals += 1
    if hook_signals >= 3:
        return "high"
    if hook_signals == 2:
        return "medium"
    return "low"


def _harmonic_signature(track: ReferenceTrackInput) -> str:
    roots = [_extract_root(symbol) for symbol in track.chord_progression]
    compact_roots = [root for root in roots if root][:3]
    if compact_roots:
        return "/".join(compact_roots)
    if track.key:
        return track.key
    return "unlabeled"


def _compose_release_kit_payload(
    album: Album,
    bible: AlbumBible | None,
    platform: str,
) -> ReleaseKitResponse:
    songs = sorted(album.songs, key=lambda s: s.track_number)
    concept = (
        album.concept_summary or (bible.logline if bible else "") or "a narrative-driven release"
    )
    theme_list = ", ".join(album.central_themes[:3]) or "identity, memory, and change"
    motif_list = (
        ", ".join(motif.name for motif in (bible.motifs if bible else [])[:2])
        or "recurring symbols"
    )
    genre = album.primary_genre or (
        bible.style_profile.primary_genre if bible and bible.style_profile else "alt-pop"
    )

    album_pitch = f"'{album.title}' is a {genre} concept project about {concept}, threading themes of {theme_list}."
    press_blurb = (
        f"{album_pitch} Across {len(songs)} tracks, the record uses {motif_list} to keep a cohesive "
        f"story world while still giving each song a distinct emotional angle."
    )

    teasers: list[TrackTeaser] = []
    for song in songs:
        summary = song.narrative_summary or "a key turning point in the album arc"
        teaser_line = f"{summary.rstrip('.')}."
        teasers.append(
            TrackTeaser(
                track_number=song.track_number,
                title=song.title,
                teaser=teaser_line,
            )
        )

    social_posts = [
        (
            f"New era loading: {album.title}. A {genre} concept arc exploring {theme_list}. "
            f"Pre-save now. #{album.title.replace(' ', '')}"
        ),
        (
            f"Tracklist reveal for {album.title}: "
            + ", ".join(song.title for song in songs[:5])
            + ("..." if len(songs) > 5 else "")
        ),
        (
            f"Behind the scenes: we built this record around {motif_list} to keep every track connected. "
            f"{platform.title()} drop date soon."
        ),
    ]

    cover_art_prompt = (
        f"Album cover for '{album.title}', {genre} tone, motifs: {motif_list}, themes: {theme_list}, "
        f"cinematic composition, high contrast, modern editorial style."
    )
    launch_checklist = [
        "Finalize ISRC/metadata and distributor submission.",
        "Schedule teaser snippets and pre-save call-to-action posts.",
        "Export lyric/chord sheets and archive masters.",
        "Prepare one live or visualizer performance asset for launch week.",
    ]
    return ReleaseKitResponse(
        album_pitch=album_pitch,
        press_blurb=press_blurb,
        track_teasers=teasers,
        social_posts=social_posts,
        cover_art_prompt=cover_art_prompt,
        launch_checklist=launch_checklist,
    )


def _resolve_launch_date(launch_date: str | None) -> date:
    if not launch_date:
        return date.today() + timedelta(days=14)
    try:
        return datetime.strptime(launch_date, "%Y-%m-%d").date()
    except ValueError as exc:
        raise HTTPException(
            status_code=400, detail="Invalid launch_date format. Use YYYY-MM-DD."
        ) from exc


def _compose_release_campaign_payload(
    album: Album,
    launch: date,
    duration_days: int,
) -> ReleaseCampaignResponse:
    songs = sorted(album.songs, key=lambda song: song.track_number)
    concept = album.concept_summary or "a cohesive narrative arc"
    theme_stack = ", ".join(album.central_themes[:3]) or "identity, memory, and change"
    channels = ["instagram", "tiktok", "youtube", "newsletter", "discord"]
    objectives = [
        "announce era",
        "tease narrative world",
        "highlight track snippets",
        "drive pre-save intent",
        "community engagement",
    ]

    start_day = launch - timedelta(days=duration_days - 1)
    items: list[ReleaseCampaignItem] = []
    for offset in range(duration_days):
        publish_on = start_day + timedelta(days=offset)
        channel = channels[offset % len(channels)]
        objective = objectives[offset % len(objectives)]
        track_fragment = songs[offset % len(songs)].title if songs else album.title
        message = (
            f"{album.title}: {objective}. Feature '{track_fragment}' and reinforce themes of {theme_stack}. "
            f"Concept anchor: {concept}."
        )
        items.append(
            ReleaseCampaignItem(
                day_offset=offset - (duration_days - 1),
                publish_on=publish_on,
                channel=channel,
                objective=objective,
                message=message,
            )
        )

    return ReleaseCampaignResponse(
        campaign_name=f"{album.title} launch campaign",
        launch_date=launch,
        duration_days=duration_days,
        items=items,
        kpis=[
            "pre-save conversion rate",
            "engagement rate per channel",
            "click-through to streaming links",
            "week-one listener retention",
        ],
    )


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


REMIX_BATTLE_REGISTRY_PROFILE_ID = "__remix_battle_registry__"
VALID_DAW_TARGETS = {"ableton", "logic"}


def _build_reference_analyzer_response(
    data: ReferenceAnalyzerRequest,
) -> ReferenceAnalyzerResponse:
    style_fingerprint = _build_style_capture_response(
        reference_tracks=data.reference_tracks,
        album_goal=data.album_goal,
    )

    diagnostics: list[ReferenceTrackDiagnostic] = []
    energy_groups: dict[str, list[str]] = {"low": [], "medium": [], "high": [], "unknown": []}
    harmonic_groups: dict[str, list[str]] = {}
    for track in data.reference_tracks:
        energy = _energy_band(track.tempo)
        energy_groups.setdefault(energy, []).append(track.title)
        harmonic_key = _harmonic_signature(track)
        harmonic_groups.setdefault(harmonic_key, []).append(track.title)
        production_signature = (
            ", ".join(_dedupe_tokens(track.production_tags, limit=3)) or "unlabeled"
        )
        diagnostics.append(
            ReferenceTrackDiagnostic(
                title=track.title,
                artist=track.artist,
                energy_band=energy,
                hook_density=_hook_density(track),
                harmonic_signature=harmonic_key,
                production_signature=production_signature,
            )
        )

    cluster_rows: list[ReferenceCluster] = []
    for label, titles in energy_groups.items():
        if titles:
            cluster_rows.append(
                ReferenceCluster(
                    label=f"energy:{label}",
                    count=len(titles),
                    examples=titles[:3],
                )
            )
    for harmonic_signature, titles in harmonic_groups.items():
        if len(titles) < 2:
            continue
        cluster_rows.append(
            ReferenceCluster(
                label=f"harmony:{harmonic_signature}",
                count=len(titles),
                examples=titles[:3],
            )
        )
    cluster_rows.sort(key=lambda row: row.count, reverse=True)
    cluster_rows = cluster_rows[:6]

    arrangement_cues: list[str] = []
    if data.desired_energy_curve == "rise":
        arrangement_cues.append("Open with sparse intros and stack layers by track to create lift.")
    elif data.desired_energy_curve == "wave":
        arrangement_cues.append("Alternate high-energy and intimate songs to form contrast cycles.")
    else:
        arrangement_cues.append(
            "Keep tempo and arrangement density stable to emphasize lyric detail."
        )
    arrangement_cues.append("Anchor choruses with one consistent rhythmic motif across the album.")
    arrangement_cues.append("Use one signature production texture on every track for cohesion.")

    lyric_devices = [
        "Thread one recurring phrase through at least three songs with evolving meaning.",
        "Use concrete location imagery early and abstract reflection later for narrative lift.",
        "Reserve the most direct emotional line for final chorus turns.",
    ]

    risk_flags: list[str] = []
    if (
        style_fingerprint.tempo_range
        and style_fingerprint.tempo_range[1] - style_fingerprint.tempo_range[0] > 45
    ):
        risk_flags.append("Tempo spread is wide; lock a narrower BPM lane to keep sonic cohesion.")
    if len(style_fingerprint.key_centers) > 2:
        risk_flags.append("Too many key centers may blur identity; prioritize one home key family.")
    if not style_fingerprint.production_palette:
        risk_flags.append("Production tags are sparse; define a repeatable texture palette.")

    blueprint: list[str] = []
    for index in range(data.target_track_count):
        track_number = index + 1
        if data.desired_energy_curve == "rise":
            phase = (
                "setup"
                if track_number <= 2
                else "lift"
                if track_number <= data.target_track_count - 1
                else "peak"
            )
        elif data.desired_energy_curve == "wave":
            phase = "high" if track_number % 2 == 1 else "low"
        else:
            phase = "steady"
        blueprint.append(f"Track {track_number}: {phase} phase with one hook-first section map.")

    return ReferenceAnalyzerResponse(
        style_fingerprint=style_fingerprint,
        diagnostics=diagnostics,
        clusters=cluster_rows,
        arrangement_cues=arrangement_cues,
        lyric_devices=lyric_devices,
        risk_flags=risk_flags,
        recommended_track_blueprint=blueprint,
    )


def _reference_tracks_from_album(album: Album) -> list[ReferenceTrackInput]:
    references: list[ReferenceTrackInput] = []
    for song in sorted(album.songs, key=lambda item: item.track_number):
        progression: list[str] = []
        for section in song.sections:
            if section.chord_progression:
                progression = section.chord_progression[:8]
                break
        references.append(
            ReferenceTrackInput(
                title=song.title,
                artist=album.artist,
                key=song.key,
                tempo=song.tempo,
                chord_progression=progression,
                mood_tags=song.mood_tags[:4],
                production_tags=song.instrumentation[:4],
            )
        )
    if references:
        return references
    return [
        ReferenceTrackInput(
            title=album.title,
            artist=album.artist,
            key="C major",
            tempo=120,
            chord_progression=["C", "G", "Am", "F"],
            mood_tags=album.central_themes[:3],
        )
    ]


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




@router.get("/experience/prompt-packs", response_model=list[PromptPack])
async def list_prompt_packs(
    difficulty: str | None = Query(None, description="Filter by difficulty"),
) -> list[PromptPack]:
    """List creative challenge packs for jam mode sessions."""
    if not difficulty:
        return PROMPT_PACKS
    return [pack for pack in PROMPT_PACKS if pack.difficulty == difficulty.lower()]


@router.post("/experience/style-capture", response_model=StyleCaptureResponse)
async def capture_style(data: StyleCaptureRequest) -> StyleCaptureResponse:
    """Derive a style fingerprint from reference tracks."""
    return _build_style_capture_response(
        reference_tracks=data.reference_tracks,
        album_goal=data.album_goal,
    )


@router.post("/experience/reference-analyzer", response_model=ReferenceAnalyzerResponse)
async def analyze_reference_tracks(data: ReferenceAnalyzerRequest) -> ReferenceAnalyzerResponse:
    """Run deeper diagnostics and blueprint guidance from reference tracks."""
    return _build_reference_analyzer_response(data)


@router.post("/albums/{album_id}/experience/jam-mode", response_model=JamModeResponse)
async def create_jam_mode_plan(
    request: Request,
    album_id: str,
    data: JamModeRequest,
) -> JamModeResponse:
    """Generate a structured jam session plan for each target track."""
    album = _get_album(request, album_id)
    bible = _get_bible(request, album_id)
    profile = _load_challenge_profile(request, _profile_id_for_request(request))
    pack = _pick_pack(data.pack_id)

    songs = sorted(album.songs, key=lambda s: s.track_number)
    if data.target_tracks:
        target_set = set(data.target_tracks)
        songs = [song for song in songs if song.track_number in target_set]

    if not songs:
        raise HTTPException(status_code=400, detail="No songs selected for jam mode")

    motif_names = [motif.name for motif in bible.motifs] if bible else []
    if data.focus:
        focus = data.focus
    elif profile.workflow_preferences:
        focus = profile.workflow_preferences[0]
    else:
        focus = "tighten narrative hooks and memorable chord movements"
    album_hook = album.concept_summary or (
        bible.logline if bible and bible.logline else "Build a coherent concept arc across tracks"
    )

    cards: list[JamCard] = []
    for index, song in enumerate(songs):
        objective = "Polish arrangement and emotional pacing"
        if not song.narrative_summary:
            objective = "Define a clear story beat for this track"
        elif not song.sections:
            objective = "Draft section map before lyric polishing"
        elif not any(section.chord_progression for section in song.sections):
            objective = "Lock a chord backbone for each major section"

        theme_hint = (
            song.themes[0]
            if song.themes
            else (
                profile.preferred_themes[0]
                if profile.preferred_themes
                else (album.central_themes[0] if album.central_themes else "change")
            )
        )
        lyric_prompt = f"Write a hook that reframes '{theme_hint}' with one concrete image and one contradiction."
        motif_callback = motif_names[index % len(motif_names)] if motif_names else None

        cards.append(
            JamCard(
                track_number=song.track_number,
                song_title=song.title,
                objective=objective,
                lyric_prompt=lyric_prompt,
                progression_seed=_seed_progression(song),
                motif_callback=motif_callback,
            )
        )

    return JamModeResponse(
        pack=pack,
        focus=focus,
        album_hook=album_hook,
        cards=cards,
    )


@router.get("/albums/{album_id}/experience/timeline-board", response_model=TimelineBoardResponse)
async def get_timeline_board(request: Request, album_id: str) -> TimelineBoardResponse:
    """Generate a narrative timeline board and continuity warnings."""
    album = _get_album(request, album_id)
    bible = _get_bible(request, album_id)
    songs = sorted(album.songs, key=lambda s: s.track_number)

    rows = [
        TimelineRow(
            track_number=song.track_number,
            song_title=song.title,
            chronological_order=song.chronological_order,
            narrative_position=song.narrative_position,
            narrative_summary=song.narrative_summary,
            themes=song.themes,
            motifs=song.motifs,
            characters=song.characters,
            section_count=len(song.sections),
        )
        for song in songs
    ]

    warnings: list[TimelineWarning] = []
    chronological_map: dict[int, str] = {}
    valid_tracks = {song.track_number for song in songs}

    for row in rows:
        if not row.narrative_summary:
            warnings.append(
                TimelineWarning(
                    severity="medium",
                    message=f"Track {row.track_number} is missing a narrative summary.",
                )
            )
        if row.section_count == 0:
            warnings.append(
                TimelineWarning(
                    severity="high",
                    message=f"Track {row.track_number} has no sections drafted.",
                )
            )
        if row.chronological_order is not None:
            if row.chronological_order in chronological_map:
                warnings.append(
                    TimelineWarning(
                        severity="high",
                        message=(
                            f"Chronology collision: tracks {chronological_map[row.chronological_order]} and "
                            f"{row.track_number} share order {row.chronological_order}."
                        ),
                    )
                )
            else:
                chronological_map[row.chronological_order] = str(row.track_number)

    if bible:
        for theme in bible.themes:
            for track_num in theme.primary_songs + theme.secondary_songs:
                if track_num not in valid_tracks:
                    warnings.append(
                        TimelineWarning(
                            severity="medium",
                            message=f"Theme '{theme.name}' references missing track {track_num}.",
                        )
                    )
        for motif in bible.motifs:
            for appearance in motif.appearances:
                motif_track_num = appearance.get("track_number")
                if isinstance(motif_track_num, int) and motif_track_num not in valid_tracks:
                    warnings.append(
                        TimelineWarning(
                            severity="medium",
                            message=f"Motif '{motif.name}' references missing track {motif_track_num}.",
                        )
                    )

    coherence_score = max(0, 100 - (len(warnings) * 8))
    return TimelineBoardResponse(rows=rows, warnings=warnings, coherence_score=coherence_score)


@router.get("/albums/{album_id}/experience/progress-coach", response_model=ProgressCoachResponse)
async def get_progress_coach(request: Request, album_id: str) -> ProgressCoachResponse:
    """Calculate productization progress and return next best actions."""
    album = _get_album(request, album_id)
    bible = _get_bible(request, album_id)
    songs = album.songs

    song_count = len(songs)
    song_target = max(song_count, 6)
    songs_with_story = sum(1 for song in songs if song.narrative_summary)
    songs_with_sections = sum(1 for song in songs if len(song.sections) >= 2)
    songs_with_chords = sum(
        1 for song in songs if any(section.chord_progression for section in song.sections)
    )

    checklist = [
        ProgressItem(
            id="concept",
            label="Album concept defined",
            weight=10,
            progress=1.0 if album.concept_summary else 0.0,
            status="complete" if album.concept_summary else "todo",
        ),
        ProgressItem(
            id="tracklist",
            label="Target tracklist depth (6+ songs)",
            weight=15,
            progress=min(song_count / song_target, 1.0),
            status="complete" if song_count >= 6 else "in_progress",
        ),
        ProgressItem(
            id="story",
            label="Narrative summary coverage",
            weight=20,
            progress=(songs_with_story / song_count) if song_count else 0.0,
            status="complete" if song_count and songs_with_story == song_count else "in_progress",
        ),
        ProgressItem(
            id="sections",
            label="Section drafting coverage",
            weight=15,
            progress=(songs_with_sections / song_count) if song_count else 0.0,
            status="complete"
            if song_count and songs_with_sections == song_count
            else "in_progress",
        ),
        ProgressItem(
            id="harmony",
            label="Chord progression coverage",
            weight=15,
            progress=(songs_with_chords / song_count) if song_count else 0.0,
            status="complete" if song_count and songs_with_chords == song_count else "in_progress",
        ),
        ProgressItem(
            id="bible-core",
            label="Album bible core complete",
            weight=10,
            progress=1.0 if bible and bible.logline and bible.synopsis else 0.0,
            status="complete" if bible and bible.logline and bible.synopsis else "todo",
        ),
        ProgressItem(
            id="motifs",
            label="Recurring motif map",
            weight=5,
            progress=1.0 if bible and bible.motifs else 0.0,
            status="complete" if bible and bible.motifs else "todo",
        ),
        ProgressItem(
            id="characters",
            label="Character arc map",
            weight=5,
            progress=1.0 if bible and bible.characters else 0.0,
            status="complete" if bible and bible.characters else "todo",
        ),
        ProgressItem(
            id="metadata",
            label="Release metadata completeness",
            weight=5,
            progress=1.0 if album.artist and album.primary_genre and album.central_themes else 0.4,
            status="complete"
            if album.artist and album.primary_genre and album.central_themes
            else "in_progress",
        ),
    ]

    weighted_progress = sum(item.progress * item.weight for item in checklist)
    completion_percent = round(weighted_progress)
    tier = _readiness_tier(completion_percent)

    next_actions: list[str] = []
    for item in checklist:
        if item.progress >= 1.0:
            continue
        if item.id == "tracklist":
            next_actions.append(
                "Draft at least one more song to reach a full 6-track narrative arc."
            )
        elif item.id == "story":
            next_actions.append(
                "Write missing narrative summaries so every track advances the plot."
            )
        elif item.id == "sections":
            next_actions.append(
                "Give each song at least two sections to stabilize arrangement flow."
            )
        elif item.id == "harmony":
            next_actions.append("Add core chord progressions for all drafted sections.")
        elif item.id == "bible-core":
            next_actions.append("Fill in the album bible logline and synopsis.")
        elif item.id == "motifs":
            next_actions.append("Define at least one recurring motif and map where it appears.")
        elif item.id == "characters":
            next_actions.append("Add core character arcs or narrator perspectives to the bible.")
        elif item.id == "metadata":
            next_actions.append("Finalize artist/genre/themes metadata for launch assets.")

        if len(next_actions) >= 4:
            break

    return ProgressCoachResponse(
        completion_percent=completion_percent,
        readiness_tier=tier,
        checklist=checklist,
        next_actions=next_actions,
    )


@router.get("/albums/{album_id}/experience/release-kit", response_model=ReleaseKitResponse)
async def get_release_kit(
    request: Request,
    album_id: str,
    platform: str = Query("streaming", description="Target platform context"),
) -> ReleaseKitResponse:
    """Generate launch-ready marketing copy and teasers for the album."""
    album = _get_album(request, album_id)
    bible = _get_bible(request, album_id)
    profile = _load_challenge_profile(request, _profile_id_for_request(request))
    release_kit = _compose_release_kit_payload(album, bible, platform)
    if profile.preferred_moods:
        mood_stack = ", ".join(profile.preferred_moods[:2])
        release_kit.social_posts.append(
            f"Creator cut: this release leans into {mood_stack}. Tell us which track hits hardest first."
        )
    if profile.goals:
        release_kit.launch_checklist.insert(0, f"Creator memory priority: {profile.goals[0]}.")
    return release_kit


@router.post(
    "/albums/{album_id}/experience/release-kit/export",
    response_model=ReleaseKitExportResponse,
)
async def export_release_kit(
    request: Request,
    album_id: str,
    data: ReleaseKitExportRequest,
) -> ReleaseKitExportResponse:
    """Export a one-click release kit bundle with copy + campaign assets."""
    album = _get_album(request, album_id)
    bible = _get_bible(request, album_id)
    launch = _resolve_launch_date(data.launch_date)
    release_kit = _compose_release_kit_payload(album, bible, data.platform)
    campaign = _compose_release_campaign_payload(album, launch, data.duration_days)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    slug = _safe_slug(album.title)
    bundle_dir = Path("output/release_kits") / str(album.id) / f"{slug}_{timestamp}"
    bundle_dir.mkdir(parents=True, exist_ok=True)

    files: list[str] = []

    def _write_text_file(name: str, content: str) -> None:
        target = bundle_dir / name
        target.write_text(content.strip() + "\n")
        files.append(name)

    _write_text_file("album_pitch.txt", release_kit.album_pitch)
    _write_text_file("press_blurb.txt", release_kit.press_blurb)
    _write_text_file("social_posts.txt", "\n\n".join(release_kit.social_posts))
    _write_text_file("cover_art_prompt.txt", release_kit.cover_art_prompt)
    _write_text_file(
        "launch_checklist.txt", "\n".join(f"- {item}" for item in release_kit.launch_checklist)
    )
    _write_text_file(
        "track_teasers.txt",
        "\n".join(
            f"{teaser.track_number:02d}. {teaser.title}: {teaser.teaser}"
            for teaser in release_kit.track_teasers
        ),
    )

    if data.include_campaign_csv:
        campaign_path = bundle_dir / "campaign_schedule.csv"
        with campaign_path.open("w", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(["day_offset", "publish_on", "channel", "objective", "message"])
            for item in campaign.items:
                writer.writerow(
                    [
                        item.day_offset,
                        item.publish_on.isoformat(),
                        item.channel,
                        item.objective,
                        item.message,
                    ]
                )
        files.append("campaign_schedule.csv")

    if data.include_json_manifest:
        manifest: dict[str, Any] = {
            "album_id": str(album.id),
            "album_title": album.title,
            "generated_at": datetime.utcnow().isoformat(),
            "platform": data.platform,
            "release_kit": release_kit.model_dump(mode="json"),
            "campaign": campaign.model_dump(mode="json"),
        }
        manifest_path = bundle_dir / "manifest.json"
        manifest_path.write_text(json.dumps(manifest, indent=2))
        files.append("manifest.json")

    zip_path = bundle_dir.with_suffix(".zip")
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for file_name in files:
            file_path = bundle_dir / file_name
            archive.write(file_path, arcname=file_name)

    return ReleaseKitExportResponse(
        bundle_dir=str(bundle_dir),
        zip_path=str(zip_path),
        files=sorted(files),
    )


@router.post("/albums/{album_id}/experience/daw-handoff", response_model=DawHandoffResponse)
async def generate_daw_handoff_pack(
    request: Request,
    album_id: str,
    data: DawHandoffRequest,
) -> DawHandoffResponse:
    """Generate DAW handoff pack templates from release-kit and analyzer outputs."""
    album = _get_album(request, album_id)
    bible = _get_bible(request, album_id)

    requested_targets = _dedupe_tokens(data.daw_targets, limit=6)
    if not requested_targets:
        requested_targets = ["ableton", "logic"]
    invalid_targets = [target for target in requested_targets if target not in VALID_DAW_TARGETS]
    if invalid_targets:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported daw target(s): {', '.join(invalid_targets)}",
        )

    references = data.reference_tracks or _reference_tracks_from_album(album)
    analyzer_request = ReferenceAnalyzerRequest(
        reference_tracks=references,
        album_goal=album.concept_summary,
        target_track_count=max(len(album.songs), 6),
        desired_energy_curve="rise",
    )
    analyzer = _build_reference_analyzer_response(analyzer_request)
    release_kit = _compose_release_kit_payload(album, bible, "streaming")

    tempo_votes = [song.tempo for song in album.songs if song.tempo]
    if data.bpm_strategy == "fixed":
        if data.fixed_bpm is None:
            raise HTTPException(
                status_code=400, detail="fixed_bpm is required when bpm_strategy='fixed'"
            )
        recommended_tempo = data.fixed_bpm
    else:
        recommended_tempo = analyzer.style_fingerprint.median_tempo or (
            int(median(tempo_votes)) if tempo_votes else 120
        )

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    package_label = data.package_name or f"{album.title}_handoff"
    bundle_dir = (
        Path("output/daw_handoff") / str(album.id) / f"{_safe_slug(package_label)}_{timestamp}"
    )
    bundle_dir.mkdir(parents=True, exist_ok=True)
    files: list[str] = []

    def _write_text(name: str, content: str) -> None:
        target = bundle_dir / name
        target.write_text(content.strip() + "\n")
        files.append(name)

    def _write_json(name: str, payload: dict[str, Any]) -> None:
        target = bundle_dir / name
        target.write_text(json.dumps(payload, indent=2))
        files.append(name)

    _write_text(
        "README.txt",
        (
            f"DAW Handoff Pack for {album.title}\n"
            f"Targets: {', '.join(requested_targets)}\n"
            f"Recommended BPM: {recommended_tempo}\n"
            f"Generated: {datetime.utcnow().isoformat()}\n"
        ),
    )
    _write_json("release_kit.json", release_kit.model_dump(mode="json"))
    _write_json("reference_analyzer.json", analyzer.model_dump(mode="json"))

    map_path = bundle_dir / "arrangement_map.csv"
    with map_path.open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            [
                "track_number",
                "title",
                "tempo",
                "key",
                "progression_seed",
                "theme_hint",
            ]
        )
        for song in sorted(album.songs, key=lambda item: item.track_number):
            writer.writerow(
                [
                    song.track_number,
                    song.title,
                    song.tempo or recommended_tempo,
                    song.key or "C major",
                    "-".join(_seed_progression(song)),
                    (
                        song.themes[0]
                        if song.themes
                        else (album.central_themes[0] if album.central_themes else "")
                    ),
                ]
            )
    files.append("arrangement_map.csv")

    if "ableton" in requested_targets:
        ableton_payload = {
            "daw": "ableton_live",
            "recommended_bpm": recommended_tempo,
            "tracks": [
                {
                    "track_number": song.track_number,
                    "name": song.title,
                    "key": song.key or "C major",
                    "guide_progression": _seed_progression(song),
                }
                for song in sorted(album.songs, key=lambda item: item.track_number)
            ],
            "scene_labels": [f"Scene {index + 1}" for index in range(max(len(album.songs), 1))],
            "production_palette": analyzer.style_fingerprint.production_palette[:6],
        }
        _write_json("ableton_live_template.json", ableton_payload)

    if "logic" in requested_targets:
        logic_payload = {
            "daw": "logic_pro",
            "recommended_bpm": recommended_tempo,
            "track_stacks": [
                {
                    "track_number": song.track_number,
                    "name": song.title,
                    "instrument_suggestion": (
                        song.instrumentation[0] if song.instrumentation else "hybrid synth"
                    ),
                    "guide_progression": _seed_progression(song),
                }
                for song in sorted(album.songs, key=lambda item: item.track_number)
            ],
            "arrangement_notes": analyzer.arrangement_cues[:3],
            "lyric_devices": analyzer.lyric_devices[:3],
        }
        _write_json("logic_pro_template.json", logic_payload)

    if data.include_midi_guides:
        try:
            from album_conceptualizer.export.midi import MidiExporter
        except ImportError:
            _write_text(
                "midi_guides_unavailable.txt",
                "MIDI dependencies are missing. Install with `pip install .[music]` to generate MIDI guides.",
            )
        else:
            exporter = MidiExporter(default_tempo=recommended_tempo)
            for song in sorted(album.songs, key=lambda item: item.track_number):
                midi_name = f"{song.track_number:02d}_{_safe_slug(song.title)}_guide.mid"
                midi_path = bundle_dir / midi_name
                exporter.export_from_symbols(
                    _seed_progression(song), midi_path, tempo=recommended_tempo
                )
                files.append(midi_name)

    zip_path = bundle_dir.with_suffix(".zip")
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for file_name in files:
            archive.write(bundle_dir / file_name, arcname=file_name)

    return DawHandoffResponse(
        bundle_dir=str(bundle_dir),
        zip_path=str(zip_path),
        files=sorted(files),
        recommended_tempo=recommended_tempo,
        daw_targets=sorted(requested_targets),
        analysis_summary=analyzer.style_fingerprint.suggested_prompt,
    )


@router.get("/experience/templates", response_model=list[MarketplaceTemplate])
async def list_templates(
    genre: str | None = Query(None, description="Optional genre filter"),
) -> list[MarketplaceTemplate]:
    """List available template marketplace packs."""
    if not genre:
        return TEMPLATE_MARKETPLACE
    lowered = genre.strip().lower()
    return [template for template in TEMPLATE_MARKETPLACE if template.genre.lower() == lowered]


@router.post(
    "/albums/{album_id}/experience/templates/{template_id}/apply",
    response_model=ApplyTemplateResponse,
)
async def apply_template(
    request: Request,
    album_id: str,
    template_id: str,
    data: ApplyTemplateRequest,
) -> ApplyTemplateResponse:
    """Apply a marketplace template to an album."""
    album_store = get_album_store(request)
    album = _get_album(request, album_id)
    template = _get_template(template_id)
    updated_fields: list[str] = []
    added_tracks: list[str] = []

    if data.mode == "replace" or not album.concept_summary:
        album.concept_summary = template.concept_seed
        updated_fields.append("concept_summary")
    if data.mode == "replace" or not album.primary_genre:
        album.primary_genre = template.genre
        updated_fields.append("primary_genre")

    if data.mode == "replace":
        album.central_themes = list(template.theme_seed)
        updated_fields.append("central_themes")
    else:
        for theme in template.theme_seed:
            if theme not in album.central_themes:
                album.central_themes.append(theme)
                if "central_themes" not in updated_fields:
                    updated_fields.append("central_themes")

    if data.add_tracks:
        existing_titles = {song.title.lower() for song in album.songs}
        next_track = max((song.track_number for song in album.songs), default=0) + 1
        for blueprint in template.track_blueprints:
            if blueprint.title.lower() in existing_titles:
                continue
            album.songs.append(
                Song(
                    title=blueprint.title,
                    track_number=next_track,
                    narrative_summary=blueprint.narrative_summary,
                    sections=[
                        Section(
                            section_type=SectionType.VERSE,
                            order=1,
                            lyrics=None,
                            chord_progression=blueprint.chord_seed,
                        )
                    ],
                )
            )
            added_tracks.append(blueprint.title)
            existing_titles.add(blueprint.title.lower())
            next_track += 1
        if added_tracks:
            album.songs.sort(key=lambda song: song.track_number)

    album_store.save(album)
    return ApplyTemplateResponse(
        template_id=template.id,
        mode=data.mode,
        added_tracks=added_tracks,
        updated_fields=updated_fields,
        album=album,
    )


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


@router.post("/albums/{album_id}/experience/audio-preview", response_model=AudioPreviewResponse)
async def build_audio_preview(
    request: Request,
    album_id: str,
    data: AudioPreviewRequest,
) -> AudioPreviewResponse:
    """Generate a rough MIDI preview from album chord progressions."""
    album = _get_album(request, album_id)
    songs = sorted(album.songs, key=lambda song: song.track_number)
    if data.track_numbers:
        selected = set(data.track_numbers)
        songs = [song for song in songs if song.track_number in selected]
    if not songs:
        raise HTTPException(status_code=400, detail="No songs selected for preview")

    all_chords: list[str] = []
    track_summaries: list[AudioPreviewTrack] = []
    tempo_votes: list[int] = []

    for song in songs:
        chord_seed = _seed_progression(song)
        seed_source = "default"
        for section in song.sections:
            if section.chord_progression:
                chord_seed = section.chord_progression[:8]
                seed_source = "section"
                break
        tempo = data.tempo_override or song.tempo or 120
        tempo_votes.append(tempo)
        all_chords.extend(chord_seed)
        track_summaries.append(
            AudioPreviewTrack(
                track_number=song.track_number,
                song_title=song.title,
                tempo=tempo,
                chord_count=len(chord_seed),
                seed_source=seed_source,
            )
        )

    preview_tempo = data.tempo_override or int(median(tempo_votes))
    estimated_seconds = 0
    for track in track_summaries:
        estimated_seconds += int(track.chord_count * data.bars_per_chord * 4 * (60 / track.tempo))

    preview_dir = Path("output/previews") / str(album.id)
    preview_dir.mkdir(parents=True, exist_ok=True)
    preview_name = (
        f"{_safe_slug(album.title)}_preview_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.mid"
    )
    preview_path = preview_dir / preview_name

    try:
        from album_conceptualizer.export.midi import MidiExporter, midi_to_audio_info
    except ImportError as exc:
        raise HTTPException(
            status_code=501,
            detail="MIDI preview requires music dependencies (`pip install .[music]`).",
        ) from exc

    exporter = MidiExporter(default_tempo=preview_tempo)
    exporter.export_from_symbols(all_chords, preview_path, tempo=preview_tempo)

    return AudioPreviewResponse(
        file_path=str(preview_path),
        estimated_duration_seconds=estimated_seconds,
        tracks=track_summaries,
        render_hint=midi_to_audio_info().strip(),
    )


@router.get(
    "/albums/{album_id}/experience/release-campaign",
    response_model=ReleaseCampaignResponse,
)
async def get_release_campaign(
    request: Request,
    album_id: str,
    launch_date: str | None = Query(
        None, description="Launch date in YYYY-MM-DD format (defaults to 14 days from today)."
    ),
    duration_days: int = Query(14, ge=7, le=60),
) -> ReleaseCampaignResponse:
    """Generate a channel-by-channel release campaign schedule."""
    album = _get_album(request, album_id)
    launch = _resolve_launch_date(launch_date)
    return _compose_release_campaign_payload(album, launch, duration_days)
