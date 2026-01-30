"""Music Theorist agent for harmonic and structural coherence."""

from crewai import Agent

from album_conceptualizer.agents.tools import ChordProgressionSearchTool, MotifTrackerTool


def create_music_theorist_agent(
    chord_search_tool: ChordProgressionSearchTool | None = None,
    motif_tracker_tool: MotifTrackerTool | None = None,
    llm: str | None = None,
    verbose: bool = True,
) -> Agent:
    """
    Create a Music Theorist agent specialized in harmonic analysis and composition.

    The Music Theorist ensures harmonic coherence across the album, suggests
    chord progressions, and identifies opportunities for musical motif connections.

    Args:
        chord_search_tool: Tool for searching chord progressions
        motif_tracker_tool: Tool for tracking musical motifs
        llm: LLM to use (defaults to Claude)
        verbose: Whether to show agent's thinking process

    Returns:
        Configured CrewAI Agent
    """
    tools = []
    if chord_search_tool:
        tools.append(chord_search_tool)
    if motif_tracker_tool:
        tools.append(motif_tracker_tool)

    return Agent(
        role="Music Theory Specialist",
        goal=(
            "Ensure harmonic and structural coherence across the album while suggesting "
            "chord progressions, key relationships, and musical motifs that serve "
            "both the emotional content and narrative arc."
        ),
        backstory="""You are a music theorist with deep knowledge of both classical harmony
and contemporary popular music. You've analyzed hundreds of concept albums and
understand how harmonic choices can reinforce narrative:

- How key changes can signal emotional shifts
- How recurring chord patterns create musical motifs
- How secondary dominants and modal interchange add color
- How the "sound" of a key (bright D major vs. dark D minor) affects perception

Your analytical background spans:
- Classical: Bach's voice leading, Romantic chromatic harmony
- Jazz: ii-V-I progressions, substitutions, extensions
- Rock/Pop: Power chords, pedal tones, modal vamps
- Film scoring: Leitmotifs, tension/release patterns

You think in terms of tension and release, expectation and surprise. You know
that the "right" chord isn't always the most sophisticated one - sometimes a
simple I-IV-V is exactly what serves the song.

You can translate emotional concepts into harmonic language:
- "Uncertain but hopeful" → Major key with some borrowed chords from the parallel minor
- "Climactic triumph" → Arrival on a major I chord after extended dominant preparation
- "Nostalgic longing" → Mixolydian progressions, bVII chord usage""",
        tools=tools,
        llm=llm,
        verbose=verbose,
        allow_delegation=False,
        memory=True,
    )


MUSIC_THEORIST_TASK_TEMPLATES = {
    "suggest_progression": """Suggest chord progressions for "{song_title}" (Track {track_number}).

SONG CONTEXT:
- Key themes: {themes}
- Emotional arc: {emotional_arc}
- Target mood: {mood}
- Genre style: {genre}

ALBUM HARMONIC CONTEXT:
- Album's primary key center: {album_key}
- Previous song ended in: {previous_key}
- Musical motifs to consider: {motifs}

SONG STRUCTURE:
{song_structure}

For each section, suggest:
1. Chord progression (both chord symbols and Roman numerals)
2. Key/mode if different from the song's main key
3. Rationale for how this serves the emotion/narrative
4. Any connections to other songs' harmonic material

Consider how the harmonic journey of this song fits within the album's overall arc.""",
    "analyze_key_relationships": """Analyze the key relationships across the album.

ALBUM TRACKLIST WITH KEYS:
{tracklist_keys}

ALBUM NARRATIVE:
{album_narrative}

Analyze:
1. The overall key journey of the album
2. Whether key choices reinforce the narrative arc
3. Transition smoothness between songs
4. Opportunities for key-based callbacks or foreshadowing
5. Suggested adjustments to strengthen key relationships

Map out the album's harmonic architecture and identify how it can better serve the story.""",
    "develop_musical_motif": """Develop a musical motif that can recur across the album.

MOTIF PURPOSE:
{motif_purpose}

THEMATIC CONNECTION:
{thematic_connection}

SONGS WHERE IT SHOULD APPEAR:
{target_songs}

Create:
1. A chord pattern or melodic fragment (describe in chord symbols/intervals)
2. How it should be introduced (which song, which section)
3. Variations for subsequent appearances:
   - Harmonic variations (different key, mode, voicing)
   - Rhythmic variations
   - Contextual variations (what surrounds it changes its meaning)
4. Its "final form" or culmination in the album

The motif should be recognizable but not repetitive - each appearance should feel fresh.""",
    "harmonic_coherence_review": """Review the album's harmonic coherence.

ALL SONG PROGRESSIONS:
{all_progressions}

ALBUM CONCEPT:
{album_concept}

EMOTIONAL ARC:
{emotional_arc}

Evaluate:
1. Do harmonic choices consistently reflect emotional content?
2. Are there missed opportunities for harmonic connections?
3. Does the complexity level remain appropriate throughout?
4. Are transitions between songs smooth or intentionally jarring?
5. Do musical motifs develop meaningfully?

Provide specific recommendations for strengthening harmonic coherence.""",
    "suggest_section_harmony": """Suggest detailed harmony for a song section.

SECTION: {section_type} of "{song_title}"
LYRICS:
{lyrics}

CONTEXT:
- Song key: {song_key}
- Previous section ended on: {previous_chord}
- Emotional goal: {emotional_goal}
- Genre: {genre}

Provide:
1. Beat-by-beat chord progression
2. Voice leading recommendations
3. Suggested bass movement
4. Extension and color tone suggestions
5. Dynamic/intensity recommendations
6. How this section connects to what comes before and after""",
}
