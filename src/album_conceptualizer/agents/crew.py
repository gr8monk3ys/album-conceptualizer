"""CrewAI crew configurations for album creation workflows."""

from typing import Optional

from crewai import Agent, Crew, Task, Process

from album_conceptualizer.agents.lyricist import create_lyricist_agent, LYRICIST_TASK_TEMPLATES
from album_conceptualizer.agents.music_theorist import (
    create_music_theorist_agent,
    MUSIC_THEORIST_TASK_TEMPLATES,
)
from album_conceptualizer.agents.narrative import create_narrative_agent, NARRATIVE_TASK_TEMPLATES
from album_conceptualizer.agents.style_matcher import (
    create_style_matcher_agent,
    STYLE_MATCHER_TASK_TEMPLATES,
)
from album_conceptualizer.agents.director import create_director_agent, DIRECTOR_TASK_TEMPLATES
from album_conceptualizer.agents.tools import create_agent_tools
from album_conceptualizer.rag.retriever import UnifiedRetriever
from album_conceptualizer.models.album_bible import AlbumBible


class AlbumCrewManager:
    """
    Manager for creating and running album creation crews.

    Provides pre-configured crews for different stages of album development.
    """

    def __init__(
        self,
        retriever: Optional[UnifiedRetriever] = None,
        llm: Optional[str] = None,
        verbose: bool = True,
    ):
        """
        Initialize the crew manager.

        Args:
            retriever: Unified retriever for RAG tools
            llm: LLM to use for agents
            verbose: Whether agents show their thinking
        """
        self.retriever = retriever
        self.llm = llm
        self.verbose = verbose

        # Create tools if retriever provided
        self.tools = create_agent_tools(retriever) if retriever else {}

        # Create agents
        self._init_agents()

    def _init_agents(self) -> None:
        """Initialize all agents."""
        self.director = create_director_agent(llm=self.llm, verbose=self.verbose)

        self.lyricist = create_lyricist_agent(
            lyrics_search_tool=self.tools.get("lyrics_search"),
            motif_tracker_tool=self.tools.get("motif_tracker"),
            llm=self.llm,
            verbose=self.verbose,
        )

        self.music_theorist = create_music_theorist_agent(
            chord_search_tool=self.tools.get("chord_search"),
            motif_tracker_tool=self.tools.get("motif_tracker"),
            llm=self.llm,
            verbose=self.verbose,
        )

        self.narrative_agent = create_narrative_agent(
            narrative_search_tool=self.tools.get("narrative_search"),
            motif_tracker_tool=self.tools.get("motif_tracker"),
            llm=self.llm,
            verbose=self.verbose,
        )

        self.style_matcher = create_style_matcher_agent(
            lyrics_search_tool=self.tools.get("lyrics_search"),
            chord_search_tool=self.tools.get("chord_search"),
            llm=self.llm,
            verbose=self.verbose,
        )

    def create_vision_crew(self, concept: str, references: str, **kwargs) -> Crew:
        """
        Create a crew for defining the album vision.

        This is typically the first step in album creation.
        """
        vision_task = Task(
            description=DIRECTOR_TASK_TEMPLATES["define_vision"].format(
                concept=concept,
                references=references,
                audience=kwargs.get("audience", "Not specified"),
                constraints=kwargs.get("constraints", "None specified"),
            ),
            expected_output="A comprehensive vision document for the album",
            agent=self.director,
        )

        style_task = Task(
            description=STYLE_MATCHER_TASK_TEMPLATES["define_album_style"].format(
                reference_artists=kwargs.get("reference_artists", "Not specified"),
                reference_albums=kwargs.get("reference_albums", "Not specified"),
                reference_tracks=kwargs.get("reference_tracks", "Not specified"),
                album_concept=concept,
                era_influence=kwargs.get("era_influence", "Not specified"),
            ),
            expected_output="A comprehensive style profile for the album",
            agent=self.style_matcher,
        )

        narrative_task = Task(
            description=NARRATIVE_TASK_TEMPLATES["develop_album_structure"].format(
                album_concept=concept,
                themes=kwargs.get("themes", "Not specified"),
                characters=kwargs.get("characters", "None"),
                track_count=kwargs.get("track_count", 10),
            ),
            expected_output="A narrative structure with beat sheet and character arcs",
            agent=self.narrative_agent,
        )

        return Crew(
            agents=[self.director, self.style_matcher, self.narrative_agent],
            tasks=[vision_task, style_task, narrative_task],
            process=Process.sequential,
            verbose=self.verbose,
            memory=True,
        )

    def create_song_development_crew(
        self,
        song_title: str,
        track_number: int,
        album_bible: AlbumBible,
        **kwargs,
    ) -> Crew:
        """
        Create a crew for developing a single song.

        Uses the album bible to ensure consistency.
        """
        # Extract context from album bible
        album_context = album_bible.to_summary()
        style_profile = (
            album_bible.style_profile.model_dump_json()
            if album_bible.style_profile
            else "Not defined"
        )

        # Lyricist writes lyrics
        lyrics_task = Task(
            description=LYRICIST_TASK_TEMPLATES["write_song_lyrics"].format(
                song_title=song_title,
                track_number=track_number,
                album_title=album_bible.album_title,
                album_context=album_context,
                narrative_position=kwargs.get("narrative_position", "Not specified"),
                themes=kwargs.get("themes", []),
                emotional_arc=kwargs.get("emotional_arc", "Not specified"),
                mood=kwargs.get("mood", "Not specified"),
                style_reference=kwargs.get("style_reference", "See album style"),
                song_structure=kwargs.get(
                    "song_structure",
                    "Verse 1 - Chorus - Verse 2 - Chorus - Bridge - Chorus",
                ),
                motifs=kwargs.get("motifs", "None specified"),
            ),
            expected_output="Complete lyrics for all sections of the song",
            agent=self.lyricist,
        )

        # Music theorist suggests harmony
        harmony_task = Task(
            description=MUSIC_THEORIST_TASK_TEMPLATES["suggest_progression"].format(
                song_title=song_title,
                track_number=track_number,
                themes=kwargs.get("themes", []),
                emotional_arc=kwargs.get("emotional_arc", "Not specified"),
                mood=kwargs.get("mood", "Not specified"),
                genre=kwargs.get("genre", "Not specified"),
                album_key=kwargs.get("album_key", "Not established"),
                previous_key=kwargs.get("previous_key", "N/A"),
                motifs=kwargs.get("musical_motifs", "None specified"),
                song_structure=kwargs.get(
                    "song_structure",
                    "Verse 1 - Chorus - Verse 2 - Chorus - Bridge - Chorus",
                ),
            ),
            expected_output="Chord progressions for each section with analysis",
            agent=self.music_theorist,
            context=[lyrics_task],  # Can see lyrics for better harmony
        )

        # Style matcher provides production notes
        production_task = Task(
            description=STYLE_MATCHER_TASK_TEMPLATES["production_notes_generation"].format(
                song_title=song_title,
                song_content=f"Track {track_number}: {song_title}",
                style_profile=style_profile,
                song_role=kwargs.get("narrative_position", "Not specified"),
            ),
            expected_output="Detailed production notes for the song",
            agent=self.style_matcher,
            context=[lyrics_task, harmony_task],
        )

        # Narrative agent validates
        validation_task = Task(
            description=NARRATIVE_TASK_TEMPLATES["validate_song_narrative"].format(
                song_title=song_title,
                track_number=track_number,
                song_content="[Will be filled from previous tasks]",
                album_narrative=album_context,
                previous_song=kwargs.get("previous_song", "N/A"),
                next_song=kwargs.get("next_song", "Not yet determined"),
            ),
            expected_output="Validation report with any issues and recommendations",
            agent=self.narrative_agent,
            context=[lyrics_task, harmony_task],
        )

        return Crew(
            agents=[self.lyricist, self.music_theorist, self.style_matcher, self.narrative_agent],
            tasks=[lyrics_task, harmony_task, production_task, validation_task],
            process=Process.sequential,
            verbose=self.verbose,
            memory=True,
        )

    def create_coherence_review_crew(
        self,
        album_bible: AlbumBible,
        album_content: str,
        **kwargs,
    ) -> Crew:
        """
        Create a crew for reviewing album coherence.

        Should be run after songs are developed to check consistency.
        """
        lyrical_check = Task(
            description=LYRICIST_TASK_TEMPLATES["check_coherence"].format(
                all_lyrics=album_content,
                album_bible=album_bible.to_summary(),
            ),
            expected_output="Lyrical coherence analysis with recommendations",
            agent=self.lyricist,
        )

        harmonic_check = Task(
            description=MUSIC_THEORIST_TASK_TEMPLATES["harmonic_coherence_review"].format(
                all_progressions=kwargs.get("all_progressions", "Not provided"),
                album_concept=album_bible.synopsis,
                emotional_arc=kwargs.get("emotional_arc", "Not specified"),
            ),
            expected_output="Harmonic coherence analysis with recommendations",
            agent=self.music_theorist,
        )

        narrative_check = Task(
            description=NARRATIVE_TASK_TEMPLATES["theme_coherence_check"].format(
                themes=[t.name for t in album_bible.themes],
                album_content=album_content,
            ),
            expected_output="Thematic coherence analysis with recommendations",
            agent=self.narrative_agent,
        )

        style_check = Task(
            description=STYLE_MATCHER_TASK_TEMPLATES["evaluate_song_style"].format(
                style_profile=(
                    album_bible.style_profile.model_dump_json()
                    if album_bible.style_profile
                    else "Not defined"
                ),
                lyrics="[See album content]",
                chords=kwargs.get("all_progressions", "Not provided"),
                structure="[See album content]",
                production_notes="[See album content]",
            ),
            expected_output="Style coherence analysis with recommendations",
            agent=self.style_matcher,
        )

        final_review = Task(
            description=DIRECTOR_TASK_TEMPLATES["final_review"].format(
                album_vision=album_bible.logline,
                final_album=album_content,
                song_details=kwargs.get("song_details", "See album content"),
                album_bible=album_bible.to_summary(),
            ),
            expected_output="Final director review with sign-off or adjustments needed",
            agent=self.director,
            context=[lyrical_check, harmonic_check, narrative_check, style_check],
        )

        return Crew(
            agents=[
                self.lyricist,
                self.music_theorist,
                self.narrative_agent,
                self.style_matcher,
                self.director,
            ],
            tasks=[lyrical_check, harmonic_check, narrative_check, style_check, final_review],
            process=Process.sequential,
            verbose=self.verbose,
            memory=True,
        )


