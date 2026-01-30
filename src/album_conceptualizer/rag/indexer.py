"""Document indexing for the RAG system."""

from typing import Optional
from uuid import uuid4

from album_conceptualizer.rag.embeddings import Document, EmbeddingModel
from album_conceptualizer.rag.vector_store import ChromaVectorStore, MultiIndexStore
from album_conceptualizer.models.album import Album, Song, Section
from album_conceptualizer.models.music_theory import ChordProgression


class DocumentIndexer:
    """Base class for document indexing."""

    def __init__(
        self,
        vector_store: ChromaVectorStore,
        embedding_model: EmbeddingModel,
    ):
        self.vector_store = vector_store
        self.embedding_model = embedding_model

    def index_text(
        self,
        text: str,
        doc_type: str,
        metadata: Optional[dict] = None,
        doc_id: Optional[str] = None,
    ) -> str:
        """Index a single text document."""
        doc = Document(
            id=doc_id or str(uuid4()),
            content=text,
            metadata=metadata or {},
            doc_type=doc_type,
        )
        ids = self.vector_store.add_documents([doc])
        return ids[0]

    def index_texts(
        self,
        texts: list[str],
        doc_type: str,
        metadatas: Optional[list[dict]] = None,
    ) -> list[str]:
        """Index multiple text documents."""
        metadatas = metadatas or [{} for _ in texts]
        docs = [
            Document(
                id=str(uuid4()),
                content=text,
                metadata=meta,
                doc_type=doc_type,
            )
            for text, meta in zip(texts, metadatas)
        ]
        return self.vector_store.add_documents(docs)


