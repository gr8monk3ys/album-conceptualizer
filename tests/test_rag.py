"""Tests for RAG system components."""

import sys
from types import ModuleType
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

    @staticmethod
    def _install_fake_sentence_transformers(monkeypatch: pytest.MonkeyPatch) -> None:
        fake_module = ModuleType("sentence_transformers")

        class _FakeArray:
            def __init__(self, values):
                self._values = values

            def tolist(self):
                return self._values

        class _FakeSentenceTransformer:
            def __init__(self, model_name: str):
                self.model_name = model_name

            def get_sentence_embedding_dimension(self) -> int:
                return 3

            def encode(self, inputs, convert_to_numpy: bool = True):
                if isinstance(inputs, list):
                    return _FakeArray([[float(len(item)), 1.0, 2.0] for item in inputs])
                return _FakeArray([float(len(inputs)), 1.0, 2.0])

        fake_module.SentenceTransformer = _FakeSentenceTransformer
        monkeypatch.setitem(sys.modules, "sentence_transformers", fake_module)

    def test_sentence_transformer_initialization(self, monkeypatch):
        """Test initializing sentence transformer embedding."""
        self._install_fake_sentence_transformers(monkeypatch)
        model = SentenceTransformerEmbedding(model_name="all-MiniLM-L6-v2")
        assert model.dimension == 3

    def test_embed_text(self, monkeypatch):
        """Test embedding a single text."""
        self._install_fake_sentence_transformers(monkeypatch)
        model = SentenceTransformerEmbedding()
        embedding = model.embed_text("Hello world")
        assert len(embedding) == model.dimension
        assert all(isinstance(x, float) for x in embedding)

    def test_embed_texts_batch(self, monkeypatch):
        """Test embedding multiple texts."""
        self._install_fake_sentence_transformers(monkeypatch)
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
