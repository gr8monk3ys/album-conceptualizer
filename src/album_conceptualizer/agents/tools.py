"""Custom tools for CrewAI agents."""

from typing import Optional, Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

from album_conceptualizer.rag.retriever import UnifiedRetriever
from album_conceptualizer.rag.vector_store import MultiIndexStore
from album_conceptualizer.rag.embeddings import get_embedding_model


class LyricsSearchInput(BaseModel):
    """Input schema for lyrics search tool."""

    query: str = Field(description="Search query for finding relevant lyrics")
    granularity: str = Field(
        default="song",
        description="Search granularity: 'album', 'song', 'section', or 'line'",
    )
    top_k: int = Field(default=5, description="Number of results to return")


class LyricsSearchTool(BaseTool):
    """Tool for searching lyrics in the RAG system."""

    name: str = "lyrics_search"
    description: str = (
        "Search for lyrics that match a thematic or stylistic query. "
        "Use this to find lyrical inspiration, similar themes, or reference material. "
        "Specify granularity as 'album', 'song', 'section', or 'line' for different detail levels."
    )
    args_schema: Type[BaseModel] = LyricsSearchInput
    retriever: Optional[UnifiedRetriever] = None

    def __init__(self, retriever: UnifiedRetriever, **kwargs):
        super().__init__(**kwargs)
        self.retriever = retriever

    def _run(self, query: str, granularity: str = "song", top_k: int = 5) -> str:
        """Execute the lyrics search."""
        if not self.retriever:
            return "Error: Retriever not initialized"

        results = self.retriever.lyrics_retriever.retrieve(
            query=query,
            top_k=top_k,
            granularity=granularity,
        )

        if not results:
            return "No matching lyrics found."

        output_parts = [f"Found {len(results)} relevant lyrics:\n"]
        for i, (doc, score) in enumerate(results, 1):
            output_parts.append(f"\n--- Result {i} (relevance: {score:.2f}) ---")
            if doc.metadata.get("song_title"):
                output_parts.append(f"Song: {doc.metadata['song_title']}")
            if doc.metadata.get("album_title"):
                output_parts.append(f"Album: {doc.metadata['album_title']}")
            output_parts.append(f"\n{doc.content[:500]}...")

        return "\n".join(output_parts)


class ChordProgressionSearchInput(BaseModel):
    """Input schema for chord progression search tool."""

    query: str = Field(description="Search query for chord progressions")
    genre: Optional[str] = Field(default=None, description="Filter by genre")
    mood: Optional[str] = Field(default=None, description="Filter by mood/emotion")
    top_k: int = Field(default=5, description="Number of results to return")


class ChordProgressionSearchTool(BaseTool):
    """Tool for searching chord progressions."""

    name: str = "chord_progression_search"
    description: str = (
        "Search for chord progressions that match a style, genre, or emotional quality. "
        "Use this to find harmonic inspiration or progressions suitable for specific song sections. "
        "Can filter by genre and mood."
    )
    args_schema: Type[BaseModel] = ChordProgressionSearchInput
    retriever: Optional[UnifiedRetriever] = None

    def __init__(self, retriever: UnifiedRetriever, **kwargs):
        super().__init__(**kwargs)
        self.retriever = retriever

    def _run(
        self,
        query: str,
        genre: Optional[str] = None,
        mood: Optional[str] = None,
        top_k: int = 5,
    ) -> str:
        """Execute the chord progression search."""
        if not self.retriever:
            return "Error: Retriever not initialized"

        # Build enhanced query
        full_query = query
        if genre:
            full_query += f" {genre} style"
        if mood:
            full_query += f" {mood} feeling"

        results = self.retriever.music_theory_retriever.retrieve(
            query=full_query,
            top_k=top_k,
        )

        if not results:
            return "No matching chord progressions found."

        output_parts = [f"Found {len(results)} relevant progressions:\n"]
        for i, (doc, score) in enumerate(results, 1):
            output_parts.append(f"\n--- Progression {i} (relevance: {score:.2f}) ---")
            output_parts.append(doc.content)
            if doc.metadata.get("genre"):
                output_parts.append(f"Genre: {doc.metadata['genre']}")

        return "\n".join(output_parts)


class NarrativeStructureSearchInput(BaseModel):
    """Input schema for narrative structure search tool."""

    query: str = Field(description="Search query for narrative structures or concept album analyses")
    content_type: Optional[str] = Field(
        default=None,
        description="Type: 'structure_template' or 'album_analysis'",
    )
    top_k: int = Field(default=3, description="Number of results to return")