class LyricsIndexer(DocumentIndexer):
    """
    Indexer for lyrics with hierarchical chunking support.

    Creates documents at multiple granularities:
    - Album level: Overall thematic summary
    - Song level: Full song lyrics with context
    - Section level: Individual verses, choruses, bridges
    - Line level: Individual lines with surrounding context
    """

    def __init__(
        self,
        vector_store: ChromaVectorStore,
        embedding_model: EmbeddingModel,
        index_lines: bool = False,  # Line-level indexing optional due to volume
    ):
        super().__init__(vector_store, embedding_model)
        self.index_lines = index_lines

    def index_album(self, album: Album) -> dict[str, list[str]]:
        """
        Index an entire album at multiple granularities.

        Returns dict mapping granularity to list of document IDs.
        """
        result = {"album": [], "song": [], "section": [], "line": []}

        # Album-level document
        album_summary = self._create_album_summary(album)
        album_doc = Document(
            id=f"album_{album.id}",
            content=album_summary,
            metadata={
                "album_title": album.title,
                "artist": album.artist or "",
                "primary_genre": album.primary_genre or "",
                "themes": ",".join(album.central_themes),
                "chunk_level": "album",
            },
            doc_type="lyrics",
        )
        result["album"] = self.vector_store.add_documents([album_doc])

        # Index each song
        for song in album.songs:
            song_ids = self.index_song(song, album.title)
            result["song"].extend(song_ids["song"])
            result["section"].extend(song_ids["section"])
            result["line"].extend(song_ids["line"])

        return result

    def index_song(
        self,
        song: Song,
        album_title: Optional[str] = None,
    ) -> dict[str, list[str]]:
        """Index a single song at multiple granularities."""
        result = {"song": [], "section": [], "line": []}

        # Song-level document
        full_lyrics = song.get_full_lyrics()
        if full_lyrics:
            song_doc = Document(
                id=f"song_{song.id}",
                content=full_lyrics,
                metadata={
                    "song_title": song.title,
                    "album_title": album_title or "",
                    "track_number": song.track_number,
                    "key": song.key or "",
                    "tempo": song.tempo or 0,
                    "themes": ",".join(song.themes),
                    "mood_tags": ",".join(song.mood_tags),
                    "narrative_position": song.narrative_position or "",
                    "chunk_level": "song",
                },
                doc_type="lyrics",
                parent_id=f"album_{album_title}" if album_title else None,
            )
            result["song"] = self.vector_store.add_documents([song_doc])

        # Section-level documents
        for section in song.sections:
            if section.lyrics:
                section_doc = Document(
                    id=f"section_{section.id}",
                    content=section.lyrics,
                    metadata={
                        "song_title": song.title,
                        "section_type": section.section_type,
                        "section_order": section.order,
                        "narrative_function": section.narrative_function or "",
                        "emotional_arc": section.emotional_arc or "",
                        "chunk_level": "section",
                    },
                    doc_type="lyrics",
                    parent_id=f"song_{song.id}",
                )
                result["section"].extend(self.vector_store.add_documents([section_doc]))

        # Line-level documents (optional)
        if self.index_lines and full_lyrics:
            line_ids = self._index_lines(song, full_lyrics)
            result["line"] = line_ids

        return result

    def _index_lines(self, song: Song, full_lyrics: str, context_window: int = 2) -> list[str]:
        """Index individual lines with surrounding context."""
        lines = [l for l in full_lyrics.split("\n") if l.strip() and not l.startswith("[")]
        docs = []

        for i, line in enumerate(lines):
            # Get context window
            start = max(0, i - context_window)
            end = min(len(lines), i + context_window + 1)
            context = lines[start:end]
            context_text = "\n".join(context)

            doc = Document(
                id=f"line_{song.id}_{i}",
                content=context_text,
                metadata={
                    "song_title": song.title,
                    "line_index": i,
                    "focal_line": line,
                    "chunk_level": "line",
                },
                doc_type="lyrics",
                parent_id=f"song_{song.id}",
            )
            docs.append(doc)

        if docs:
            return self.vector_store.add_documents(docs)
        return []

    def _create_album_summary(self, album: Album) -> str:
        """Create a summary document for the album."""
        parts = [
            f"Album: {album.title}",
            f"Artist: {album.artist or 'Unknown'}",
        ]

        if album.concept_summary:
            parts.append(f"Concept: {album.concept_summary}")

        if album.central_themes:
            parts.append(f"Themes: {', '.join(album.central_themes)}")

        if album.primary_genre:
            parts.append(f"Genre: {album.primary_genre}")

        parts.append("\nTracklist:")
        for song in album.songs:
            parts.append(f"{song.track_number}. {song.title}")
            if song.narrative_summary:
                parts.append(f"   - {song.narrative_summary}")

        return "\n".join(parts)


