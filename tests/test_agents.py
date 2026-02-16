"""Tests for the multi-agent system modules.

These tests verify agent configuration, tool logic, and task templates
without making actual LLM calls. All CrewAI dependencies are mocked.
"""

from unittest.mock import MagicMock

import pytest
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Guard: skip the entire module when crewai is not installed
# ---------------------------------------------------------------------------
crewai = pytest.importorskip("crewai", reason="crewai not installed")

# Mark every test in this module so CI can select/deselect agent tests
pytestmark = pytest.mark.agents


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_retriever():
    """Return a mock UnifiedRetriever with the sub-retrievers agents expect."""
    retriever = MagicMock()
    retriever.lyrics_retriever = MagicMock()
    retriever.music_theory_retriever = MagicMock()
    retriever.narrative_retriever = MagicMock()
    return retriever


@pytest.fixture
def mock_llm():
    """Return a sentinel string used as the llm parameter."""
    return "fake-model/test"


# ===================================================================
# Agent creation functions
# ===================================================================


class TestCreateDirectorAgent:
    def test_returns_agent_instance(self):
        from album_conceptualizer.agents.director import create_director_agent

        agent = create_director_agent()
        assert isinstance(agent, crewai.Agent)

    def test_role_and_goal_are_set(self):
        from album_conceptualizer.agents.director import create_director_agent

        agent = create_director_agent()
        assert agent.role == "Album Director"
        assert "creative decisions" in agent.goal

    def test_allows_delegation(self):
        from album_conceptualizer.agents.director import create_director_agent

        agent = create_director_agent()
        assert agent.allow_delegation is True

    def test_accepts_llm_parameter(self, mock_llm):
        from album_conceptualizer.agents.director import create_director_agent

        agent = create_director_agent(llm=mock_llm)
        assert agent.llm == mock_llm

    def test_verbose_defaults_to_true(self):
        from album_conceptualizer.agents.director import create_director_agent

        agent = create_director_agent()
        assert agent.verbose is True

    def test_verbose_can_be_disabled(self):
        from album_conceptualizer.agents.director import create_director_agent

        agent = create_director_agent(verbose=False)
        assert agent.verbose is False


class TestCreateLyricistAgent:
    def test_returns_agent_instance(self):
        from album_conceptualizer.agents.lyricist import create_lyricist_agent

        agent = create_lyricist_agent()
        assert isinstance(agent, crewai.Agent)

    def test_role_is_set(self):
        from album_conceptualizer.agents.lyricist import create_lyricist_agent

        agent = create_lyricist_agent()
        assert agent.role == "Concept Album Lyricist"

    def test_does_not_allow_delegation(self):
        from album_conceptualizer.agents.lyricist import create_lyricist_agent

        agent = create_lyricist_agent()
        assert agent.allow_delegation is False

    def test_tools_empty_when_no_tools_provided(self):
        from album_conceptualizer.agents.lyricist import create_lyricist_agent

        agent = create_lyricist_agent()
        assert agent.tools == []

    def test_tools_populated_when_provided(self, mock_retriever):
        from album_conceptualizer.agents.lyricist import create_lyricist_agent
        from album_conceptualizer.agents.tools import LyricsSearchTool, MotifTrackerTool

        lyrics_tool = LyricsSearchTool(retriever=mock_retriever)
        motif_tool = MotifTrackerTool()
        agent = create_lyricist_agent(
            lyrics_search_tool=lyrics_tool,
            motif_tracker_tool=motif_tool,
        )
        assert len(agent.tools) == 2


