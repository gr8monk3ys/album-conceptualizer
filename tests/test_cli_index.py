"""Tests for the `album-conceptualizer index` CLI command."""

import argparse
import sys

import pytest

from album_conceptualizer.cli import cmd_index
from album_conceptualizer.models.album import Album, Song


class _FakeEmbeddingModel:
    """Stand-in embedding model; LyricsIndexer never calls it directly."""


class _FakeChromaVectorStore:
    """Captures documents instead of touching a real Chroma instance."""

    instances: list["_FakeChromaVectorStore"] = []

    def __init__(self, collection_name, embedding_model, persist_directory=None):
        self.collection_name = collection_name
        self.embedding_model = embedding_model
        self.persist_directory = persist_directory
        self.documents = []
        _FakeChromaVectorStore.instances.append(self)

    def add_documents(self, documents):
        self.documents.extend(documents)
        return [doc.id for doc in documents]


@pytest.fixture(autouse=True)
def _reset_fake_store():
    _FakeChromaVectorStore.instances = []
    yield
    _FakeChromaVectorStore.instances = []


@pytest.fixture
def _patched_rag(monkeypatch):
    """Swap the real embedding model / vector store for test doubles."""
    monkeypatch.setattr(
        "album_conceptualizer.rag.embeddings.get_embedding_model",
        lambda *args, **kwargs: _FakeEmbeddingModel(),
    )
    monkeypatch.setattr(
        "album_conceptualizer.rag.vector_store.ChromaVectorStore",
        _FakeChromaVectorStore,
    )


def _album_path(tmp_path):
    album = Album(title="Test Album", artist="Test Artist")
    album.add_song(Song(title="Opener", track_number=1, narrative_summary="Where it all begins."))
    path = tmp_path / "album.json"
    path.write_text(album.model_dump_json())
    return path


class TestCmdIndexLyrics:
    """Tests for `index lyrics`."""

    def test_requires_path(self, capsys):
        args = argparse.Namespace(source="lyrics", path=None, limit=None)
        with pytest.raises(SystemExit) as exc_info:
            cmd_index(args)
        assert exc_info.value.code == 1
        assert "--path required" in capsys.readouterr().out

    def test_errors_on_missing_file(self, tmp_path, capsys):
        args = argparse.Namespace(source="lyrics", path=str(tmp_path / "missing.json"), limit=None)
        with pytest.raises(SystemExit) as exc_info:
            cmd_index(args)
        assert exc_info.value.code == 1
        assert "File not found" in capsys.readouterr().out

    def test_indexes_album_lyrics(self, tmp_path, capsys, _patched_rag):
        album_path = _album_path(tmp_path)
        args = argparse.Namespace(source="lyrics", path=str(album_path), limit=None)

        cmd_index(args)

        out = capsys.readouterr().out
        assert "Indexed" in out
        assert len(_FakeChromaVectorStore.instances) == 1
        store = _FakeChromaVectorStore.instances[0]
        assert store.collection_name == "lyrics"
        # At minimum the album-level summary document was indexed.
        assert len(store.documents) >= 1
        assert any(doc.doc_type == "lyrics" for doc in store.documents)


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
