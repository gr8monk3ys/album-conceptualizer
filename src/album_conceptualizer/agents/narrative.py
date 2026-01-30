"""Narrative Coherence agent for story consistency and arc tracking."""

from typing import Optional

from crewai import Agent

from album_conceptualizer.agents.tools import NarrativeStructureSearchTool, MotifTrackerTool


def create_narrative_agent(
    narrative_search_tool: Optional[NarrativeStructureSearchTool] = None,
    motif_tracker_tool: Optional[MotifTrackerTool] = None,
    llm: Optional[str] = None,
    verbose: bool = True,
) -> Agent:
    """
    Create a Narrative Coherence agent specialized in story structure.

    The Narrative agent validates story consistency, tracks character arcs,
    and ensures thematic threading across the album.

    Args:
        narrative_search_tool: Tool for searching narrative structures
        motif_tracker_tool: Tool for tracking narrative motifs
        llm: LLM to use (defaults to Claude)
        verbose: Whether to show agent's thinking process

    Returns:
        Configured CrewAI Agent
    """
    tools = []
    if narrative_search_tool:
        tools.append(narrative_search_tool)
    if motif_tracker_tool:
        tools.append(motif_tracker_tool)

    return Agent(
        role="Narrative Coherence Specialist",
        goal=(
            "Ensure the album tells a coherent, compelling story with properly "
            "developed character arcs, consistent themes, and satisfying structure. "
            "Track all narrative elements and identify gaps or contradictions."
        ),
        backstory="""You are a story architect who has worked on narrative-driven projects
across multiple media - novels, films, TV series, and concept albums. You understand
that a concept album is a unique storytelling form with its own constraints and
possibilities:

UNIQUE ALBUM STORYTELLING ASPECTS:
- Each song must work standalone AND as a chapter
- Listeners may not hear songs in order
- Emotional impact often matters more than plot clarity
- Music carries narrative weight that lyrics alone cannot
- 10-15 songs means economy of storytelling is essential

Your analytical framework draws from:
- Joseph Campbell's Hero's Journey
- Three-act and five-act dramatic structures
- TV writers' techniques for serialized storytelling
- Non-linear narrative (Tarantino, Nolan) when story warrants it
- Concept album masters: Pink Floyd, The Who, Green Day, Janelle Monáe

You excel at:
1. Mapping character emotional journeys
2. Identifying thematic threads and ensuring they're woven consistently
3. Spotting plot holes, timeline inconsistencies, or motivation gaps
4. Suggesting where foreshadowing or callbacks would strengthen the narrative
5. Balancing clarity with ambiguity - some mystery is good, confusion is not

You know that the best concept albums trust their audience to piece things
together, but give them enough to work with.""",
        tools=tools,
        llm=llm,
        verbose=verbose,
        allow_delegation=False,
        memory=True,
    )


NARRATIVE_TASK_TEMPLATES = {
    "develop_album_structure": """Develop the narrative structure for the concept album.

ALBUM CONCEPT:
{album_concept}

KEY THEMES:
{themes}

CHARACTERS:
{characters}

TARGET TRACK COUNT: {track_count}

Create:
1. The narrative structure type (Hero's Journey, Three-Act, Circular, Non-Linear)
2. A beat sheet mapping story beats to approximate track positions
3. Each song's narrative function (what happens/changes)
4. Character arc tracking - where each character is in their journey per song
5. Theme tracking - how themes develop and recur
6. The emotional arc of the album as a whole

Consider whether the track order should match chronological order or if
non-linear storytelling would serve the concept better.""",

    "validate_song_narrative": """Validate the narrative elements of "{song_title}" (Track {track_number}).

SONG CONTENT:
{song_content}

ALBUM NARRATIVE CONTEXT:
{album_narrative}

PREVIOUS SONG:
{previous_song}

NEXT SONG:
{next_song}

Evaluate:
1. Does this song advance the story appropriately?
2. Is the character's emotional state consistent with their arc?
3. Are any themes introduced or developed?
4. Does it connect properly to surrounding songs?
5. Is there appropriate foreshadowing or payoff?
6. Would a listener understand what's happening?

Identify specific issues and suggest improvements.""",

    "track_character_arc": """Track the character arc for {character_name} across the album.

CHARACTER PROFILE:
{character_profile}

ALBUM CONTENT:
{album_content}

Map the character's journey:
1. Starting state (emotional, circumstantial)
2. Key moments of change (which songs, what triggers change)
3. Internal vs external conflict
4. Relationship dynamics with other characters
5. Resolution or end state

Identify:
- Any gaps in the arc (jumps that don't feel earned)
- Inconsistencies in behavior or motivation
- Missed opportunities for development
- Whether the arc is satisfying and complete""",

    "theme_coherence_check": """Check thematic coherence across the album.

ALBUM THEMES:
{themes}

ALBUM CONTENT:
{album_content}

For each theme, track:
1. Where it's introduced
2. How it develops across songs
3. Whether it reaches resolution
4. How it interacts with other themes

Identify:
- Themes that are underdeveloped
- Themes that disappear without resolution
- Contradictions in thematic messaging
- Opportunities to strengthen thematic connections

The best concept albums have 2-3 core themes that weave throughout.
More themes = thinner development.""",

    "timeline_consistency_check": """Check timeline consistency across the album.

ALBUM CONTENT WITH TIMELINE MARKERS:
{album_content}

NARRATIVE STRUCTURE:
{narrative_structure}

Verify:
1. Does the timeline make sense (even if non-linear)?
2. Are there any impossible sequences?
3. Do flashbacks/flash-forwards serve the story?
4. Is it clear enough for listeners to follow?
5. Are there unmarked time jumps that confuse?

If non-linear, create a timeline diagram showing:
- Chronological order of events
- Track order (listening order)
- How the two relate and what effect this creates""",

    "suggest_narrative_improvements": """Suggest improvements to the album's narrative.

CURRENT ALBUM STATE:
{album_content}

ALBUM BIBLE:
{album_bible}

IDENTIFIED ISSUES:
{issues}

For each issue, provide:
1. The specific problem
2. Why it matters for the listener experience
3. 2-3 possible solutions with tradeoffs
4. Recommended solution and implementation

Prioritize suggestions by impact on overall narrative coherence.""",
}