class TestCreateMusicTheoristAgent:
    def test_returns_agent_instance(self):
        from album_conceptualizer.agents.music_theorist import create_music_theorist_agent

        agent = create_music_theorist_agent()
        assert isinstance(agent, crewai.Agent)

    def test_role_is_set(self):
        from album_conceptualizer.agents.music_theorist import create_music_theorist_agent

        agent = create_music_theorist_agent()
        assert agent.role == "Music Theory Specialist"

    def test_does_not_allow_delegation(self):
        from album_conceptualizer.agents.music_theorist import create_music_theorist_agent

        agent = create_music_theorist_agent()
        assert agent.allow_delegation is False

    def test_backstory_mentions_harmony(self):
        from album_conceptualizer.agents.music_theorist import create_music_theorist_agent

        agent = create_music_theorist_agent()
        assert "harmony" in agent.backstory.lower() or "harmonic" in agent.backstory.lower()


class TestCreateNarrativeAgent:
    def test_returns_agent_instance(self):
        from album_conceptualizer.agents.narrative import create_narrative_agent

        agent = create_narrative_agent()
        assert isinstance(agent, crewai.Agent)

    def test_role_is_set(self):
        from album_conceptualizer.agents.narrative import create_narrative_agent

        agent = create_narrative_agent()
        assert agent.role == "Narrative Coherence Specialist"

    def test_does_not_allow_delegation(self):
        from album_conceptualizer.agents.narrative import create_narrative_agent

        agent = create_narrative_agent()
        assert agent.allow_delegation is False


class TestCreateStyleMatcherAgent:
    def test_returns_agent_instance(self):
        from album_conceptualizer.agents.style_matcher import create_style_matcher_agent

        agent = create_style_matcher_agent()
        assert isinstance(agent, crewai.Agent)

    def test_role_is_set(self):
        from album_conceptualizer.agents.style_matcher import create_style_matcher_agent

        agent = create_style_matcher_agent()
        assert agent.role == "Style and Production Specialist"

    def test_does_not_allow_delegation(self):
        from album_conceptualizer.agents.style_matcher import create_style_matcher_agent

        agent = create_style_matcher_agent()
        assert agent.allow_delegation is False


# ===================================================================
# Task template dictionaries
# ===================================================================


class TestDirectorTaskTemplates:
    def test_templates_exist(self):
        from album_conceptualizer.agents.director import DIRECTOR_TASK_TEMPLATES

        expected_keys = {
            "define_vision",
            "resolve_conflict",
            "review_album_state",
            "final_review",
            "pacing_review",
        }
        assert expected_keys == set(DIRECTOR_TASK_TEMPLATES.keys())

    def test_define_vision_has_placeholders(self):
        from album_conceptualizer.agents.director import DIRECTOR_TASK_TEMPLATES

        template = DIRECTOR_TASK_TEMPLATES["define_vision"]
        assert "{concept}" in template
        assert "{references}" in template
        assert "{audience}" in template
        assert "{constraints}" in template

    def test_final_review_has_placeholders(self):
        from album_conceptualizer.agents.director import DIRECTOR_TASK_TEMPLATES

        template = DIRECTOR_TASK_TEMPLATES["final_review"]
        assert "{album_vision}" in template
        assert "{final_album}" in template
        assert "{song_details}" in template
        assert "{album_bible}" in template


class TestLyricistTaskTemplates:
    def test_templates_exist(self):
        from album_conceptualizer.agents.lyricist import LYRICIST_TASK_TEMPLATES

        expected_keys = {"write_song_lyrics", "refine_lyrics", "develop_motif", "check_coherence"}
        assert expected_keys == set(LYRICIST_TASK_TEMPLATES.keys())

    def test_write_song_lyrics_template_can_format(self):
        from album_conceptualizer.agents.lyricist import LYRICIST_TASK_TEMPLATES

        result = LYRICIST_TASK_TEMPLATES["write_song_lyrics"].format(
            song_title="Test Song",
            track_number=1,
            album_title="Test Album",
            album_context="context",
            narrative_position="opening",
            themes="hope",
            emotional_arc="rising",
            mood="uplifting",
            style_reference="indie rock",
            song_structure="Verse - Chorus",
            motifs="none",
        )
        assert "Test Song" in result
        assert "Track 1" in result


