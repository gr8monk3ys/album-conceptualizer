"""Retriever implementations for different query types."""

from abc import ABC, abstractmethod
from typing import Optional

from album_conceptualizer.rag.embeddings import Document, EmbeddingModel
from album_conceptualizer.rag.vector_store import ChromaVectorStore, MultiIndexStore


class BaseRetriever(ABC):
    """Abstract base class for retrievers."""

    @abstractmethod
    def retrieve(
        self,
        query: str,
        top_k: int = 5,
        **kwargs,
    ) -> list[tuple[Document, float]]:
        """Retrieve relevant documents for a query."""
        pass


class HybridRetriever(BaseRetriever):
    """
    Hybrid retriever combining semantic and keyword search.

    Uses alpha parameter to balance between semantic (vector) and keyword (BM25) search.
    Alpha = 1.0 means pure semantic, alpha = 0.0 means pure keyword.
    Default alpha = 0.6 (favoring semantic for creative queries).
    """

    def __init__(
        self,
        vector_store: ChromaVectorStore,
        embedding_model: EmbeddingModel,
        alpha: float = 0.6,
    ):
        """
        Initialize hybrid retriever.

        Args:
            vector_store: The vector store to search
            embedding_model: Model for query embedding
            alpha: Weight for semantic search (0-1)
        """
        self.vector_store = vector_store
        self.embedding_model = embedding_model
        self.alpha = alpha

    def retrieve(
        self,
        query: str,
        top_k: int = 5,
        filter_dict: Optional[dict] = None,
        alpha: Optional[float] = None,
    ) -> list[tuple[Document, float]]:
        """
        Retrieve documents using hybrid search.

        Args:
            query: The search query
            top_k: Number of results to return
            filter_dict: Optional metadata filters
            alpha: Override default alpha for this query
        """
        alpha = alpha if alpha is not None else self.alpha

        # Get semantic results
        query_embedding = self.embedding_model.embed_text(query)
        semantic_results = self.vector_store.search(
            query_embedding=query_embedding,
            top_k=top_k * 2,  # Get more to merge
            filter_dict=filter_dict,
        )

        # Get keyword results
        keyword_results = self.vector_store.keyword_search(
            query=query,
            top_k=top_k * 2,
            filter_dict=filter_dict,
        )

        # Merge results using reciprocal rank fusion
        return self._merge_results(semantic_results, keyword_results, alpha, top_k)

    def _merge_results(
        self,
        semantic_results: list[tuple[Document, float]],
        keyword_results: list[tuple[Document, float]],
        alpha: float,
        top_k: int,
    ) -> list[tuple[Document, float]]:
        """Merge semantic and keyword results using weighted RRF."""
        k = 60  # RRF constant

        # Calculate RRF scores
        doc_scores: dict[str, tuple[Document, float]] = {}

        for rank, (doc, _) in enumerate(semantic_results):
            rrf_score = alpha * (1 / (k + rank + 1))
            doc_scores[doc.id] = (doc, rrf_score)

        for rank, (doc, _) in enumerate(keyword_results):
            rrf_score = (1 - alpha) * (1 / (k + rank + 1))
            if doc.id in doc_scores:
                existing_doc, existing_score = doc_scores[doc.id]
                doc_scores[doc.id] = (existing_doc, existing_score + rrf_score)
            else:
                doc_scores[doc.id] = (doc, rrf_score)

        # Sort by combined score
        sorted_results = sorted(doc_scores.values(), key=lambda x: x[1], reverse=True)
        return sorted_results[:top_k]


