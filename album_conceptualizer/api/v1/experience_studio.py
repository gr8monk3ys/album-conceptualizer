"""Studio experience endpoints: prompt packs, style capture, jam mode, timeline, coach, templates, audio preview."""

from __future__ import annotations

from collections import Counter
from datetime import datetime
from pathlib import Path
from statistics import median

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from album_conceptualizer.models.album import Album, Section, SectionType, Song

from .albums import get_album_store
from .experience_shared import (
    PromptPack,
    ReferenceTrackInput,
    _dedupe_tokens,
    _extract_root,
    _get_album,
    _get_bible,
    _load_challenge_profile,
    _profile_id_for_request,
    _safe_slug,
    _seed_progression,
)


router = APIRouter()


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

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


# -- Models (studio-specific) --


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


# ---------------------------------------------------------------------------
# Studio-only helpers
# ---------------------------------------------------------------------------


def _pick_pack(pack_id: str | None) -> PromptPack:
    if not pack_id:
        return PROMPT_PACKS[0]
    for pack in PROMPT_PACKS:
        if pack.id == pack_id:
            return pack
    raise HTTPException(status_code=404, detail="Prompt pack not found")


def _readiness_tier(score: int) -> str:
    if score >= 85:
        return "launch-ready"
    if score >= 65:
        return "beta-ready"
    if score >= 40:
        return "prototype"
    return "early-draft"


def _get_template(template_id: str) -> MarketplaceTemplate:
    for template in TEMPLATE_MARKETPLACE:
        if template.id == template_id:
            return template
    raise HTTPException(status_code=404, detail="Template not found")


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
    for harmonic_sig, titles in harmonic_groups.items():
        if len(titles) < 2:
            continue
        cluster_rows.append(
            ReferenceCluster(
                label=f"harmony:{harmonic_sig}",
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


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


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