class ChordProgressionIndexer(DocumentIndexer):
    """
    Indexer for chord progressions from Chordonomicon and other sources.

    Handles:
    - Chord progression sequences
    - Genre/subgenre metadata
    - Roman numeral analysis
    - Emotional mappings
    """

    def index_progression(
        self,
        progression: ChordProgression,
    ) -> str:
        """Index a single chord progression."""
        # Create searchable content
        content_parts = [
            f"Chord progression: {' - '.join(progression.to_symbols())}",
        ]

        if progression.roman_numerals:
            content_parts.append(f"Roman numerals: {' - '.join(progression.roman_numerals)}")

        if progression.key:
            content_parts.append(f"Key: {progression.key.tonic} {progression.key.mode}")

        if progression.genre:
            content_parts.append(f"Genre: {progression.genre}")

        if progression.emotional_descriptors:
            content_parts.append(f"Mood: {', '.join(progression.emotional_descriptors)}")

        content = "\n".join(content_parts)

        doc = Document(
            id=f"progression_{progression.id}",
            content=content,
            metadata={
                "chords": ",".join(progression.to_symbols()),
                "key": f"{progression.key.tonic} {progression.key.mode}" if progression.key else "",
                "genre": progression.genre or "",
                "subgenre": progression.subgenre or "",
                "section_type": progression.section_type or "",
                "valence": progression.valence or 0,
                "arousal": progression.arousal or 0,
            },
            doc_type="chord_progression",
        )

        ids = self.vector_store.add_documents([doc])
        return ids[0]

    def index_progressions_batch(
        self,
        progressions: list[ChordProgression],
        batch_size: int = 100,
    ) -> list[str]:
        """Index a batch of chord progressions."""
        all_ids = []

        for i in range(0, len(progressions), batch_size):
            batch = progressions[i : i + batch_size]
            docs = []

            for prog in batch:
                content_parts = [f"Chord progression: {' - '.join(prog.to_symbols())}"]

                if prog.roman_numerals:
                    content_parts.append(f"Roman numerals: {' - '.join(prog.roman_numerals)}")

                if prog.key:
                    content_parts.append(f"Key: {prog.key.tonic} {prog.key.mode}")

                if prog.genre:
                    content_parts.append(f"Genre: {prog.genre}")

                content = "\n".join(content_parts)

                doc = Document(
                    id=f"progression_{prog.id}",
                    content=content,
                    metadata={
                        "chords": ",".join(prog.to_symbols()),
                        "key": f"{prog.key.tonic} {prog.key.mode}" if prog.key else "",
                        "genre": prog.genre or "",
                        "subgenre": prog.subgenre or "",
                    },
                    doc_type="chord_progression",
                )
                docs.append(doc)

            ids = self.vector_store.add_documents(docs)
            all_ids.extend(ids)

        return all_ids

    def index_from_chordonomicon(
        self,
        csv_path: str,
        limit: Optional[int] = None,
    ) -> list[str]:
        """
        Index chord progressions from the Chordonomicon dataset.

        Expected CSV columns: chords, genre, subgenre, decade, section
        """
        import pandas as pd

        df = pd.read_csv(csv_path)
        if limit:
            df = df.head(limit)

        docs = []
        for _, row in df.iterrows():
            chords = row.get("chords", "")
            if not chords:
                continue

            content_parts = [f"Chord progression: {chords}"]

            genre = row.get("genre", "")
            subgenre = row.get("subgenre", "")
            section = row.get("section", "")
            decade = row.get("decade", "")

            if genre:
                content_parts.append(f"Genre: {genre}")
            if subgenre:
                content_parts.append(f"Subgenre: {subgenre}")
            if section:
                content_parts.append(f"Section type: {section}")
            if decade:
                content_parts.append(f"Era: {decade}")

            content = "\n".join(content_parts)

            doc = Document(
                id=str(uuid4()),
                content=content,
                metadata={
                    "chords": chords,
                    "genre": genre,
                    "subgenre": subgenre,
                    "section_type": section,
                    "decade": str(decade) if decade else "",
                },
                doc_type="chord_progression",
            )
            docs.append(doc)

        return self.vector_store.add_documents(docs)