class NarrativeStructureSearchTool(BaseTool):
    """Tool for searching narrative structures and album analyses."""

    name: str = "narrative_structure_search"
    description: str = (
        "Search for narrative structures, story templates, and concept album analyses. "
        "Use this to understand how to structure a concept album or find examples of "
        "how other artists handled similar themes."
    )
    args_schema: Type[BaseModel] = NarrativeStructureSearchInput
    retriever: Optional[UnifiedRetriever] = None

    def __init__(self, retriever: UnifiedRetriever, **kwargs):
        super().__init__(**kwargs)
        self.retriever = retriever

    def _run(
        self,
        query: str,
        content_type: Optional[str] = None,
        top_k: int = 3,
    ) -> str:
        """Execute the narrative structure search."""
        if not self.retriever:
            return "Error: Retriever not initialized"

        if content_type == "structure_template":
            results = self.retriever.narrative_retriever.retrieve_structure_templates(
                structure_type=query,
                top_k=top_k,
            )
        else:
            results = self.retriever.narrative_retriever.retrieve(
                query=query,
                top_k=top_k,
            )

        if not results:
            return "No matching narrative structures found."

        output_parts = [f"Found {len(results)} relevant structures:\n"]
        for i, (doc, score) in enumerate(results, 1):
            output_parts.append(f"\n--- Structure {i} (relevance: {score:.2f}) ---")
            output_parts.append(doc.content)

        return "\n".join(output_parts)


class MotifTrackerInput(BaseModel):
    """Input schema for motif tracker tool."""

    action: str = Field(description="Action: 'add', 'get', 'list', 'track'")
    motif_name: str = Field(default="", description="Name of the motif")
    track_number: Optional[int] = Field(default=None, description="Track number for tracking")
    section: Optional[str] = Field(default=None, description="Section where motif appears")
    variation: Optional[str] = Field(default=None, description="Variation notes")


class MotifTrackerTool(BaseTool):
    """Tool for tracking recurring motifs across the album."""

    name: str = "motif_tracker"
    description: str = (
        "Track and manage recurring musical or lyrical motifs across the album. "
        "Use 'add' to register a new motif, 'track' to record where a motif appears, "
        "'get' to retrieve motif details, and 'list' to see all motifs."
    )
    args_schema: Type[BaseModel] = MotifTrackerInput
    motifs: dict = {}

    def _run(
        self,
        action: str,
        motif_name: str = "",
        track_number: Optional[int] = None,
        section: Optional[str] = None,
        variation: Optional[str] = None,
    ) -> str:
        """Execute motif tracking action."""
        if action == "add":
            if not motif_name:
                return "Error: motif_name required for 'add' action"
            self.motifs[motif_name] = {"appearances": [], "description": variation or ""}
            return f"Added motif: {motif_name}"

        elif action == "track":
            if not motif_name or track_number is None:
                return "Error: motif_name and track_number required for 'track' action"
            if motif_name not in self.motifs:
                self.motifs[motif_name] = {"appearances": [], "description": ""}
            self.motifs[motif_name]["appearances"].append({
                "track": track_number,
                "section": section,
                "variation": variation,
            })
            return f"Tracked {motif_name} in track {track_number}"

        elif action == "get":
            if motif_name not in self.motifs:
                return f"Motif '{motif_name}' not found"
            motif = self.motifs[motif_name]
            appearances = "\n".join(
                [f"  - Track {a['track']}, {a.get('section', 'N/A')}: {a.get('variation', 'standard')}"
                 for a in motif["appearances"]]
            )
            return f"Motif: {motif_name}\nDescription: {motif['description']}\nAppearances:\n{appearances}"

        elif action == "list":
            if not self.motifs:
                return "No motifs tracked yet"
            return "Tracked motifs:\n" + "\n".join(
                [f"- {name}: {len(data['appearances'])} appearances"
                 for name, data in self.motifs.items()]
            )

        return f"Unknown action: {action}"


def create_agent_tools(retriever: UnifiedRetriever) -> dict:
    """Create all agent tools with the given retriever."""
    return {
        "lyrics_search": LyricsSearchTool(retriever=retriever),
        "chord_search": ChordProgressionSearchTool(retriever=retriever),
        "narrative_search": NarrativeStructureSearchTool(retriever=retriever),
        "motif_tracker": MotifTrackerTool(),
    }
