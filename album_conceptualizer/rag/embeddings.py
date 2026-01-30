"""Embedding models for the RAG system."""

from abc import ABC, abstractmethod

from pydantic import BaseModel, Field


class EmbeddingModel(ABC):
    """Abstract base class for embedding models."""

    @abstractmethod
    def embed_text(self, text: str) -> list[float]:
        """Embed a single text."""
        pass

    @abstractmethod
    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Embed multiple texts."""
        pass

    @property
    @abstractmethod
    def dimension(self) -> int:
        """Return the embedding dimension."""
        pass


class SentenceTransformerEmbedding(EmbeddingModel):
    """Embedding model using sentence-transformers."""

    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        """
        Initialize the embedding model.

        Args:
            model_name: Name of the sentence-transformer model to use.
                       Recommended models:
                       - all-MiniLM-L6-v2: Fast, good quality (384 dim)
                       - all-mpnet-base-v2: Higher quality, slower (768 dim)
                       - paraphrase-multilingual-MiniLM-L12-v2: Multilingual (384 dim)
        """
        from sentence_transformers import SentenceTransformer

        self.model_name = model_name
        self._model = SentenceTransformer(model_name)
        self._dimension = self._model.get_sentence_embedding_dimension()

    def embed_text(self, text: str) -> list[float]:
        """Embed a single text."""
        embedding = self._model.encode(text, convert_to_numpy=True)
        return embedding.tolist()

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Embed multiple texts."""
        embeddings = self._model.encode(texts, convert_to_numpy=True)
        return embeddings.tolist()

    @property
    def dimension(self) -> int:
        """Return the embedding dimension."""
        return self._dimension


class OpenAIEmbedding(EmbeddingModel):
    """Embedding model using OpenAI's API."""

    def __init__(
        self,
        model_name: str = "text-embedding-3-small",
        api_key: str | None = None,
    ):
        """
        Initialize the OpenAI embedding model.

        Args:
            model_name: Name of the OpenAI embedding model.
            api_key: OpenAI API key (optional, uses env var if not provided).
        """
        import openai

        self.model_name = model_name
        if api_key:
            self.client = openai.OpenAI(api_key=api_key)
        else:
            self.client = openai.OpenAI()

        # Dimension depends on model
        self._dimensions = {
            "text-embedding-3-small": 1536,
            "text-embedding-3-large": 3072,
            "text-embedding-ada-002": 1536,
        }
        self._dimension = self._dimensions.get(model_name, 1536)

    def embed_text(self, text: str) -> list[float]:
        """Embed a single text."""
        response = self.client.embeddings.create(
            input=text,
            model=self.model_name,
        )
        return response.data[0].embedding

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Embed multiple texts."""
        response = self.client.embeddings.create(
            input=texts,
            model=self.model_name,
        )
        return [item.embedding for item in response.data]

    @property
    def dimension(self) -> int:
        """Return the embedding dimension."""
        return self._dimension


class Document(BaseModel):
    """A document for the RAG system."""

    id: str
    content: str
    metadata: dict = Field(default_factory=dict)
    embedding: list[float] | None = None

    # Hierarchical structure support
    parent_id: str | None = None
    children_ids: list[str] = Field(default_factory=list)

    # Document type for multi-index routing
    doc_type: str = Field(
        default="general",
        description="Type: 'lyrics', 'chord_progression', 'narrative', 'reference'",
    )

    # Chunking metadata
    chunk_index: int | None = None
    total_chunks: int | None = None
    source: str | None = None


class ChunkedDocument(BaseModel):
    """A document that has been chunked for indexing."""

    original_id: str
    chunks: list[Document]
    chunk_strategy: str = Field(description="Strategy used: 'fixed', 'semantic', 'hierarchical'")


def get_embedding_model(model_type: str = "sentence_transformer", **kwargs) -> EmbeddingModel:
    """
    Factory function to get an embedding model.

    Args:
        model_type: Type of model ('sentence_transformer' or 'openai')
        **kwargs: Additional arguments passed to the model constructor

    Returns:
        An embedding model instance
    """
    if model_type == "sentence_transformer":
        return SentenceTransformerEmbedding(**kwargs)
    elif model_type == "openai":
        return OpenAIEmbedding(**kwargs)
    else:
        raise ValueError(f"Unknown model type: {model_type}")
