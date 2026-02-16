"""Structured output parsing for CrewAI agent results."""
from __future__ import annotations

import json
import logging
import re

from pydantic import BaseModel, Field, field_validator

logger = logging.getLogger("album_conceptualizer.agents.output_parser")


class VisionResult(BaseModel):
    """Parsed output from the vision crew."""

    album_title: str = ""
    concept_summary: str = ""
    narrative_structure: str = ""
    primary_genre: str = ""
    secondary_genres: list[str] = Field(default_factory=list)
    central_themes: list[str] = Field(default_factory=list)
    target_track_count: int = 10
    era_influence: str = ""
    style_notes: str = ""

    @field_validator("central_themes", "secondary_genres", mode="before")
    @classmethod
    def _ensure_list(cls, v):
        if isinstance(v, str):
            return [item.strip() for item in v.split(",") if item.strip()]
        return v or []


class SongBlueprint(BaseModel):
    """A single song from the vision crew."""

    track_number: int = 0
    title: str = ""
    key: str | None = None
    tempo: int | None = None
    mood: str = ""
    narrative_position: str = ""
    themes: list[str] = Field(default_factory=list)
    suggested_structure: str = ""


class SongDevelopmentResult(BaseModel):
    """Parsed output from a song development crew."""

    lyrics: dict[str, str] = Field(
        default_factory=dict, description="Section type -> lyrics"
    )
    chord_progressions: dict[str, list[str]] = Field(
        default_factory=dict, description="Section type -> chord list"
    )
    production_notes: str = ""
    instrumentation: list[str] = Field(default_factory=list)
    key: str | None = None
    tempo: int | None = None
    narrative_validation: str = ""
    quality_score: float = 0.0  # 0-1, how much data was successfully extracted


class CoherenceReviewResult(BaseModel):
    """Parsed output from a coherence review crew."""

    overall_score: float = Field(default=0.0, ge=0.0, le=1.0)
    lyrical_coherence: str = ""
    harmonic_coherence: str = ""
    narrative_coherence: str = ""
    style_coherence: str = ""
    director_notes: str = ""
    issues: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)