class LyricsRetriever(BaseRetriever):
    """
    Specialized retriever for lyrics with hierarchical support.

    Supports retrieval at different granularities:
    - Album level: Find songs with similar themes
    - Song level: Match entire song contexts
    - Section level: Match verses, choruses, bridges
    - Line level: Find specific lyrical phrases
    """

    def __init__(
        self,
        vector_store: ChromaVectorStore,
        embedding_model: EmbeddingModel,
    ):
        self.vector_store = vector_store
        self.embedding_model = embedding_model
        self.hybrid = HybridRetriever(vector_store, embedding_model, alpha=0.6)

    def retrieve(
        self,
        query: str,
        top_k: int = 5,
        granularity: str = "song",
        **kwargs,
    ) -> list[tuple[Document, float]]:
        """
        Retrieve lyrics at specified granularity.

        Args:
            query: The search query
            top_k: Number of results
            granularity: 'album', 'song', 'section', or 'line'
        """
        filter_dict = {"chunk_level": granularity} if granularity != "any" else None
        return self.hybrid.retrieve(query, top_k=top_k, filter_dict=filter_dict)

    def retrieve_by_emotion(
        self,
        valence: float,
        arousal: float,
        top_k: int = 5,
    ) -> list[tuple[Document, float]]:
        """
        Retrieve lyrics matching emotional coordinates.

        Args:
            valence: -1 (negative) to 1 (positive)
            arousal: -1 (calm) to 1 (energetic)
            top_k: Number of results
        """
        # Create emotion description query
        valence_desc = "positive, happy, hopeful" if valence > 0 else "negative, sad, melancholic"
        arousal_desc = "energetic, intense, powerful" if arousal > 0 else "calm, peaceful, gentle"
        query = f"Lyrics that feel {valence_desc} and {arousal_desc}"

        return self.hybrid.retrieve(query, top_k=top_k)

    def find_similar_sections(
        self,
        section_content: str,
        section_type: Optional[str] = None,
        top_k: int = 5,
    ) -> list[tuple[Document, float]]:
        """Find sections similar to the given content."""
        filter_dict = {"section_type": section_type} if section_type else None
        return self.hybrid.retrieve(section_content, top_k=top_k, filter_dict=filter_dict)


class MusicTheoryRetriever(BaseRetriever):
    """
    Specialized retriever for music theory content.

    Handles chord progressions, scales, harmonic analysis with
    higher keyword weight for music terminology.
    """

    def __init__(
        self,
        vector_store: ChromaVectorStore,
        embedding_model: EmbeddingModel,
    ):
        self.vector_store = vector_store
        self.embedding_model = embedding_model
        # Higher keyword weight for music terminology
        self.hybrid = HybridRetriever(vector_store, embedding_model, alpha=0.4)

    def retrieve(
        self,
        query: str,
        top_k: int = 5,
        **kwargs,
    ) -> list[tuple[Document, float]]:
        """Retrieve music theory content."""
        return self.hybrid.retrieve(query, top_k=top_k)

    def retrieve_by_progression(
        self,
        chord_symbols: list[str],
        top_k: int = 5,
    ) -> list[tuple[Document, float]]:
        """Find similar chord progressions."""
        query = " ".join(chord_symbols)
        return self.hybrid.retrieve(query, top_k=top_k, alpha=0.3)  # Favor keyword

    def retrieve_by_key_and_genre(
        self,
        key: str,
        genre: Optional[str] = None,
        top_k: int = 5,
    ) -> list[tuple[Document, float]]:
        """Find progressions in a specific key and genre."""
        filter_dict = {"key": key}
        if genre:
            filter_dict["genre"] = genre

        query = f"chord progression in {key}"
        if genre:
            query += f" {genre} style"

        return self.hybrid.retrieve(query, top_k=top_k, filter_dict=filter_dict)

    def retrieve_for_emotion(
        self,
        emotion_descriptors: list[str],
        top_k: int = 5,
    ) -> list[tuple[Document, float]]:
        """Find progressions matching emotional descriptors."""
        query = f"chord progression that sounds {', '.join(emotion_descriptors)}"
        return self.hybrid.retrieve(query, top_k=top_k)


