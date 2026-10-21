"""Album snapshots: album JSON sent by a caller that owns the album.

The web app keeps albums in its own database and sends the engine a snapshot of the album
JSON with each stateless request (export, agent workflows). This module is the single place
that turns such a snapshot into engine models. It is deliberately lenient: ids that are not
UUIDs are regenerated, unknown section types become ``other``, optional numbers outside the
engine's range (tempo 0, release year 1850) are cleared, unreadable timestamps fall back to
defaults and null lists read as empty, so a snapshot that the web app accepted is never
rejected by the engine for cosmetic reasons.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, TypeAdapter, ValidationError

from album_conceptualizer.models.album import Album, Section, SectionType, Song
from album_conceptualizer.models.album_bible import (
    AlbumBible,
    Character,
    Motif,
    StyleProfile,
    Theme,
)


_SECTION_TYPES = {member.value for member in SectionType}
_SECTION_ALIASES = {
    "prechorus": "pre_chorus",
    "pre-chorus": "pre_chorus",
    "postchorus": "post_chorus",
    "post-chorus": "post_chorus",
    "hook": "chorus",
    "refrain": "chorus",
}


# Optional numbers the engine bounds but the web app does not: out-of-range values are cleared.
_BOUNDED_INTS: dict[type[BaseModel], dict[str, tuple[int, int | None]]] = {
    Album: {"release_year": (1900, 2100)},
    Song: {"tempo": (1, None), "duration_seconds": (1, None)},
    Section: {"duration_bars": (1, None)},
}
_TIMESTAMPS = ("created_at", "updated_at")
_DATETIME = TypeAdapter(datetime)


def _str_list_fields(model: type[BaseModel]) -> tuple[str, ...]:
    return tuple(name for name, f in model.model_fields.items() if f.annotation == list[str])


_LIST_FIELDS: dict[type[BaseModel], tuple[str, ...]] = {
    model: _str_list_fields(model) for model in (Album, Song, Section)
}


class InvalidSnapshotError(ValueError):
    """Raised when a snapshot cannot be read as an album."""


def _is_uuid(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    try:
        UUID(value)
    except ValueError:
        return False
    return True


def _section_type(value: Any) -> str:
    token = str(value or "").strip().lower().replace(" ", "_")
    token = _SECTION_ALIASES.get(token, token)
    return token if token in _SECTION_TYPES else SectionType.OTHER.value


def _without_bad_id(item: dict[str, Any]) -> dict[str, Any]:
    if "id" in item and not _is_uuid(item["id"]):
        return {key: value for key, value in item.items() if key != "id"}
    return item


def _bounded_int(value: Any, low: int, high: int | None) -> int | None:
    if isinstance(value, bool) or not isinstance(value, int | float):
        return None
    if isinstance(value, float) and not value.is_integer():
        return None
    number = int(value)
    if number < low or (high is not None and number > high):
        return None
    return number


def _lenient(item: dict[str, Any], model: type[BaseModel]) -> dict[str, Any]:
    """Clear the optional fields of ``item`` that ``model`` would reject for cosmetic reasons."""
    data = _without_bad_id(item)
    for name, (low, high) in _BOUNDED_INTS[model].items():
        if name in data:
            data[name] = _bounded_int(data[name], low, high)
    for name in _LIST_FIELDS[model]:
        if name in data:
            value = data[name]
            if value is None:
                data[name] = []
            elif isinstance(value, list):
                data[name] = [entry for entry in value if entry is not None]
    if model is Album:
        for name in _TIMESTAMPS:
            if name in data:
                try:
                    _DATETIME.validate_python(data[name])
                except ValidationError:
                    del data[name]  # the model's default applies
    return data


def album_from_snapshot(snapshot: Any) -> Album:
    """Read an album snapshot into an :class:`Album`.

    Raises :class:`InvalidSnapshotError` when the snapshot is not an album at all (not an
    object, missing a title, malformed songs).
    """
    if not isinstance(snapshot, dict):
        raise InvalidSnapshotError("Album snapshot must be a JSON object.")

    data = _lenient(dict(snapshot), Album)
    songs = []
    for raw_song in data.get("songs") or []:
        if not isinstance(raw_song, dict):
            raise InvalidSnapshotError("Each song in the snapshot must be a JSON object.")
        song = _lenient(dict(raw_song), Song)
        sections = []
        for raw_section in song.get("sections") or []:
            if not isinstance(raw_section, dict):
                raise InvalidSnapshotError("Each section in the snapshot must be a JSON object.")
            section = _lenient(dict(raw_section), Section)
            section["section_type"] = _section_type(section.get("section_type"))
            sections.append(section)
        song["sections"] = sections
        songs.append(song)
    data["songs"] = songs

    try:
        return Album.model_validate(data)
    except ValueError as exc:
        raise InvalidSnapshotError(f"Invalid album snapshot: {exc}") from exc


def _clean_list(values: Any) -> list[str]:
    if not isinstance(values, list):
        return []
    seen: set[str] = set()
    cleaned: list[str] = []
    for value in values:
        token = str(value).strip() if value is not None else ""
        if token and token.lower() not in seen:
            seen.add(token.lower())
            cleaned.append(token)
    return cleaned


def _tracks_mentioning(album: Album, attribute: str, name: str) -> list[int]:
    key = name.lower()
    tracks = []
    for song in album.songs:
        values = getattr(song, attribute, None) or []
        if any(str(value).strip().lower() == key for value in values):
            tracks.append(song.track_number)
    return tracks


def bible_from_album(album: Album, style_bible: dict[str, Any] | None = None) -> AlbumBible:
    """Derive an Album Bible from an album's own fields.

    Album-level themes and motifs come first; song-level ones are folded in so a theme that
    lives only on tracks still reaches the agents. ``style_bible`` is the web app's voice and
    style bible (``album.style_bible`` in the snapshot).
    """
    style = style_bible if isinstance(style_bible, dict) else {}

    theme_names = _clean_list(
        list(album.central_themes) + [t for song in album.songs for t in song.themes]
    )
    motif_names = _clean_list(
        list(album.recurring_motifs) + [m for song in album.songs for m in song.motifs]
    )
    character_names = _clean_list([c for song in album.songs for c in song.characters])

    themes = [
        Theme(
            name=name,
            description=f"Theme carried across the album: {name}.",
            primary_songs=_tracks_mentioning(album, "themes", name),
        )
        for name in theme_names
    ]
    motifs = [
        Motif(
            name=name,
            motif_type="lyrical",
            description=f"Recurring motif: {name}.",
            appearances=[
                {"track_number": track} for track in _tracks_mentioning(album, "motifs", name)
            ],
        )
        for name in motif_names
    ]
    characters = [
        Character(
            name=name,
            role="character",
            description=f"Appears in the album narrative as {name}.",
            appears_in=_tracks_mentioning(album, "characters", name),
        )
        for name in character_names
    ]

    style_profile = None
    if album.primary_genre or style:
        tone_parts = [
            str(style.get(key)).strip()
            for key in ("lead_voice", "narrator_perspective")
            if style.get(key)
        ]
        production_parts = [
            f"{label}: {', '.join(_clean_list(style.get(key)))}"
            for key, label in (
                ("sonic_palette", "Sonic palette"),
                ("arrangement_rules", "Arrangement rules"),
                ("mix_priorities", "Mix priorities"),
                ("avoid_list", "Avoid"),
            )
            if _clean_list(style.get(key))
        ]
        style_profile = StyleProfile(
            primary_genre=album.primary_genre or "unspecified",
            subgenres=list(album.secondary_genres),
            era_influence=album.era_influence,
            reference_albums=list(album.reference_albums),
            production_notes="; ".join(production_parts) or None,
            lyrical_tone="; ".join(tone_parts) or None,
            vocabulary_notes=", ".join(_clean_list(style.get("emotional_targets"))) or None,
        )

    summary = (album.concept_summary or "").strip()
    logline = summary.split(". ")[0].strip() if summary else album.title
    return AlbumBible(
        album_title=album.title,
        artist=album.artist,
        logline=logline,
        synopsis=summary or f"{album.title}: a concept album in progress.",
        themes=themes,
        motifs=motifs,
        characters=characters,
        style_profile=style_profile,
        audio_references=list(album.reference_albums),
        visual_references=list(album.visual_inspiration),
    )
