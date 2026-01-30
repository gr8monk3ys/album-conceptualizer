"""Style Matcher agent for maintaining genre and production coherence."""

from typing import Optional

from crewai import Agent

from album_conceptualizer.agents.tools import (
    LyricsSearchTool,
    ChordProgressionSearchTool,
)


def create_style_matcher_agent(
    lyrics_search_tool: Optional[LyricsSearchTool] = None,
    chord_search_tool: Optional[ChordProgressionSearchTool] = None,
    llm: Optional[str] = None,
    verbose: bool = True,
) -> Agent:
    """
    Create a Style Matcher agent specialized in genre and production coherence.

    The Style Matcher ensures the album maintains consistent sonic identity
    while allowing for appropriate variation across songs.

    Args:
        lyrics_search_tool: Tool for searching reference lyrics
        chord_search_tool: Tool for searching reference progressions
        llm: LLM to use (defaults to Claude)
        verbose: Whether to show agent's thinking process

    Returns:
        Configured CrewAI Agent
    """
    tools = []
    if lyrics_search_tool:
        tools.append(lyrics_search_tool)
    if chord_search_tool:
        tools.append(chord_search_tool)

    return Agent(
        role="Style and Production Specialist",
        goal=(
            "Maintain consistent sonic identity and production style across the album "
            "while ensuring appropriate variation. Match reference material aesthetics "
            "and ensure all elements fit the established genre and era influences."
        ),
        backstory="""You are a producer and A&R specialist with encyclopedic knowledge of
musical genres, subgenres, and production styles across decades. You've worked on
albums that needed to capture specific aesthetics:

STYLE EXPERTISE:
- Genre identification: You can pinpoint not just "rock" but "late 70s progressive
  rock with art rock influences and Canterbury scene production"
- Era accuracy: You know the difference between 80s synth-pop production and
  modern synthwave that references it
- Production fingerprints: You recognize producer styles (Butch Vig's compression,
  Rick Rubin's minimalism, Max Martin's hooks)
- Cross-genre fusion: You understand how to blend styles coherently

YOUR APPROACH:
1. Establish a "sonic bible" - the boundaries of what fits the album
2. Reference tracks are anchors, not constraints
3. Variation within consistency - albums need dynamics
4. Some songs can push boundaries; most should stay centered
5. Production elements (reverb, compression, instrumentation) are as important
   as composition choices

WHAT YOU EVALUATE:
- Does this fit the established sonic palette?
- Would a fan of the reference artists recognize the influence?
- Is the variation purposeful or just inconsistent?
- Are production notes specific enough to guide actual recording?
- Does the style serve the emotional/narrative content?

You translate abstract style goals ("I want it to sound like Radiohead meets
Björk") into concrete musical decisions.""",
        tools=tools,
        llm=llm,
        verbose=verbose,
        allow_delegation=False,
        memory=True,
    )


