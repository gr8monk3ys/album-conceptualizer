"""Tests for agent output parsing."""
import pytest

from album_conceptualizer.agents.output_parser import (
    CoherenceReviewResult,
    OutputParser,
    SongDevelopmentResult,
    VisionResult,
)


class TestOutputParser:
    """Test the OutputParser static methods."""

    def test_extract_json_from_code_block(self):
        text = '```json\n{"album_title": "Test", "primary_genre": "rock"}\n```'
        result = OutputParser._extract_json(text)
        assert result == {"album_title": "Test", "primary_genre": "rock"}

    def test_extract_json_bare(self):
        text = 'Some text {"key": "value", "other": 123} more text'
        result = OutputParser._extract_json(text)
        assert result == {"key": "value", "other": 123}

    def test_extract_json_none(self):
        assert OutputParser._extract_json("no json here") is None

    def test_split_sections_markdown(self):
        text = "## Title\ncontent1\n## Other\ncontent2"
        sections = OutputParser._split_sections(text)
        assert "Title" in sections
        assert "Other" in sections

    def test_split_sections_bold(self):
        text = "**Lyrics**\nverse content\n**Chords**\nC Am F G"
        sections = OutputParser._split_sections(text)
        assert "Lyrics" in sections
        assert "Chords" in sections

    def test_parse_vision_from_json(self):
        raw = '```json\n{"album_title": "The Journey", "primary_genre": "rock", "central_themes": ["love", "loss"]}\n```'
        result = OutputParser.parse_vision(raw)
        assert result.album_title == "The Journey"
        assert result.primary_genre == "rock"
        assert "love" in result.central_themes

    def test_parse_vision_from_text(self):
        raw = """## Album Title
The Journey Home

## Concept Summary
A story about finding your way back.

## Primary Genre
Progressive Rock

## Central Themes
- Loss
- Redemption
- Hope
"""
        result = OutputParser.parse_vision(raw)
        assert result.album_title == "The Journey Home"
        assert "Progressive Rock" in result.primary_genre
        assert len(result.central_themes) >= 2

    def test_parse_song_development_lyrics(self):
        raw = """## Lyrics
[Verse]
Walking down the road
Searching for my home

[Chorus]
I will find my way
Through the light of day

## Chord Progressions
[Verse]
C - Am - F - G
[Chorus]
F - G - C - Am

## Production Notes
Use acoustic guitar with light reverb.

## Instrumentation
- Acoustic guitar
- Piano
- Bass
"""
        result = OutputParser.parse_song_development(raw)
        assert "verse" in result.lyrics
        assert "chorus" in result.lyrics
        assert "verse" in result.chord_progressions
        assert result.production_notes
        assert len(result.instrumentation) >= 2
        assert result.quality_score > 0

    def test_parse_coherence_review(self):
        raw = """## Lyrical Coherence
The lyrics flow well across tracks.

## Harmonic Coherence
Key changes are smooth.

## Issues
- Track 3 feels disconnected
- Motif in track 7 is underdeveloped

## Recommendations
- Add a reprise of the main theme
- Strengthen the bridge in track 5

## Overall Score
8.5/10
"""
        result = OutputParser.parse_coherence_review(raw)
        assert result.lyrical_coherence
        assert result.harmonic_coherence
        assert len(result.issues) >= 2
        assert len(result.recommendations) >= 2
        assert 0.8 <= result.overall_score <= 0.9

    def test_quality_score_calculation(self):
        # Empty output should give 0 quality
        result = OutputParser.parse_song_development("")
        assert result.quality_score == 0.0

    def test_chord_extraction_regex(self):
        raw = """## Chords
[Verse]
Am - F - C - G
[Chorus]
F - C/E - Dm7 - G
"""
        result = OutputParser.parse_song_development(raw)
        assert "verse" in result.chord_progressions
        assert "Am" in result.chord_progressions["verse"]

    def test_vision_empty_input(self):
        result = OutputParser.parse_vision("")
        assert isinstance(result, VisionResult)
        assert result.album_title == ""

    def test_parse_vision_themes_as_csv_string(self):
        """Test that comma-separated theme strings are parsed into lists."""
        raw = '```json\n{"album_title": "X", "primary_genre": "pop", "central_themes": "love, loss, hope"}\n```'
        result = OutputParser.parse_vision(raw)
        assert isinstance(result.central_themes, list)
        assert "love" in result.central_themes
        assert "hope" in result.central_themes

    def test_parse_song_development_from_json(self):
        """Test JSON path for song development parsing."""
        raw = '```json\n{"lyrics": {"verse": "hello"}, "chord_progressions": {"verse": ["C", "Am"]}, "production_notes": "reverb", "quality_score": 0.75}\n```'
        result = OutputParser.parse_song_development(raw)
        assert result.lyrics == {"verse": "hello"}
        assert result.chord_progressions == {"verse": ["C", "Am"]}
        assert result.quality_score == 0.75

    def test_parse_coherence_review_from_json(self):
        """Test JSON path for coherence review parsing."""
        raw = '```json\n{"overall_score": 0.85, "lyrical_coherence": "good", "issues": ["minor gap"]}\n```'
        result = OutputParser.parse_coherence_review(raw)
        assert result.overall_score == 0.85
        assert result.lyrical_coherence == "good"
        assert result.issues == ["minor gap"]

    def test_parse_coherence_score_out_of_100(self):
        """Test that scores out of 100 are normalized to 0-1."""
        raw = """## Overall Score
85/100
"""
        result = OutputParser.parse_coherence_review(raw)
        assert 0.8 <= result.overall_score <= 0.9

    def test_split_sections_label_colon(self):
        """Test that 'Label:' pattern is recognized as a section header."""
        text = "Album Title:\nMy Album\nConcept Summary:\nA great album"
        sections = OutputParser._split_sections(text)
        assert "Album Title" in sections
        assert "Concept Summary" in sections

    def test_parse_song_development_tempo_extraction(self):
        """Test tempo extraction from text."""
        raw = """## Tempo
120 BPM

## Key
C major
"""
        result = OutputParser.parse_song_development(raw)
        assert result.tempo == 120
        assert result.key == "C major"

    def test_extract_json_skips_small_objects(self):
        """JSON objects with fewer than 2 keys are ignored."""
        text = 'Some text {"only_one": true} and more'
        result = OutputParser._extract_json(text)
        assert result is None

    def test_parse_vision_fallback_title_from_first_line(self):
        """When no section matches album title, use the first line."""
        raw = "Echoes of Tomorrow\n\nSome other content here."
        result = OutputParser.parse_vision(raw)
        assert result.album_title == "Echoes of Tomorrow"


