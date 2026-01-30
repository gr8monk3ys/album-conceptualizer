"""Multi-agent system for concept album creation using CrewAI."""

from album_conceptualizer.agents.lyricist import create_lyricist_agent
from album_conceptualizer.agents.music_theorist import create_music_theorist_agent
from album_conceptualizer.agents.narrative import create_narrative_agent
from album_conceptualizer.agents.style_matcher import create_style_matcher_agent
from album_conceptualizer.agents.director import create_director_agent
from album_conceptualizer.agents.crew import (
    AlbumCrewManager,
    create_album_ideation_crew,
    create_song_development_crew,
)

__all__ = [
    "create_lyricist_agent",
    "create_music_theorist_agent",
    "create_narrative_agent",
    "create_style_matcher_agent",
    "create_director_agent",
    "AlbumCrewManager",
    "create_album_ideation_crew",
    "create_song_development_crew",
]
