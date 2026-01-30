"""Lyricist agent for crafting emotionally resonant lyrics."""

from crewai import Agent

from album_conceptualizer.agents.tools import LyricsSearchTool, MotifTrackerTool


def create_lyricist_agent(
    lyrics_search_tool: LyricsSearchTool | None = None,
    motif_tracker_tool: MotifTrackerTool | None = None,
    llm: str | None = None,
    verbose: bool = True,
) -> Agent:
    """
    Create a Lyricist agent specialized in concept album lyrics.

    The Lyricist crafts emotionally resonant lyrics that serve the album's
    narrative arc while maintaining poetic quality and thematic consistency.

    Args:
        lyrics_search_tool: Tool for searching lyrical inspiration
        motif_tracker_tool: Tool for tracking recurring motifs
        llm: LLM to use (defaults to Claude)
        verbose: Whether to show agent's thinking process

    Returns:
        Configured CrewAI Agent
    """
    tools = []
    if lyrics_search_tool:
        tools.append(lyrics_search_tool)
    if motif_tracker_tool:
        tools.append(motif_tracker_tool)

    return Agent(
        role="Concept Album Lyricist",
        goal=(
            "Write lyrics that tell a cohesive story across songs while maintaining "
            "poetic quality, emotional depth, and thematic consistency with the album's vision."
        ),
        backstory="""You are a masterful lyricist who has written for acclaimed concept albums
like Pink Floyd's "The Wall," Green Day's "American Idiot," and Kendrick Lamar's
"good kid, m.A.A.d city." You understand how verses build meaning across tracks,
how recurring phrases gain power through repetition and variation, and how
individual songs must serve both as standalone pieces and chapters in a larger narrative.

Your approach to lyric writing:
1. Every line serves the song's emotional arc AND the album's narrative
2. Recurring motifs should evolve in meaning as the story progresses
3. Imagery should be vivid but not overwrought
4. The best lyrics work on multiple levels - literal and metaphorical
5. Rhythm and flow matter as much as meaning
6. Leave space for the listener's interpretation

You draw inspiration from literary techniques - foreshadowing, callbacks,
unreliable narrators, parallel structure - while ensuring the lyrics remain
singable and emotionally immediate.""",
        tools=tools,
        llm=llm,
        verbose=verbose,
        allow_delegation=False,
        memory=True,
    )


LYRICIST_TASK_TEMPLATES = {
    "write_song_lyrics": """Write lyrics for "{song_title}" (Track {track_number}) of the concept album "{album_title}".

ALBUM CONTEXT:
{album_context}

SONG REQUIREMENTS:
- Narrative position: {narrative_position}
- Key themes: {themes}
- Emotional arc: {emotional_arc}
- Target mood: {mood}
- Style reference: {style_reference}

STRUCTURE:
{song_structure}

MOTIFS TO INCORPORATE:
{motifs}

Write complete lyrics for each section. Ensure:
1. The lyrics advance the album's narrative
2. Recurring motifs are woven in naturally
3. Each section has a clear emotional function
4. The language matches the album's established voice
5. Verses tell, choruses encapsulate

Output the lyrics in standard format with section markers [Verse 1], [Chorus], etc.""",
    "refine_lyrics": """Review and refine these lyrics for "{song_title}":

CURRENT LYRICS:
{current_lyrics}

FEEDBACK:
{feedback}

ALBUM CONTEXT:
{album_context}

Revise the lyrics to address the feedback while maintaining:
1. Thematic consistency with the album
2. Emotional resonance
3. Poetic quality
4. Narrative clarity

Explain your changes and provide the refined lyrics.""",
    "develop_motif": """Develop lyrics for the "{motif_name}" motif across the album.

ALBUM CONTEXT:
{album_context}

MOTIF CONCEPT:
{motif_description}

APPEARANCES:
{appearances}

For each appearance, write how the motif should be expressed:
1. The exact lyrical phrase or imagery
2. How it differs from previous appearances
3. What new meaning it gains in this context
4. How it connects to surrounding lyrics

The motif should evolve meaningfully - same core idea, deepening significance.""",
    "check_coherence": """Review the lyrics across all songs for narrative and thematic coherence.

ALBUM LYRICS:
{all_lyrics}

ALBUM BIBLE:
{album_bible}

Analyze:
1. Does each song advance the narrative appropriately?
2. Are themes consistently represented?
3. Do motifs appear as planned and evolve meaningfully?
4. Are there any contradictions or gaps?
5. Is the emotional arc of the album clear?
6. Does the language/voice remain consistent?

Provide specific recommendations for improving coherence.""",
}