class TestResultConverter:
    def test_vision_to_album(self):
        from album_conceptualizer.agents.result_converter import vision_to_album

        v = VisionResult(
            album_title="Test Album",
            primary_genre="rock",
            central_themes=["love"],
        )
        album = vision_to_album(v)
        assert album.title == "Test Album"
        assert album.primary_genre == "rock"

    def test_vision_to_album_defaults(self):
        """Empty VisionResult produces an album with 'Untitled Album'."""
        from album_conceptualizer.agents.result_converter import vision_to_album

        v = VisionResult()
        album = vision_to_album(v)
        assert album.title == "Untitled Album"

    def test_song_dev_to_song(self):
        from album_conceptualizer.agents.result_converter import song_dev_to_song

        sd = SongDevelopmentResult(
            lyrics={"verse": "hello world", "chorus": "goodbye world"},
            chord_progressions={"verse": ["C", "Am", "F", "G"]},
            key="C",
            tempo=120,
        )
        song = song_dev_to_song(sd, "Test Song", 1)
        assert song.title == "Test Song"
        assert song.track_number == 1
        assert len(song.sections) >= 2
        assert song.key == "C"
        assert song.tempo == 120

    def test_song_dev_to_song_section_types(self):
        """Verify that known section keys map to correct SectionType values."""
        from album_conceptualizer.agents.result_converter import song_dev_to_song
        from album_conceptualizer.models.album import SectionType

        sd = SongDevelopmentResult(
            lyrics={"bridge": "crossing over", "outro": "the end"},
        )
        song = song_dev_to_song(sd, "Bridge Song", 3)
        section_types = [s.section_type for s in song.sections]
        assert SectionType.BRIDGE in section_types
        assert SectionType.OUTRO in section_types

    def test_song_dev_to_song_unknown_section(self):
        """Unknown section keys should map to SectionType.OTHER."""
        from album_conceptualizer.agents.result_converter import song_dev_to_song
        from album_conceptualizer.models.album import SectionType

        sd = SongDevelopmentResult(
            lyrics={"freestyle": "improvised lyrics"},
        )
        song = song_dev_to_song(sd, "Free Song", 2)
        assert song.sections[0].section_type == SectionType.OTHER

    def test_song_dev_to_song_empty(self):
        """Empty SongDevelopmentResult produces a song with no sections."""
        from album_conceptualizer.agents.result_converter import song_dev_to_song

        sd = SongDevelopmentResult()
        song = song_dev_to_song(sd, "Empty Song", 1)
        assert song.title == "Empty Song"
        assert song.sections == []
