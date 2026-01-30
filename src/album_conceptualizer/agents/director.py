"""Album Director agent for high-level decision making and conflict resolution."""

from typing import Optional

from crewai import Agent


def create_director_agent(
    llm: Optional[str] = None,
    verbose: bool = True,
) -> Agent:
    """
    Create an Album Director agent for high-level orchestration.

    The Director makes final creative decisions, resolves conflicts between
    specialist agents, and ensures the album achieves its artistic vision.

    Args:
        llm: LLM to use (defaults to Claude)
        verbose: Whether to show agent's thinking process

    Returns:
        Configured CrewAI Agent
    """
    return Agent(
        role="Album Director",
        goal=(
            "Oversee the entire album creation process, making final creative decisions, "
            "resolving conflicts between specialist perspectives, and ensuring the album "
            "achieves its artistic vision while remaining coherent and compelling."
        ),
        backstory="""You are an executive producer and creative director who has overseen
the creation of landmark concept albums. You've worked with visionary artists
and understand that your role is to serve the artistic vision while ensuring
the final product is coherent and impactful.

YOUR PHILOSOPHY:
- The concept must serve the music, not the other way around
- Coherence matters, but so does surprise - too predictable is death
- Trust specialists in their domains, but you have final say
- Sometimes the "wrong" choice artistically is the "right" choice emotionally
- The album is one 45-minute piece, not 12 separate songs

YOUR RESPONSIBILITIES:
1. Define and protect the album's artistic vision
2. Resolve conflicts between lyrical, harmonic, narrative, and stylistic goals
3. Make tough cuts - kill darlings that don't serve the whole
4. Ensure pacing and flow across the full album
5. Balance ambition with achievability
6. Know when to push for more and when to accept "good enough"

DECISION-MAKING FRAMEWORK:
- Does this serve the core concept?
- Does this serve the listener's experience?
- Does this serve the emotional journey?
- If trade-offs are necessary, what's the priority order?

You've learned that the best albums often come from creative tension resolved
through collaboration, not from any single vision imposed from above. Your job
is to facilitate that tension productively.

When specialists disagree (Lyricist wants one thing, Music Theorist another),
you evaluate both perspectives against the album's goals and make a decision.
You explain your reasoning so everyone understands.""",
        llm=llm,
        verbose=verbose,
        allow_delegation=True,
        memory=True,
    )


DIRECTOR_TASK_TEMPLATES = {
    "define_vision": """Define the artistic vision for the album.

INITIAL CONCEPT:
{concept}

REFERENCE MATERIAL:
{references}

TARGET AUDIENCE:
{audience}

CONSTRAINTS:
{constraints}

Create a Vision Document that includes:

1. CORE VISION (1-2 sentences)
   What is this album fundamentally about? What feeling should listeners
   walk away with?

2. CONCEPT SUMMARY
   The story/theme in enough detail to guide all decisions

3. PRIORITY ORDER
   When trade-offs are needed, what matters most?
   (e.g., Narrative clarity > Harmonic sophistication > Lyrical poetry)

4. NON-NEGOTIABLES
   What elements MUST be present for the album to succeed?

5. GUARDRAILS
   What would take this album off-track? What to avoid?

6. SUCCESS CRITERIA
   How will we know if the album achieves its vision?

7. DELEGATION GUIDELINES
   What decisions can specialists make autonomously?
   What requires director approval?

This vision document will guide all subsequent work.""",

    "resolve_conflict": """Resolve a creative conflict between specialists.

CONFLICT SUMMARY:
{conflict_summary}

PERSPECTIVE 1 ({agent_1}):
{perspective_1}

PERSPECTIVE 2 ({agent_2}):
{perspective_2}

ALBUM VISION:
{album_vision}

CONTEXT:
{context}

Analyze both perspectives:
1. What is each specialist optimizing for?
2. Where do they agree?
3. What's the fundamental tension?

Make a decision:
1. Which approach (or synthesis) best serves the album vision?
2. What are you sacrificing with this choice?
3. How can you mitigate the downsides?

Communicate the decision:
1. Clear statement of the direction
2. Reasoning that respects both perspectives
3. Specific guidance for implementation

A good resolution leaves both specialists understanding why, even if they'd
have chosen differently.""",

    "review_album_state": """Review the current state of the album and provide direction.

ALBUM VISION:
{album_vision}

CURRENT STATE:
{current_state}

COMPLETED ELEMENTS:
{completed}

IN-PROGRESS:
{in_progress}

ISSUES/CONCERNS:
{issues}

Provide:

1. PROGRESS ASSESSMENT
   - What's working well?
   - What's falling short of vision?
   - Are we on track?

2. PRIORITY ADJUSTMENTS
   - What needs immediate attention?
   - What can wait?
   - Anything to cut or significantly change?

3. SPECIFIC DIRECTION
   - For each active workstream, provide guidance
   - Call out any decisions you're making
   - Flag any concerns that need discussion

4. NEXT MILESTONES
   - What should be accomplished next?
   - Who is responsible for what?

Be direct. If something isn't working, say so clearly.""",

    "final_review": """Conduct final review of the completed album.

ALBUM VISION:
{album_vision}

FINAL ALBUM:
{final_album}

ALL SONG DETAILS:
{song_details}

ALBUM BIBLE:
{album_bible}

Evaluate:

1. VISION ACHIEVEMENT
   - Does the album achieve its stated vision?
   - Rate 1-10 with specific reasoning

2. COHERENCE CHECK
   - Narrative coherence
   - Harmonic coherence
   - Stylistic coherence
   - Lyrical coherence
   - Rate each 1-10

3. FLOW AND PACING
   - Does the album work as a continuous experience?
   - Are there any pacing issues?
   - Does the order feel right?

4. STANDOUT MOMENTS
   - What are the album's highlights?
   - What are its weaknesses?

5. FINAL ADJUSTMENTS
   - Any last changes recommended?
   - Or is it ready?

6. EXECUTIVE SUMMARY
   - Overall assessment
   - Key strengths
   - Key areas for future improvement
   - Final sign-off or conditions

Be thorough but decisive. At some point, art needs to ship.""",

    "pacing_review": """Review and adjust album pacing.

CURRENT TRACKLIST:
{tracklist}

SONG CHARACTERISTICS:
{song_characteristics}

ALBUM VISION:
{album_vision}

Analyze pacing:

1. TEMPO MAP
   - Chart the tempo flow across the album
   - Identify energy peaks and valleys
   - Does the dynamic range feel right?

2. EMOTIONAL FLOW
   - Map emotional intensity across tracks
   - Are transitions smooth or intentionally jarring?
   - Does the emotional journey serve the narrative?

3. VARIETY VS. COHERENCE
   - Is there enough variety to maintain interest?
   - Is coherence maintained?

4. OPENING AND CLOSING
   - Does Track 1 properly establish the album?
   - Does the final track provide satisfying conclusion?

5. REORDERING RECOMMENDATIONS
   - Would a different order improve flow?
   - Any songs that should be moved, cut, or added?

Provide specific recommendations with reasoning.""",
}
