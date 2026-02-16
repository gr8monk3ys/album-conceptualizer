"""Convert parsed agent output into project models."""
from __future__ import annotations

import logging

from album_conceptualizer.agents.output_parser import (
    SongDevelopmentResult,
    VisionResult,
)
from album_conceptualizer.models.album import Album, Section, SectionType, Song

logger = logging.getLogger("album_conceptualizer.agents.result_converter")

SECTION_TYPE_MAP: dict[str, SectionType] = {
    "intro": SectionType.INTRO,
    "verse": SectionType.VERSE,
    "verse_1": SectionType.VERSE,
    "verse_2": SectionType.VERSE,
    "verse_3": SectionType.VERSE,
    "pre_chorus": SectionType.PRE_CHORUS,
    "pre-chorus": SectionType.PRE_CHORUS,
    "prechorus": SectionType.PRE_CHORUS,
    "chorus": SectionType.CHORUS,
    "post_chorus": SectionType.POST_CHORUS,
    "post-chorus": SectionType.POST_CHORUS,
    "bridge": SectionType.BRIDGE,
    "breakdown": SectionType.BREAKDOWN,
    "solo": SectionType.SOLO,
    "interlude": SectionType.INTERLUDE,
    "outro": SectionType.OUTRO,
    "tag": SectionType.TAG,
}


def vision_to_album(result: VisionResult) -> Album:
    """Convert a VisionResult into an Album model."""
    return Album(
        title=result.album_title or "Untitled Album",
        concept_summary=result.concept_summary or None,
        narrative_structure=result.narrative_structure or None,
        primary_genre=result.primary_genre or None,
        secondary_genres=result.secondary_genres,
        central_themes=result.central_themes,
        era_influence=result.era_influence or None,
    )


def song_dev_to_song(
    result: SongDevelopmentResult, title: str, track_number: int
) -> Song:
    """Convert a SongDevelopmentResult into a Song model."""
    sections: list[Section] = []
    order = 0

    # Build sections from lyrics and/or chord progressions
    all_section_keys = set(
        list(result.lyrics.keys()) + list(result.chord_progressions.keys())
    )

    for section_key in sorted(all_section_keys):
        section_type = SECTION_TYPE_MAP.get(section_key, SectionType.OTHER)
        lyrics = result.lyrics.get(section_key)
        chords = result.chord_progressions.get(section_key, [])

        sections.append(
            Section(
                section_type=section_type,
                order=order,
                lyrics=lyrics,
                chord_progression=chords,
            )
        )
        order += 1

    return Song(
        title=title,
        track_number=track_number,
        sections=sections,
        key=result.key,
        tempo=result.tempo,
        production_notes=result.production_notes or None,
        instrumentation=result.instrumentation,
    )