class TestMusicTheoristTaskTemplates:
    def test_templates_exist(self):
        from album_conceptualizer.agents.music_theorist import MUSIC_THEORIST_TASK_TEMPLATES

        expected_keys = {
            "suggest_progression",
            "analyze_key_relationships",
            "develop_musical_motif",
            "harmonic_coherence_review",
            "suggest_section_harmony",
        }
        assert expected_keys == set(MUSIC_THEORIST_TASK_TEMPLATES.keys())


class TestNarrativeTaskTemplates:
    def test_templates_exist(self):
        from album_conceptualizer.agents.narrative import NARRATIVE_TASK_TEMPLATES

        expected_keys = {
            "develop_album_structure",
            "validate_song_narrative",
            "track_character_arc",
            "theme_coherence_check",
            "timeline_consistency_check",
            "suggest_narrative_improvements",
        }
        assert expected_keys == set(NARRATIVE_TASK_TEMPLATES.keys())


class TestStyleMatcherTaskTemplates:
    def test_templates_exist(self):
        from album_conceptualizer.agents.style_matcher import STYLE_MATCHER_TASK_TEMPLATES

        expected_keys = {
            "define_album_style",
            "evaluate_song_style",
            "analyze_reference_material",
            "suggest_style_adjustments",
            "production_notes_generation",
        }
        assert expected_keys == set(STYLE_MATCHER_TASK_TEMPLATES.keys())


# ===================================================================
# Tool input schemas
# ===================================================================


class TestToolInputSchemas:
    def test_lyrics_search_input_defaults(self):
        from album_conceptualizer.agents.tools import LyricsSearchInput

        inp = LyricsSearchInput(query="love")
        assert inp.granularity == "song"
        assert inp.top_k == 5

    def test_chord_progression_search_input_defaults(self):
        from album_conceptualizer.agents.tools import ChordProgressionSearchInput

        inp = ChordProgressionSearchInput(query="sad progression")
        assert inp.genre is None
        assert inp.mood is None
        assert inp.top_k == 5

    def test_narrative_structure_search_input_defaults(self):
        from album_conceptualizer.agents.tools import NarrativeStructureSearchInput

        inp = NarrativeStructureSearchInput(query="hero's journey")
        assert inp.content_type is None
        assert inp.top_k == 3

    def test_motif_tracker_input_defaults(self):
        from album_conceptualizer.agents.tools import MotifTrackerInput

        inp = MotifTrackerInput(action="list")
        assert inp.motif_name == ""
        assert inp.track_number is None
        assert inp.section is None
        assert inp.variation is None

    def test_all_input_schemas_are_pydantic_models(self):
        from album_conceptualizer.agents.tools import (
            ChordProgressionSearchInput,
            LyricsSearchInput,
            MotifTrackerInput,
            NarrativeStructureSearchInput,
        )

        for schema in [
            LyricsSearchInput,
            ChordProgressionSearchInput,
            NarrativeStructureSearchInput,
            MotifTrackerInput,
        ]:
            assert issubclass(schema, BaseModel)


# ===================================================================
# MotifTrackerTool (stateful, no external deps)
# ===================================================================


