"""Release experience endpoints: release kit, campaign, DAW handoff."""

from __future__ import annotations

import csv
import json
import zipfile
from datetime import date, datetime, timedelta
from pathlib import Path
from statistics import median
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from album_conceptualizer.models.album import Album
from album_conceptualizer.models.album_bible import AlbumBible

from .experience_shared import (
    ReferenceTrackInput,
    _dedupe_tokens,
    _get_album,
    _get_bible,
    _load_challenge_profile,
    _profile_id_for_request,
    _safe_slug,
    _seed_progression,
)
from .experience_studio import (
    ReferenceAnalyzerRequest,
    _build_reference_analyzer_response,
)


router = APIRouter()


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

VALID_DAW_TARGETS = {"ableton", "logic"}


# -- Models (release-specific) --


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


# ---------------------------------------------------------------------------
# Release-only helpers
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


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
