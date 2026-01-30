"""Vector store implementations for the RAG system."""

from abc import ABC, abstractmethod
from pathlib import Path
from uuid import uuid4

from album_conceptualizer.rag.embeddings import Document, EmbeddingModel


class VectorStore(ABC):
    """Abstract base class for vector stores."""

    @abstractmethod
    def add_documents(self, documents: list[Document]) -> list[str]:
        """Add documents to the store."""
        pass

    @abstractmethod
    def search(
        self,
        query_embedding: list[float],
        top_k: int = 5,
        filter_dict: dict | None = None,
    ) -> list[tuple[Document, float]]:
        """Search for similar documents."""
        pass

    @abstractmethod
    def delete(self, ids: list[str]) -> None:
        """Delete documents by ID."""
        pass

    @abstractmethod
    def get(self, ids: list[str]) -> list[Document]:
        """Get documents by ID."""
        pass


class ChromaVectorStore(VectorStore):
    """Vector store using ChromaDB."""

    def __init__(
        self,
        collection_name: str,
        embedding_model: EmbeddingModel,
        persist_directory: Path | None = None,
    ):
        """
        Initialize the Chroma vector store.

        Args:
            collection_name: Name of the collection
            embedding_model: Model for generating embeddings
            persist_directory: Directory for persistence (None for in-memory)
        """
        import chromadb
        from chromadb.config import Settings

        self.collection_name = collection_name
        self.embedding_model = embedding_model

        if persist_directory:
            self.client = chromadb.PersistentClient(
                path=str(persist_directory),
                settings=Settings(anonymized_telemetry=False),
            )
        else:
            self.client = chromadb.Client(
                settings=Settings(anonymized_telemetry=False),
            )

        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
        )

    def add_documents(self, documents: list[Document]) -> list[str]:
        """Add documents to the store."""
        if not documents:
            return []

        ids = []
        embeddings = []
        metadatas = []
        contents = []

        for doc in documents:
            doc_id = doc.id or str(uuid4())
            ids.append(doc_id)

            # Generate embedding if not provided
            if doc.embedding:
                embeddings.append(doc.embedding)
            else:
                embeddings.append(self.embedding_model.embed_text(doc.content))

            # Prepare metadata (ChromaDB requires flat dict)
            metadata = {**doc.metadata}
            metadata["doc_type"] = doc.doc_type
            if doc.parent_id:
                metadata["parent_id"] = doc.parent_id
            if doc.source:
                metadata["source"] = doc.source
            if doc.chunk_index is not None:
                metadata["chunk_index"] = doc.chunk_index
            if doc.total_chunks is not None:
                metadata["total_chunks"] = doc.total_chunks

            metadatas.append(metadata)
            contents.append(doc.content)

        self.collection.add(
            ids=ids,
            embeddings=embeddings,
            metadatas=metadatas,
            documents=contents,
        )

        return ids

    def search(
        self,
        query_embedding: list[float],
        top_k: int = 5,
        filter_dict: dict | None = None,
    ) -> list[tuple[Document, float]]:
        """Search for similar documents."""
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            where=filter_dict,
            include=["documents", "metadatas", "distances"],
        )

        documents_with_scores = []
        if results["ids"] and results["ids"][0]:
            for i, doc_id in enumerate(results["ids"][0]):
                doc = Document(
                    id=doc_id,
                    content=results["documents"][0][i] if results["documents"] else "",
                    metadata=results["metadatas"][0][i] if results["metadatas"] else {},
                    doc_type=results["metadatas"][0][i].get("doc_type", "general")
                    if results["metadatas"]
                    else "general",
                )
                # ChromaDB returns distance, convert to similarity score
                distance = results["distances"][0][i] if results["distances"] else 0
                similarity = 1 - distance  # For cosine distance
                documents_with_scores.append((doc, similarity))

        return documents_with_scores

    def delete(self, ids: list[str]) -> None:
        """Delete documents by ID."""
        self.collection.delete(ids=ids)

    def get(self, ids: list[str]) -> list[Document]:
        """Get documents by ID."""
        results = self.collection.get(
            ids=ids,
            include=["documents", "metadatas"],
        )

        documents = []
        if results["ids"]:
            for i, doc_id in enumerate(results["ids"]):
                doc = Document(
                    id=doc_id,
                    content=results["documents"][i] if results["documents"] else "",
                    metadata=results["metadatas"][i] if results["metadatas"] else {},
                    doc_type=results["metadatas"][i].get("doc_type", "general")
                    if results["metadatas"]
                    else "general",
                )
                documents.append(doc)

        return documents

    def keyword_search(
        self,
        query: str,
        top_k: int = 5,
        filter_dict: dict | None = None,
    ) -> list[tuple[Document, float]]:
        """
        Perform keyword-based search (BM25-style).

        Note: ChromaDB doesn't have native BM25, so we use document contains.
        For production, consider Weaviate for true hybrid search.
        """
        results = self.collection.query(
            query_texts=[query],
            n_results=top_k,
            where=filter_dict,
            include=["documents", "metadatas", "distances"],
        )

        documents_with_scores = []
        if results["ids"] and results["ids"][0]:
            for i, doc_id in enumerate(results["ids"][0]):
                doc = Document(
                    id=doc_id,
                    content=results["documents"][0][i] if results["documents"] else "",
                    metadata=results["metadatas"][0][i] if results["metadatas"] else {},
                    doc_type=results["metadatas"][0][i].get("doc_type", "general")
                    if results["metadatas"]
                    else "general",
                )
                distance = results["distances"][0][i] if results["distances"] else 0
                similarity = 1 - distance
                documents_with_scores.append((doc, similarity))

        return documents_with_scores

    def count(self) -> int:
        """Get the number of documents in the collection."""
        return self.collection.count()


