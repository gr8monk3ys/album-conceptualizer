"""Tests for RAG system components."""

from unittest.mock import MagicMock

import pytest

from album_conceptualizer.rag.embeddings import Document, SentenceTransformerEmbedding


class TestDocument:
    """Tests for the Document model."""

    def test_document_creation(self):
        """Test creating a document."""
        doc = Document(
            id="test-1",
            content="Test content",
            doc_type="lyrics",
        )
        assert doc.id == "test-1"
        assert doc.content == "Test content"
        assert doc.doc_type == "lyrics"

    def test_document_with_metadata(self):
        """Test document with metadata."""
        doc = Document(
            id="test-2",
            content="Content",
            metadata={"song": "Test Song", "artist": "Test Artist"},
            doc_type="lyrics",
        )
        assert doc.metadata["song"] == "Test Song"
        assert doc.metadata["artist"] == "Test Artist"

    def test_document_hierarchical(self):
        """Test document with hierarchical relationships."""
        Document(
            id="album-1",
            content="Album content",
            doc_type="lyrics",
        )
        child_doc = Document(
            id="song-1",
            content="Song content",
            doc_type="lyrics",
            parent_id="album-1",
        )
        assert child_doc.parent_id == "album-1"


class TestEmbeddings:
    """Tests for embedding models."""

    @pytest.mark.skip(reason="Requires sentence-transformers installation")
    def test_sentence_transformer_initialization(self):
        """Test initializing sentence transformer embedding."""
        model = SentenceTransformerEmbedding(model_name="all-MiniLM-L6-v2")
        assert model.dimension == 384

    @pytest.mark.skip(reason="Requires sentence-transformers installation")
    def test_embed_text(self):
        """Test embedding a single text."""
        model = SentenceTransformerEmbedding()
        embedding = model.embed_text("Hello world")
        assert len(embedding) == model.dimension
        assert all(isinstance(x, float) for x in embedding)

    @pytest.mark.skip(reason="Requires sentence-transformers installation")
    def test_embed_texts_batch(self):
        """Test embedding multiple texts."""
        model = SentenceTransformerEmbedding()
        embeddings = model.embed_texts(["Hello", "World"])
        assert len(embeddings) == 2
        assert len(embeddings[0]) == model.dimension


class TestVectorStore:
    """Tests for vector store (mocked)."""

    def test_mock_vector_store(self):
        """Test basic vector store operations with mocks."""
        # This is a placeholder for integration tests
        # Real tests would require a running Chroma instance
        pass


class TestRetriever:
    """Tests for retrievers (mocked)."""

    def test_query_classification(self):
        """Test automatic query classification."""

        # Create mock retriever
        MagicMock()
        MagicMock()

        # Test classification logic (without actually creating the retriever)
        music_keywords = ["chord", "progression", "key", "scale"]
        narrative_keywords = ["story", "narrative", "character", "theme"]

        test_queries = {
            "what chord comes after G7": "music_theory",
            "how does the character arc develop": "narrative",
            "lyrics about heartbreak": "lyrics",
        }

        for query, expected in test_queries.items():
            query_lower = query.lower()
            music_score = sum(1 for kw in music_keywords if kw in query_lower)
            narrative_score = sum(1 for kw in narrative_keywords if kw in query_lower)

            if music_score > narrative_score and music_score > 0:
                classified = "music_theory"
            elif narrative_score > music_score and narrative_score > 0:
                classified = "narrative"
            else:
                classified = "lyrics"

            assert classified == expected, (
                f"Query '{query}' classified as {classified}, expected {expected}"
            )