class NarrativeRetriever(BaseRetriever):
    """
    Specialized retriever for narrative structure content.

    Handles concept album analyses, story structures, character arcs.
    """

    def __init__(
        self,
        vector_store: ChromaVectorStore,
        embedding_model: EmbeddingModel,
    ):
        self.vector_store = vector_store
        self.embedding_model = embedding_model
        self.hybrid = HybridRetriever(vector_store, embedding_model, alpha=0.7)

    def retrieve(
        self,
        query: str,
        top_k: int = 5,
        **kwargs,
    ) -> list[tuple[Document, float]]:
        """Retrieve narrative structure content."""
        return self.hybrid.retrieve(query, top_k=top_k)

    def retrieve_structure_templates(
        self,
        structure_type: str,
        top_k: int = 5,
    ) -> list[tuple[Document, float]]:
        """Find narrative structure templates."""
        query = f"{structure_type} narrative structure for concept album"
        filter_dict = {"content_type": "structure_template"}
        return self.hybrid.retrieve(query, top_k=top_k, filter_dict=filter_dict)

    def retrieve_album_analyses(
        self,
        themes: list[str],
        top_k: int = 5,
    ) -> list[tuple[Document, float]]:
        """Find analyses of albums with similar themes."""
        query = f"concept album analysis with themes: {', '.join(themes)}"
        filter_dict = {"content_type": "album_analysis"}
        return self.hybrid.retrieve(query, top_k=top_k, filter_dict=filter_dict)


class UnifiedRetriever:
    """
    Unified retriever that routes queries to appropriate specialized retrievers.

    Provides a single interface for all retrieval needs.
    """

    def __init__(
        self,
        multi_index_store: MultiIndexStore,
        embedding_model: EmbeddingModel,
    ):
        self.embedding_model = embedding_model
        self.lyrics_retriever = LyricsRetriever(
            multi_index_store.lyrics_store, embedding_model
        )
        self.music_theory_retriever = MusicTheoryRetriever(
            multi_index_store.music_theory_store, embedding_model
        )
        self.narrative_retriever = NarrativeRetriever(
            multi_index_store.narrative_store, embedding_model
        )

    def retrieve(
        self,
        query: str,
        retriever_type: str = "auto",
        top_k: int = 5,
        **kwargs,
    ) -> list[tuple[Document, float]]:
        """
        Retrieve documents using the appropriate retriever.

        Args:
            query: The search query
            retriever_type: 'lyrics', 'music_theory', 'narrative', or 'auto'
            top_k: Number of results
            **kwargs: Additional arguments for the retriever
        """
        if retriever_type == "auto":
            retriever_type = self._classify_query(query)

        retrievers = {
            "lyrics": self.lyrics_retriever,
            "music_theory": self.music_theory_retriever,
            "narrative": self.narrative_retriever,
        }

        retriever = retrievers.get(retriever_type, self.lyrics_retriever)
        return retriever.retrieve(query, top_k=top_k, **kwargs)

    def _classify_query(self, query: str) -> str:
        """Classify query to determine best retriever."""
        query_lower = query.lower()

        # Music theory keywords
        music_theory_keywords = [
            "chord", "progression", "key", "scale", "harmony",
            "major", "minor", "dominant", "tonic", "cadence",
            "mode", "tempo", "rhythm", "melody",
        ]

        # Narrative keywords
        narrative_keywords = [
            "story", "narrative", "arc", "character", "theme",
            "structure", "plot", "journey", "act", "climax",
            "resolution", "concept", "motif",
        ]

        music_score = sum(1 for kw in music_theory_keywords if kw in query_lower)
        narrative_score = sum(1 for kw in narrative_keywords if kw in query_lower)

        if music_score > narrative_score and music_score > 0:
            return "music_theory"
        elif narrative_score > music_score and narrative_score > 0:
            return "narrative"
        else:
            return "lyrics"

    def retrieve_for_song_context(
        self,
        song_title: str,
        narrative_position: str,
        themes: list[str],
        mood: str,
        top_k: int = 3,
    ) -> dict[str, list[tuple[Document, float]]]:
        """
        Retrieve comprehensive context for creating a song.

        Returns results from all retrievers relevant to the song context.
        """
        results = {}

        # Get lyrical inspiration
        lyrics_query = f"Lyrics with themes of {', '.join(themes)}, mood: {mood}"
        results["lyrics"] = self.lyrics_retriever.retrieve(lyrics_query, top_k=top_k)

        # Get harmonic suggestions
        theory_query = f"Chord progressions for {mood} {themes[0] if themes else ''}"
        results["music_theory"] = self.music_theory_retriever.retrieve(
            theory_query, top_k=top_k
        )

        # Get narrative structure guidance
        narrative_query = f"Concept album song at {narrative_position} position"
        results["narrative"] = self.narrative_retriever.retrieve(
            narrative_query, top_k=top_k
        )

        return results