class TestMotifTrackerTool:
    @pytest.fixture
    def tracker(self):
        from album_conceptualizer.agents.tools import MotifTrackerTool

        return MotifTrackerTool()

    def test_list_empty(self, tracker):
        result = tracker._run(action="list")
        assert "No motifs tracked yet" in result

    def test_add_motif(self, tracker):
        result = tracker._run(action="add", motif_name="clock", variation="passage of time")
        assert "Added motif: clock" in result
        assert "clock" in tracker.motifs

    def test_add_motif_requires_name(self, tracker):
        result = tracker._run(action="add")
        assert "Error" in result

    def test_track_motif(self, tracker):
        tracker._run(action="add", motif_name="rain")
        result = tracker._run(
            action="track",
            motif_name="rain",
            track_number=3,
            section="verse",
            variation="light drizzle",
        )
        assert "Tracked rain in track 3" in result
        assert len(tracker.motifs["rain"]["appearances"]) == 1

    def test_track_creates_motif_if_missing(self, tracker):
        result = tracker._run(action="track", motif_name="new_motif", track_number=1)
        assert "Tracked new_motif in track 1" in result
        assert "new_motif" in tracker.motifs

    def test_track_requires_name_and_track(self, tracker):
        result = tracker._run(action="track")
        assert "Error" in result

    def test_get_motif(self, tracker):
        tracker._run(action="add", motif_name="bell", variation="tolling")
        tracker._run(action="track", motif_name="bell", track_number=1, section="intro")
        tracker._run(action="track", motif_name="bell", track_number=5, section="chorus")

        result = tracker._run(action="get", motif_name="bell")
        assert "bell" in result
        assert "Track 1" in result
        assert "Track 5" in result

    def test_get_motif_not_found(self, tracker):
        result = tracker._run(action="get", motif_name="nonexistent")
        assert "not found" in result

    def test_list_motifs(self, tracker):
        tracker._run(action="add", motif_name="alpha")
        tracker._run(action="add", motif_name="beta")
        tracker._run(action="track", motif_name="alpha", track_number=1)

        result = tracker._run(action="list")
        assert "alpha" in result
        assert "beta" in result
        assert "1 appearances" in result

    def test_unknown_action(self, tracker):
        result = tracker._run(action="delete")
        assert "Unknown action" in result


# ===================================================================
# RAG-backed tool _run methods (with mock retriever)
# ===================================================================


class TestLyricsSearchTool:
    def test_run_returns_error_without_retriever(self):
        from album_conceptualizer.agents.tools import LyricsSearchTool

        tool = LyricsSearchTool.__new__(LyricsSearchTool)
        tool.retriever = None
        result = tool._run(query="love")
        assert "Error" in result

    def test_run_returns_no_results_message(self, mock_retriever):
        from album_conceptualizer.agents.tools import LyricsSearchTool

        mock_retriever.lyrics_retriever.retrieve.return_value = []
        tool = LyricsSearchTool(retriever=mock_retriever)
        result = tool._run(query="love")
        assert "No matching lyrics found" in result

    def test_run_formats_results(self, mock_retriever):
        from album_conceptualizer.agents.tools import LyricsSearchTool

        doc = MagicMock()
        doc.metadata = {"song_title": "Yesterday", "album_title": "Help!"}
        doc.content = "All my troubles seemed so far away"
        mock_retriever.lyrics_retriever.retrieve.return_value = [(doc, 0.95)]

        tool = LyricsSearchTool(retriever=mock_retriever)
        result = tool._run(query="nostalgia")
        assert "Yesterday" in result
        assert "Help!" in result
        assert "0.95" in result


class TestChordProgressionSearchTool:
    def test_run_returns_error_without_retriever(self):
        from album_conceptualizer.agents.tools import ChordProgressionSearchTool

        tool = ChordProgressionSearchTool.__new__(ChordProgressionSearchTool)
        tool.retriever = None
        result = tool._run(query="minor progression")
        assert "Error" in result

    def test_run_returns_no_results_message(self, mock_retriever):
        from album_conceptualizer.agents.tools import ChordProgressionSearchTool

        mock_retriever.music_theory_retriever.retrieve.return_value = []
        tool = ChordProgressionSearchTool(retriever=mock_retriever)
        result = tool._run(query="jazz ii-V-I")
        assert "No matching chord progressions found" in result

    def test_run_builds_enhanced_query_with_genre_and_mood(self, mock_retriever):
        from album_conceptualizer.agents.tools import ChordProgressionSearchTool

        mock_retriever.music_theory_retriever.retrieve.return_value = []
        tool = ChordProgressionSearchTool(retriever=mock_retriever)
        tool._run(query="progression", genre="jazz", mood="melancholy")

        call_args = mock_retriever.music_theory_retriever.retrieve.call_args
        full_query = call_args.kwargs.get("query", call_args[1].get("query", ""))
        assert "jazz style" in full_query
        assert "melancholy feeling" in full_query

    def test_run_formats_results(self, mock_retriever):
        from album_conceptualizer.agents.tools import ChordProgressionSearchTool

        doc = MagicMock()
        doc.content = "Am - F - C - G"
        doc.metadata = {"genre": "pop"}
        mock_retriever.music_theory_retriever.retrieve.return_value = [(doc, 0.88)]

        tool = ChordProgressionSearchTool(retriever=mock_retriever)
        result = tool._run(query="pop ballad")
        assert "Am - F - C - G" in result
        assert "pop" in result