class NarrativeIndexer(DocumentIndexer):
    """
    Indexer for narrative structure content.

    Handles:
    - Concept album analyses
    - Story structure templates
    - Character arc patterns
    """

    def index_album_analysis(
        self,
        album_title: str,
        artist: str,
        analysis_text: str,
        themes: list[str],
        structure_type: str,
    ) -> str:
        """Index an analysis of a concept album."""
        content = f"""Album Analysis: {album_title} by {artist}

{analysis_text}

Themes: {', '.join(themes)}
Narrative Structure: {structure_type}"""

        doc = Document(
            id=f"analysis_{album_title.lower().replace(' ', '_')}",
            content=content,
            metadata={
                "album_title": album_title,
                "artist": artist,
                "themes": ",".join(themes),
                "structure_type": structure_type,
                "content_type": "album_analysis",
            },
            doc_type="narrative",
        )

        ids = self.vector_store.add_documents([doc])
        return ids[0]

    def index_structure_template(
        self,
        structure_name: str,
        description: str,
        beats: list[dict],
    ) -> str:
        """Index a narrative structure template."""
        beats_text = "\n".join(
            [f"- {b['name']}: {b['description']}" for b in beats]
        )

        content = f"""Narrative Structure: {structure_name}

{description}

Story Beats:
{beats_text}"""

        doc = Document(
            id=f"structure_{structure_name.lower().replace(' ', '_')}",
            content=content,
            metadata={
                "structure_name": structure_name,
                "num_beats": len(beats),
                "content_type": "structure_template",
            },
            doc_type="narrative",
        )

        ids = self.vector_store.add_documents([doc])
        return ids[0]

    def index_default_structures(self) -> list[str]:
        """Index common narrative structure templates."""
        structures = [
            {
                "name": "Hero's Journey",
                "description": "Joseph Campbell's monomyth structure, commonly used in epic concept albums.",
                "beats": [
                    {"name": "Ordinary World", "description": "Establish the protagonist's normal life"},
                    {"name": "Call to Adventure", "description": "Disruption that initiates the journey"},
                    {"name": "Refusal of the Call", "description": "Initial resistance to change"},
                    {"name": "Meeting the Mentor", "description": "Guidance and preparation"},
                    {"name": "Crossing the Threshold", "description": "Commitment to the journey"},
                    {"name": "Tests, Allies, Enemies", "description": "Challenges and character development"},
                    {"name": "Approach to the Inmost Cave", "description": "Preparation for major ordeal"},
                    {"name": "The Ordeal", "description": "Central crisis and transformation"},
                    {"name": "Reward", "description": "Achievement or revelation"},
                    {"name": "The Road Back", "description": "Return journey begins"},
                    {"name": "Resurrection", "description": "Final test and transformation"},
                    {"name": "Return with Elixir", "description": "Resolution and new equilibrium"},
                ],
            },
            {
                "name": "Three-Act Structure",
                "description": "Classic dramatic structure with setup, confrontation, and resolution.",
                "beats": [
                    {"name": "Act 1 - Setup", "description": "Introduce characters, world, and conflict"},
                    {"name": "Inciting Incident", "description": "Event that sets the story in motion"},
                    {"name": "Plot Point 1", "description": "Major turn into Act 2"},
                    {"name": "Act 2 - Confrontation", "description": "Rising action and complications"},
                    {"name": "Midpoint", "description": "Major revelation or shift"},
                    {"name": "Plot Point 2", "description": "Major turn into Act 3"},
                    {"name": "Act 3 - Resolution", "description": "Climax and denouement"},
                ],
            },
            {
                "name": "Circular Narrative",
                "description": "Story ends where it began, often with new understanding. Used in albums like The Wall.",
                "beats": [
                    {"name": "Opening State", "description": "Establish initial situation (will return here)"},
                    {"name": "Departure", "description": "Movement away from the starting point"},
                    {"name": "Journey/Transformation", "description": "Core narrative development"},
                    {"name": "Return", "description": "Coming back to the beginning"},
                    {"name": "Resolution", "description": "Same place, different understanding"},
                ],
            },
            {
                "name": "Non-Linear/Fragmented",
                "description": "Timeline jumps, multiple perspectives. Used in GKMC-style narratives.",
                "beats": [
                    {"name": "Hook/Flash-Forward", "description": "Start in media res or at a crucial moment"},
                    {"name": "Origin Point", "description": "Jump to the beginning of the story"},
                    {"name": "Parallel Threads", "description": "Multiple storylines or timeframes"},
                    {"name": "Convergence", "description": "Threads begin to connect"},
                    {"name": "Revelation", "description": "Context that reframes earlier events"},
                    {"name": "Resolution", "description": "Final understanding of the full picture"},
                ],
            },
        ]

        ids = []
        for structure in structures:
            doc_id = self.index_structure_template(
                structure["name"],
                structure["description"],
                structure["beats"],
            )
            ids.append(doc_id)

        return ids