class MultiIndexStore:
    """
    Multi-index vector store for different document types.

    Maintains separate collections for lyrics, music theory, and narrative
    to enable type-specific retrieval strategies.
    """

    def __init__(
        self,
        embedding_model: EmbeddingModel,
        persist_directory: Path | None = None,
    ):
        """Initialize multi-index store with separate collections."""
        self.embedding_model = embedding_model
        self.persist_directory = persist_directory

        # Create separate collections for different document types
        self.lyrics_store = ChromaVectorStore(
            collection_name="lyrics",
            embedding_model=embedding_model,
            persist_directory=persist_directory,
        )
        self.music_theory_store = ChromaVectorStore(
            collection_name="music_theory",
            embedding_model=embedding_model,
            persist_directory=persist_directory,
        )
        self.narrative_store = ChromaVectorStore(
            collection_name="narrative",
            embedding_model=embedding_model,
            persist_directory=persist_directory,
        )

    def get_store_for_type(self, doc_type: str) -> ChromaVectorStore:
        """Get the appropriate store for a document type."""
        stores = {
            "lyrics": self.lyrics_store,
            "chord_progression": self.music_theory_store,
            "music_theory": self.music_theory_store,
            "narrative": self.narrative_store,
            "reference": self.narrative_store,
        }
        return stores.get(doc_type, self.lyrics_store)

    def add_documents(self, documents: list[Document]) -> dict[str, list[str]]:
        """Add documents to appropriate stores based on type."""
        # Group documents by type
        by_type: dict[str, list[Document]] = {}
        for doc in documents:
            doc_type = doc.doc_type
            if doc_type not in by_type:
                by_type[doc_type] = []
            by_type[doc_type].append(doc)

        # Add to respective stores
        results: dict[str, list[str]] = {}
        for doc_type, docs in by_type.items():
            store = self.get_store_for_type(doc_type)
            ids = store.add_documents(docs)
            results[doc_type] = ids

        return results

    def search_all(
        self,
        query_embedding: list[float],
        top_k: int = 5,
        weights: dict[str, float] | None = None,
    ) -> list[tuple[Document, float]]:
        """Search across all stores with optional weighting."""
        weights = weights or {"lyrics": 1.0, "music_theory": 1.0, "narrative": 1.0}

        all_results = []

        for store_name, weight in weights.items():
            store = getattr(self, f"{store_name}_store", None)
            if store and weight > 0:
                results = store.search(query_embedding, top_k=top_k)
                # Apply weight to scores
                weighted_results = [(doc, score * weight) for doc, score in results]
                all_results.extend(weighted_results)

        # Sort by weighted score and return top_k
        all_results.sort(key=lambda x: x[1], reverse=True)
        return all_results[:top_k]