class TestNarrativeStructureSearchTool:
    def test_run_returns_error_without_retriever(self):
        from album_conceptualizer.agents.tools import NarrativeStructureSearchTool

        tool = NarrativeStructureSearchTool.__new__(NarrativeStructureSearchTool)
        tool.retriever = None
        result = tool._run(query="hero's journey")
        assert "Error" in result

    def test_run_uses_structure_templates_when_type_specified(self, mock_retriever):
        from album_conceptualizer.agents.tools import NarrativeStructureSearchTool

        mock_retriever.narrative_retriever.retrieve_structure_templates.return_value = []
        tool = NarrativeStructureSearchTool(retriever=mock_retriever)
        tool._run(query="three act", content_type="structure_template")

        mock_retriever.narrative_retriever.retrieve_structure_templates.assert_called_once()

    def test_run_uses_generic_retrieve_by_default(self, mock_retriever):
        from album_conceptualizer.agents.tools import NarrativeStructureSearchTool

        mock_retriever.narrative_retriever.retrieve.return_value = []
        tool = NarrativeStructureSearchTool(retriever=mock_retriever)
        tool._run(query="circular narrative")

        mock_retriever.narrative_retriever.retrieve.assert_called_once()


# ===================================================================
# create_agent_tools helper
# ===================================================================


class TestCreateAgentTools:
    def test_returns_dict_with_expected_keys(self, mock_retriever):
        from album_conceptualizer.agents.tools import create_agent_tools

        tools = create_agent_tools(mock_retriever)
        assert set(tools.keys()) == {
            "lyrics_search",
            "chord_search",
            "narrative_search",
            "motif_tracker",
        }

    def test_tools_are_base_tool_instances(self, mock_retriever):
        from crewai.tools import BaseTool

        from album_conceptualizer.agents.tools import create_agent_tools

        tools = create_agent_tools(mock_retriever)
        for tool in tools.values():
            assert isinstance(tool, BaseTool)


# ===================================================================
# AlbumCrewManager (mocked Crew/Task creation)
# ===================================================================