STYLE_MATCHER_TASK_TEMPLATES = {
    "define_album_style": """Define the style profile for the album.

REFERENCE MATERIAL:
Artists: {reference_artists}
Albums: {reference_albums}
Tracks: {reference_tracks}

CONCEPT AND THEMES:
{album_concept}

ERA/PERIOD INFLUENCE (if any): {era_influence}

Create a comprehensive style profile including:

1. GENRE DEFINITION
   - Primary genre and subgenre
   - Genre blend ratios if fusion (e.g., "70% alt-rock, 30% electronic")
   - What makes this album's sound distinct within the genre

2. SONIC CHARACTERISTICS
   - Typical tempo range
   - Common keys/modes
   - Harmonic complexity level
   - Rhythmic characteristics

3. PRODUCTION AESTHETIC
   - Overall sound (lo-fi, polished, live, electronic, etc.)
   - Reverb/space characteristics
   - Dynamic range expectations
   - Era-specific production elements to incorporate or avoid

4. INSTRUMENTATION PALETTE
   - Core instruments (always present)
   - Color instruments (occasional)
   - Instruments to avoid (don't fit the style)

5. VOCAL STYLE
   - Delivery approach
   - Processing expectations
   - Harmony/layering tendencies

6. LYRICAL VOICE
   - Vocabulary complexity
   - Imagery type
   - POV tendencies
   - What topics/words fit vs. don't fit

7. VARIATION PARAMETERS
   - Which elements can vary song-to-song
   - Which must remain consistent
   - Acceptable boundary-pushing moments""",

    "evaluate_song_style": """Evaluate whether "{song_title}" fits the album's style.

ALBUM STYLE PROFILE:
{style_profile}

SONG ELEMENTS:
Lyrics: {lyrics}
Chord progression: {chords}
Structure: {structure}
Production notes: {production_notes}

Evaluate against each style dimension:
1. Does the genre feel right?
2. Do the harmonic choices fit?
3. Is the lyrical voice consistent?
4. Would production notes result in a cohesive sound?

Rate overall style coherence (1-10) and identify:
- What fits well
- What needs adjustment
- Specific suggestions for better alignment

A song can intentionally break from style for effect - note if this seems intentional.""",

    "analyze_reference_material": """Analyze reference material to extract style characteristics.

REFERENCE: {reference_name}
TYPE: {reference_type} (artist/album/song)

WHAT TO ANALYZE:
(For artist: across their discography)
(For album: the album as a whole)
(For song: the specific track)

Extract:
1. HARMONIC TENDENCIES
   - Common chord progressions
   - Key preferences
   - Harmonic rhythm
   - Use of extensions/alterations

2. MELODIC CHARACTERISTICS
   - Range
   - Contour patterns
   - Phrase lengths
   - Relationship to chords

3. RHYTHMIC PATTERNS
   - Common time signatures
   - Rhythmic feel (straight, swung, etc.)
   - Tempo tendencies

4. PRODUCTION SIGNATURES
   - Instrument sounds/tones
   - Spatial characteristics
   - Dynamic approach
   - Era markers

5. LYRICAL PATTERNS
   - Themes
   - Vocabulary level
   - Imagery types
   - Structural tendencies

6. UNIQUE IDENTIFIERS
   - What makes this instantly recognizable?
   - Signature moves/techniques
   - Sonic fingerprints

This analysis will inform the album's style profile.""",

    "suggest_style_adjustments": """Suggest style adjustments for content that doesn't fit.

PROBLEMATIC CONTENT:
{content}

ALBUM STYLE PROFILE:
{style_profile}

IDENTIFIED ISSUES:
{issues}

For each issue:
1. What specifically doesn't fit
2. Why it matters for album coherence
3. How to adjust while preserving the content's intent
4. Alternative approaches if adjustment isn't possible

The goal is coherence without homogeneity - find solutions that maintain
variety while respecting the album's sonic identity.""",

    "production_notes_generation": """Generate detailed production notes for "{song_title}".

SONG CONTENT:
{song_content}

ALBUM STYLE PROFILE:
{style_profile}

SONG'S NARRATIVE/EMOTIONAL ROLE:
{song_role}

Create production notes covering:

1. ARRANGEMENT
   - Instrumentation by section
   - Entry/exit of instruments
   - Textural changes
   - Build and release points

2. SOUND DESIGN
   - Instrument tones (specific)
   - Effects (reverb types, delays, modulation)
   - Processing approach per instrument

3. VOCAL PRODUCTION
   - Main vocal treatment
   - Harmony arrangement
   - Ad-libs and supporting vocals

4. MIX DIRECTION
   - Focal points by section
   - Spatial placement
   - Dynamic range
   - References for specific sounds

5. SPECIAL MOMENTS
   - Any production "events" (drops, builds, transitions)
   - Unique sounds specific to this song
   - How this song distinguishes itself while fitting the album

Notes should be specific enough to guide an actual recording session.""",
}
