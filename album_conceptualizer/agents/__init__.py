"""Multi-agent system for concept album creation using CrewAI."""

# Output parsing (no crewai dependency)
from album_conceptualizer.agents.output_parser import (
    CoherenceReviewResult,
    OutputParser,
    SongBlueprint,
    SongDevelopmentResult,
    VisionResult,
)
from album_conceptualizer.agents.result_converter import (
    song_dev_to_song,
    vision_to_album,
)

# CrewAI-dependent imports are optional since crewai is an optional dependency
try:
    from album_conceptualizer.agents.crew import (
        AlbumCrewManager,
        create_album_ideation_crew,
        create_coherence_review_crew,
        create_song_development_crew,
    )
    from album_conceptualizer.agents.director import create_director_agent
    from album_conceptualizer.agents.lyricist import create_lyricist_agent
    from album_conceptualizer.agents.music_theorist import create_music_theorist_agent
    from album_conceptualizer.agents.narrative import create_narrative_agent
    from album_conceptualizer.agents.style_matcher import create_style_matcher_agent

    _HAS_CREWAI = True
except ImportError:
    _HAS_CREWAI = False


__all__ = [
    # Output parsing (always available)
    "CoherenceReviewResult",
    "OutputParser",
    "SongBlueprint",
    "SongDevelopmentResult",
    "VisionResult",
    "song_dev_to_song",
    "vision_to_album",
    # CrewAI-dependent (available when crewai is installed)
    "AlbumCrewManager",
    "create_album_ideation_crew",
    "create_coherence_review_crew",
    "create_director_agent",
    "create_lyricist_agent",
    "create_music_theorist_agent",
    "create_narrative_agent",
    "create_song_development_crew",
    "create_style_matcher_agent",
]