def create_album_ideation_crew(
    concept: str,
    references: str,
    retriever: Optional[UnifiedRetriever] = None,
    llm: Optional[str] = None,
    **kwargs,
) -> Crew:
    """
    Convenience function to create an album ideation crew.

    Args:
        concept: The album concept/story
        references: Reference artists/albums
        retriever: RAG retriever for tools
        llm: LLM to use
        **kwargs: Additional parameters for the vision crew

    Returns:
        Configured Crew for album ideation
    """
    manager = AlbumCrewManager(retriever=retriever, llm=llm)
    return manager.create_vision_crew(concept=concept, references=references, **kwargs)


def create_song_development_crew(
    song_title: str,
    track_number: int,
    album_bible: AlbumBible,
    retriever: Optional[UnifiedRetriever] = None,
    llm: Optional[str] = None,
    **kwargs,
) -> Crew:
    """
    Convenience function to create a song development crew.

    Args:
        song_title: Title of the song
        track_number: Track number on the album
        album_bible: The album bible for context
        retriever: RAG retriever for tools
        llm: LLM to use
        **kwargs: Additional parameters

    Returns:
        Configured Crew for song development
    """
    manager = AlbumCrewManager(retriever=retriever, llm=llm)
    return manager.create_song_development_crew(
        song_title=song_title,
        track_number=track_number,
        album_bible=album_bible,
        **kwargs,
    )