class TestAlbumCrewManager:
    def test_init_without_retriever(self):
        from album_conceptualizer.agents.crew import AlbumCrewManager

        manager = AlbumCrewManager(retriever=None, llm=None, verbose=False)
        assert manager.tools == {}
        assert manager.director is not None
        assert manager.lyricist is not None
        assert manager.music_theorist is not None
        assert manager.narrative_agent is not None
        assert manager.style_matcher is not None

    def test_init_with_retriever_creates_tools(self, mock_retriever):
        from album_conceptualizer.agents.crew import AlbumCrewManager

        manager = AlbumCrewManager(retriever=mock_retriever, llm=None, verbose=False)
        assert len(manager.tools) == 4

    def test_create_vision_crew_returns_crew(self):
        from album_conceptualizer.agents.crew import AlbumCrewManager

        manager = AlbumCrewManager(retriever=None, llm=None, verbose=False)
        crew = manager.create_vision_crew(concept="test concept", references="test refs")
        assert isinstance(crew, crewai.Crew)

    def test_create_vision_crew_has_three_tasks(self):
        from album_conceptualizer.agents.crew import AlbumCrewManager

        manager = AlbumCrewManager(retriever=None, llm=None, verbose=False)
        crew = manager.create_vision_crew(concept="test concept", references="test refs")
        assert len(crew.tasks) == 3

    def test_create_vision_crew_has_three_agents(self):
        from album_conceptualizer.agents.crew import AlbumCrewManager

        manager = AlbumCrewManager(retriever=None, llm=None, verbose=False)
        crew = manager.create_vision_crew(concept="test concept", references="test refs")
        assert len(crew.agents) == 3

    def test_create_song_development_crew_returns_crew(self):
        from album_conceptualizer.agents.crew import AlbumCrewManager
        from album_conceptualizer.models.album_bible import AlbumBible

        bible = AlbumBible(
            album_title="Test Album",
            logline="A test album",
            synopsis="Testing the system",
        )
        manager = AlbumCrewManager(retriever=None, llm=None, verbose=False)
        crew = manager.create_song_development_crew(
            song_title="Song 1",
            track_number=1,
            album_bible=bible,
        )
        assert isinstance(crew, crewai.Crew)
        assert len(crew.tasks) == 4
        assert len(crew.agents) == 4

    def test_create_coherence_review_crew_returns_crew(self):
        from album_conceptualizer.agents.crew import AlbumCrewManager
        from album_conceptualizer.models.album_bible import AlbumBible

        bible = AlbumBible(
            album_title="Test Album",
            logline="A test album",
            synopsis="Testing the system",
        )
        manager = AlbumCrewManager(retriever=None, llm=None, verbose=False)
        crew = manager.create_coherence_review_crew(
            album_bible=bible,
            album_content="Sample album content",
        )
        assert isinstance(crew, crewai.Crew)
        assert len(crew.tasks) == 5
        assert len(crew.agents) == 5

    def test_seed_is_stored(self):
        from album_conceptualizer.agents.crew import AlbumCrewManager

        manager = AlbumCrewManager(retriever=None, llm=None, verbose=False, seed=42)
        assert manager.seed == 42


# ===================================================================
# Convenience functions
# ===================================================================


class TestConvenienceFunctions:
    def test_create_album_ideation_crew(self):
        from album_conceptualizer.agents.crew import create_album_ideation_crew

        crew = create_album_ideation_crew(
            concept="A dystopian concept album",
            references="Radiohead, Pink Floyd",
        )
        assert isinstance(crew, crewai.Crew)

    def test_create_song_development_crew(self):
        from album_conceptualizer.agents.crew import create_song_development_crew
        from album_conceptualizer.models.album_bible import AlbumBible

        bible = AlbumBible(
            album_title="Test",
            logline="Test logline",
            synopsis="Test synopsis",
        )
        crew = create_song_development_crew(
            song_title="Opening",
            track_number=1,
            album_bible=bible,
        )
        assert isinstance(crew, crewai.Crew)

    def test_create_coherence_review_crew(self):
        from album_conceptualizer.agents.crew import create_coherence_review_crew
        from album_conceptualizer.models.album_bible import AlbumBible

        bible = AlbumBible(
            album_title="Test",
            logline="Test logline",
            synopsis="Test synopsis",
        )
        crew = create_coherence_review_crew(
            album_bible=bible,
            album_content="All the songs go here",
        )
        assert isinstance(crew, crewai.Crew)


# ===================================================================
# Package __init__ exports
# ===================================================================


class TestAgentsPackageExports:
    def test_all_exports_are_importable(self):
        import album_conceptualizer.agents as agents_pkg

        for name in agents_pkg.__all__:
            assert hasattr(agents_pkg, name), f"{name} listed in __all__ but not importable"

    def test_expected_exports(self):
        import album_conceptualizer.agents as agents_pkg

        expected = {
            "AlbumCrewManager",
            "create_album_ideation_crew",
            "create_coherence_review_crew",
            "create_director_agent",
            "create_lyricist_agent",
            "create_music_theorist_agent",
            "create_narrative_agent",
            "create_song_development_crew",
            "create_style_matcher_agent",
        }
        assert expected == set(agents_pkg.__all__)
