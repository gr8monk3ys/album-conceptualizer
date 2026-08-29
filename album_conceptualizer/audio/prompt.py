"""Build a text-to-music prompt from an album's own world.

The point of this module is the product's whole thesis. A generator prompt
assembled per-song in isolation produces twelve unrelated tracks; assembled
from the album's style bible it produces twelve tracks that sound like one
record. Everything here reads from album-level fields first and song-level
fields second, so the album voice is what survives when the prompt has to be
truncated.

Mirrors `apps/web/src/server/handoff-pack.ts::buildGeneratorPrompt`, which
builds the same brief for a human to paste into an external generator. Keep
the two aligned: the whole value is that the in-app render and the exported
brief describe the same record.
"""

from __future__ import annotations

from dataclasses import dataclass, field


# Most hosted music models take a single free-text prompt with a practical
# ceiling well under this; past it, providers truncate silently and the tail
# of the prompt -- which is where song-specific detail lives -- is what gets
# lost. Truncating deliberately, album-first, keeps that failure legible.
MAX_PROMPT_CHARS = 900


@dataclass
class GenerationBrief:
    """Everything the prompt builder is allowed to look at.

    A plain dataclass rather than the pydantic `Album`/`Song` models on
    purpose: this keeps prompt construction testable without constructing a
    whole album, and makes it obvious at a glance which fields reach a
    third-party provider.
    """

    song_title: str
    album_genre: str | None = None
    concept_summary: str | None = None
    lead_voice: str | None = None
    sonic_palette: list[str] = field(default_factory=list)
    emotional_targets: list[str] = field(default_factory=list)
    avoid_list: list[str] = field(default_factory=list)
    tempo: int | None = None
    key: str | None = None
    mood_tags: list[str] = field(default_factory=list)
    instrumentation: list[str] = field(default_factory=list)
    narrative_summary: str | None = None
    duration_seconds: int = 30
    instrumental: bool = True


def _clean(value: str | None) -> str:
    return " ".join((value or "").split())


def _join(values: list[str], limit: int) -> str:
    seen: list[str] = []
    for raw in values:
        item = _clean(raw)
        # Case-insensitive dedupe: style bibles routinely carry "Warm Analog"
        # album-wide and "warm analog" on a song, and a prompt that says the
        # same thing twice spends its budget saying it twice.
        if item and item.lower() not in {s.lower() for s in seen}:
            seen.append(item)
        if len(seen) >= limit:
            break
    return ", ".join(seen)


def build_generation_prompt(brief: GenerationBrief) -> str:
    """A single prompt string, ordered album-identity first.

    Order is load-bearing. Providers weight earlier tokens more heavily and
    truncate from the end, so genre and voice lead, and the song's own detail
    follows. A song that loses its tempo hint still sounds like the album; a
    song that loses the album voice does not.
    """
    parts: list[str] = []

    genre = _clean(brief.album_genre)
    if genre:
        parts.append(genre)

    voice = _clean(brief.lead_voice)
    if voice:
        # "instrumental" and a described lead vocal are contradictory
        # instructions; models resolve that unpredictably, so only one of the
        # two ever reaches the provider.
        parts.append(f"instrumental, no vocals, {voice} melodic lead" if brief.instrumental
                     else f"lead vocal: {voice}")
    elif brief.instrumental:
        parts.append("instrumental, no vocals")

    palette = _join(brief.sonic_palette, 6)
    if palette:
        parts.append(palette)

    instrumentation = _join(brief.instrumentation, 6)
    if instrumentation:
        parts.append(instrumentation)

    mood = _join(brief.mood_tags + brief.emotional_targets, 5)
    if mood:
        parts.append(mood)

    if brief.tempo:
        parts.append(f"{brief.tempo} bpm")
    key = _clean(brief.key)
    if key:
        parts.append(f"key of {key}")

    narrative = _clean(brief.narrative_summary) or _clean(brief.concept_summary)
    if narrative:
        parts.append(narrative)

    prompt = ", ".join(p for p in parts if p)
    if len(prompt) <= MAX_PROMPT_CHARS:
        return prompt

    # Drop whole trailing clauses rather than cutting mid-phrase: a prompt
    # ending in "warm analo" is worse than one that simply says less.
    kept: list[str] = []
    used = 0
    for part in parts:
        cost = len(part) + (2 if kept else 0)
        if used + cost > MAX_PROMPT_CHARS:
            break
        kept.append(part)
        used += cost
    return ", ".join(kept)


def build_negative_prompt(brief: GenerationBrief) -> str:
    """The album's avoid-list, as a negative prompt.

    Empty string when the album has no avoid-list -- providers treat an empty
    negative prompt as "no constraint", which is the honest default. Callers
    must not substitute a house default here: an avoid-list nobody wrote is a
    creative decision the product has no business making.
    """
    return _join(brief.avoid_list, 12)