class OutputParser:
    """Parse raw crew output into structured results."""

    @staticmethod
    def parse_vision(raw: str) -> VisionResult:
        """Parse raw vision crew output into VisionResult."""
        result = VisionResult()

        # Try JSON first
        json_data = OutputParser._extract_json(raw)
        if json_data:
            try:
                return VisionResult.model_validate(json_data)
            except Exception:
                pass

        # Fall back to text parsing with section headers
        sections = OutputParser._split_sections(raw)

        for header, content in sections.items():
            header_lower = header.lower()
            if "title" in header_lower and "album" in header_lower:
                result.album_title = content.strip().strip("\"'")
            elif "concept" in header_lower or "summary" in header_lower:
                result.concept_summary = content.strip()
            elif "narrative" in header_lower and "structure" in header_lower:
                result.narrative_structure = content.strip()
            elif "genre" in header_lower:
                if "primary" in header_lower:
                    result.primary_genre = content.strip()
                elif "secondary" in header_lower:
                    result.secondary_genres = [
                        g.strip() for g in content.split(",") if g.strip()
                    ]
            elif "theme" in header_lower:
                result.central_themes = [
                    t.strip().strip("-\u2022* ")
                    for t in content.split("\n")
                    if t.strip().strip("-\u2022* ")
                ]
            elif "style" in header_lower:
                result.style_notes = content.strip()
            elif "era" in header_lower or "influence" in header_lower:
                result.era_influence = content.strip()

        # Try to find album title in first line if not found
        if not result.album_title:
            first_line = raw.strip().split("\n")[0].strip() if raw.strip() else ""
            if first_line and len(first_line) < 100 and not first_line.startswith(("#", "-", "*")):
                result.album_title = first_line.strip("\"'#: ")

        return result

    @staticmethod
    def parse_song_development(raw: str) -> SongDevelopmentResult:
        """Parse raw song development crew output."""
        result = SongDevelopmentResult()

        # Try JSON first
        json_data = OutputParser._extract_json(raw)
        if json_data:
            try:
                return SongDevelopmentResult.model_validate(json_data)
            except Exception:
                pass

        sections = OutputParser._split_sections(raw)
        extracted_count = 0
        total_sections = 4  # lyrics, chords, production, validation

        for header, content in sections.items():
            header_lower = header.lower()

            if "lyric" in header_lower:
                # Parse section lyrics
                current_section = "verse"
                for line in content.split("\n"):
                    bracket_match = re.match(r"\[([^\]]+)\]", line)
                    if bracket_match:
                        current_section = (
                            bracket_match.group(1).lower().replace(" ", "_")
                        )
                    elif line.strip():
                        existing = result.lyrics.get(current_section, "")
                        result.lyrics[current_section] = (
                            existing + "\n" + line.strip()
                        ).strip()
                if result.lyrics:
                    extracted_count += 1

            elif (
                "chord" in header_lower
                or "harmony" in header_lower
                or "progression" in header_lower
            ):
                # Parse chord progressions per section
                current_section = "verse"
                for line in content.split("\n"):
                    bracket_match = re.match(r"\[([^\]]+)\]", line)
                    if bracket_match:
                        current_section = (
                            bracket_match.group(1).lower().replace(" ", "_")
                        )
                    else:
                        # Look for chord patterns: C - Am - F - G or C | Am | F | G
                        chords = re.findall(
                            r"[A-G][#b]?(?:m(?:aj)?|dim|aug|sus[24]?|add\d+)?(?:\d+)?(?:/[A-G][#b]?)?",
                            line,
                        )
                        if chords:
                            existing = result.chord_progressions.get(
                                current_section, []
                            )
                            result.chord_progressions[current_section] = (
                                existing + chords
                            )
                if result.chord_progressions:
                    extracted_count += 1

            elif "production" in header_lower or "arrangement" in header_lower:
                result.production_notes = content.strip()
                extracted_count += 1

            elif "instrument" in header_lower:
                result.instrumentation = [
                    i.strip().strip("-\u2022* ")
                    for i in content.split("\n")
                    if i.strip().strip("-\u2022* ")
                ]

            elif "validation" in header_lower or "narrative" in header_lower:
                result.narrative_validation = content.strip()
                extracted_count += 1

            elif "key" in header_lower and len(content.strip()) < 20:
                result.key = content.strip()

            elif "tempo" in header_lower and len(content.strip()) < 20:
                tempo_match = re.search(r"(\d+)", content)
                if tempo_match:
                    result.tempo = int(tempo_match.group(1))

        result.quality_score = (
            extracted_count / total_sections if total_sections > 0 else 0.0
        )
        return result

    @staticmethod
    def parse_coherence_review(raw: str) -> CoherenceReviewResult:
        """Parse raw coherence review crew output."""
        result = CoherenceReviewResult()

        json_data = OutputParser._extract_json(raw)
        if json_data:
            try:
                return CoherenceReviewResult.model_validate(json_data)
            except Exception:
                pass

        sections = OutputParser._split_sections(raw)

        for header, content in sections.items():
            header_lower = header.lower()
            if "lyric" in header_lower and "coherence" in header_lower:
                result.lyrical_coherence = content.strip()
            elif "harmon" in header_lower and "coherence" in header_lower:
                result.harmonic_coherence = content.strip()
            elif "narrative" in header_lower and "coherence" in header_lower:
                result.narrative_coherence = content.strip()
            elif "style" in header_lower and "coherence" in header_lower:
                result.style_coherence = content.strip()
            elif "director" in header_lower or "final" in header_lower:
                result.director_notes = content.strip()
            elif "issue" in header_lower or "problem" in header_lower:
                result.issues = [
                    i.strip().strip("-\u2022* ")
                    for i in content.split("\n")
                    if i.strip().strip("-\u2022* ")
                ]
            elif "recommend" in header_lower or "suggestion" in header_lower:
                result.recommendations = [
                    r.strip().strip("-\u2022* ")
                    for r in content.split("\n")
                    if r.strip().strip("-\u2022* ")
                ]
            elif "score" in header_lower or "rating" in header_lower:
                score_match = re.search(
                    r"(\d+(?:\.\d+)?)\s*(?:/\s*(?:10|100|1\.0))?", content
                )
                if score_match:
                    val = float(score_match.group(1))
                    if val > 1:
                        val = val / (100 if val > 10 else 10)
                    result.overall_score = min(1.0, max(0.0, val))

        return result

    @staticmethod
    def _extract_json(text: str) -> dict | None:
        """Try to extract a JSON object from text."""
        # Look for ```json ... ``` blocks
        json_match = re.search(
            r"```(?:json)?\s*\n({.*?})\s*\n```", text, re.DOTALL
        )
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass

        # Look for bare JSON objects
        for match in re.finditer(r"\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}", text):
            try:
                data = json.loads(match.group())
                if len(data) >= 2:  # At least 2 keys to be useful
                    return data
            except json.JSONDecodeError:
                continue
        return None

    @staticmethod
    def _split_sections(text: str) -> dict[str, str]:
        """Split text into sections by markdown headers or labeled lines."""
        sections: dict[str, str] = {}
        current_header = ""
        current_content: list[str] = []

        for line in text.split("\n"):
            # Match markdown headers: ## Header or **Header**
            header_match = re.match(r"^#{1,4}\s+(.+?)$", line)
            if not header_match:
                header_match = re.match(r"^\*\*(.+?)\*\*\s*:?\s*$", line)
            if not header_match:
                # Match "Label:" patterns
                header_match = re.match(r"^([A-Z][a-zA-Z\s]+):\s*$", line)

            if header_match:
                if current_header:
                    sections[current_header] = "\n".join(current_content)
                current_header = header_match.group(1).strip()
                current_content = []
            else:
                current_content.append(line)

        if current_header:
            sections[current_header] = "\n".join(current_content)

        return sections
