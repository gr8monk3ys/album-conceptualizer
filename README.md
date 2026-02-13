# Album Conceptualizer

A RAG-powered concept album ideation system with multi-agent orchestration.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)

## Overview

Album Conceptualizer is an AI-powered tool for creating cohesive concept albums. It combines:

- **RAG (Retrieval-Augmented Generation)** for music theory knowledge, lyrical inspiration, and narrative structures
- **Multi-agent orchestration** using CrewAI with specialized agents (Lyricist, Music Theorist, Narrative Specialist, Style Matcher, Album Director)
- **Export capabilities** to MIDI, ChordPro, and MusicXML for integration with DAWs and notation software

This is the first tool of its kind—while AI lyric generators and chord progression tools exist separately, no existing product addresses the unique challenge of maintaining narrative and thematic coherence across an entire concept album.

## Features

### Core Capabilities

- **Album Bible**: Central reference document inspired by Sudowrite's Story Bible, tracking themes, characters, motifs, and style guidelines
- **Hierarchical Lyrics RAG**: Search at album, song, section, or line level with hybrid semantic/keyword search
- **Music Theory Knowledge Base**: Integration with Chordonomicon (666K+ progressions), emotion-to-music mapping
- **Narrative Structure Templates**: Hero's Journey, Three-Act, Circular, Non-Linear structures with beat sheets
- **Multi-Agent Workflow**: Specialized AI agents collaborate to develop songs while maintaining album coherence

### Export Formats

- **MIDI**: Universal format for DAWs (Ableton, Logic, FL Studio, etc.)
- **ChordPro**: Standard for live performance apps (OnSong, SongBook)
- **MusicXML**: For notation software (MuseScore, Finale, Sibelius, Dorico)
- **JSON**: Complete data export for programmatic access

### User Interface

- **Album Canvas**: High-level overview with tracklist, themes, and narrative arc visualization
- **Album Bible Editor**: Define and track all conceptual elements
- **Song Editor**: Detailed editing with lyrics, chords, structure, and production notes
- **Chord Tools**: Progression builder with common templates and analysis
- **AI Agents Panel**: Run agent workflows for ideation and coherence checking

## Installation

### Prerequisites

- Python 3.11 or higher
- [uv](https://docs.astral.sh/uv/) (recommended) or pip

### Quick Start with uv (Recommended)

```bash
# Clone the repository
git clone https://github.com/gr8monk3ys/album-conceptualizer.git
cd album-conceptualizer

# Install with uv
uv pip install --system -e .

# For development dependencies
uv pip install --system -e ".[dev]"

# For full installation (all optional features)
uv pip install --system -e ".[full]"
```

### Quick Start with pip

```bash
# Clone the repository
git clone https://github.com/gr8monk3ys/album-conceptualizer.git
cd album-conceptualizer

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install the package
pip install -e .
```

### Docker Installation

```bash
# Build and run with Docker Compose
docker compose up -d app

# Or build manually
docker build -t album-conceptualizer .
docker run -p 7860:7860 album-conceptualizer
```

### Optional Dependencies

Install specific feature sets as needed:

```bash
# AI/ML features (CrewAI, LangChain)
uv pip install --system -e ".[ai]"

# RAG features (ChromaDB, Sentence Transformers)
uv pip install --system -e ".[rag]"

# Music processing (music21, MIDI)
uv pip install --system -e ".[music]"

# Web UI (Gradio)
uv pip install --system -e ".[ui]"
```

#### Compatibility Note (CrewAI vs LangChain OpenAI)

CrewAI currently pins the OpenAI SDK to a narrower range than `langchain-openai`.
That means installing the `ai` extra together with `langchain-openai` in the same
environment will fail dependency resolution. If you need `langchain-openai`, install
it in a separate environment, or omit the `ai` extra and use LangChain directly.

### API Keys

For AI agent functionality, set your API keys:

```bash
# Create a .env file
echo "ANTHROPIC_API_KEY=your-key-here" >> .env
# Or for OpenAI
echo "OPENAI_API_KEY=your-key-here" >> .env
```

## Usage

### Command Line Interface

```bash
# Launch the web UI
album-conceptualizer ui

# Create a new album project
album-conceptualizer new "My Concept Album" --artist "Artist Name"

# Export an album to various formats
album-conceptualizer export album.json --format all

# Index chord progressions for RAG
album-conceptualizer index chordonomicon --path data/chordonomicon.csv
```

### Python API

```python
from album_conceptualizer.models.album import Album, Song, Section, SectionType
from album_conceptualizer.models.album_bible import AlbumBible, Theme, Character
from album_conceptualizer.agents.crew import AlbumCrewManager
from album_conceptualizer.export.formats import AlbumExporter, ExportFormat

# Create an album
album = Album(
    title="The Journey Home",
    artist="The Storytellers",
    concept_summary="A traveler's journey through memory and time",
)

# Create the Album Bible
bible = AlbumBible(
    album_title="The Journey Home",
    logline="A weary traveler discovers that home was within them all along",
    synopsis="...",
)

# Add themes
bible.add_theme(Theme(
    name="Identity",
    description="Exploring who we are when stripped of familiar surroundings",
))

# Create songs
song = Song(
    title="Setting Out",
    track_number=1,
    key="D major",
    tempo=120,
    narrative_position="Opening/Exposition",
)
song.add_section(Section(
    section_type=SectionType.VERSE,
    order=1,
    lyrics="The morning light breaks through...",
    chord_progression=["D", "A", "Bm", "G"],
))

album.add_song(song)

# Export
exporter = AlbumExporter(output_dir="./output", artist_name=album.artist)
results = exporter.export_album(album, [ExportFormat.MIDI, ExportFormat.CHORDPRO])
```

### Using AI Agents

```python
from album_conceptualizer.agents.crew import AlbumCrewManager

# Initialize the crew manager
manager = AlbumCrewManager(verbose=True)

# Create and run a vision development crew
vision_crew = manager.create_vision_crew(
    concept="A concept album about the last day of summer",
    references="Pink Floyd, Arcade Fire, Sufjan Stevens",
    themes="nostalgia, change, memory",
    track_count=10,
)

result = vision_crew.kickoff()
print(result)
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACE (Gradio)                   │
│  Album Canvas | Album Bible | Song Editor | Chord Tools      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                 MULTI-AGENT ORCHESTRATION (CrewAI)           │
│  Album Director → Lyricist ↔ Music Theorist ↔ Narrative      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌───────────────┬───────────────┬─────────────────────────────┐
│  Lyrics RAG   │ Music Theory  │  Narrative Structure        │
│  (Chroma)     │  RAG          │  RAG                        │
└───────────────┴───────────────┴─────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    EXPORT LAYER                              │
│  MIDI (pretty_midi) | ChordPro | MusicXML (music21)          │
└─────────────────────────────────────────────────────────────┘
```

## Agent Roles

| Agent | Role | Expertise |
|-------|------|-----------|
| **Album Director** | Creative overseer | Final decisions, conflict resolution, vision protection |
| **Lyricist** | Lyrics specialist | Emotionally resonant lyrics, narrative threading, motif development |
| **Music Theorist** | Harmonic expert | Chord progressions, key relationships, musical motifs |
| **Narrative Specialist** | Story architect | Character arcs, theme tracking, structure validation |
| **Style Matcher** | Production guide | Genre consistency, reference analysis, production notes |

## Data Sources

The system can integrate with:

- **Chordonomicon**: 666,000+ chord progressions with genre/era metadata ([HuggingFace](https://huggingface.co/datasets/ailsntua/Chordonomicon))
- **Hooktheory Trends API**: Chord transition probabilities from 65,000+ songs
- **Emotion datasets**: EMOPIA, PMEmo, DEAM for emotion-to-music mapping
- **Custom lyrics**: Index your own reference material

## Development

## Production Checklist

- Ensure `.env` includes required API keys and settings.
- If API access is exposed, set `ALBUM_CONCEPTUALIZER_API_KEY` and restrict CORS.
- For rotation, use `ALBUM_CONCEPTUALIZER_API_KEYS=key1,key2`.
- Use `ALBUM_CONCEPTUALIZER_STORAGE_BACKEND=sqlite` or `file` for persistence.
- For shared/clustered deployments, plan for Redis-backed rate limits and quotas.
- For websocket collaboration across multiple app instances, set
  `ALBUM_CONCEPTUALIZER_COLLAB_REALTIME_BACKEND=redis` and configure
  `ALBUM_CONCEPTUALIZER_REDIS_URL`.
- Tune collaboration presence/lock TTL with
  `ALBUM_CONCEPTUALIZER_COLLAB_REALTIME_TTL_SECONDS` (default `90`).
- Enable rate limiting (`ALBUM_CONCEPTUALIZER_RATE_LIMIT_ENABLED=true`).
- Enable quotas (`ALBUM_CONCEPTUALIZER_QUOTA_ENABLED=true`).
- Set `LOG_LEVEL=INFO` (or `DEBUG`) and monitor logs.
- Set `ALBUM_CONCEPTUALIZER_STORAGE_BACKEND=file` to persist API data.
- Confirm `output/projects/` is writable.
- Run a smoke flow: create album → export → open ZIP.
- Verify API health endpoints (`/api/v1/live`, `/api/v1/ready`).
- Monitor logs for errors or `ERROR_OCCURRED` telemetry events (if enabled).

### Production Run

- `scripts/run-prod.sh` starts API + UI containers.
- `scripts/stop-prod.sh` stops containers.
- `scripts/run-prod-compose.sh` uses `docker-compose.prod.yml` with production defaults.


### Using Make Commands

```bash
# See all available commands
make help

# Install dev dependencies
make install-dev

# Run linter
make lint

# Format code
make format

# Run tests
make test

# Run tests with coverage
make test-cov
```

### Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=album_conceptualizer --cov-report=html

# Run specific test file
pytest tests/test_models.py

# Run fast (stop on first failure)
make test-fast
```

### Code Quality

```bash
# Lint with ruff
ruff check album_conceptualizer/ tests/

# Format with ruff
ruff format album_conceptualizer/ tests/

# Type check
mypy album_conceptualizer/

# Pre-commit hooks
pre-commit run --all-files
```

### Docker Development

```bash
# Run development container with hot reload
docker compose --profile dev up

# Run tests in container
docker compose --profile test up

# Start with full stack (including ChromaDB)
docker compose --profile full up
```

## Project Structure

```
album-conceptualizer/
├── album_conceptualizer/
│   ├── models/           # Data models (Album, Song, AlbumBible, etc.)
│   ├── rag/              # RAG system (embeddings, vector store, retrievers)
│   ├── agents/           # CrewAI agents and crews
│   ├── export/           # Export formats (MIDI, ChordPro, MusicXML)
│   ├── ui/               # Gradio web interface
│   ├── config.py         # Configuration management
│   └── cli.py            # Command-line interface
├── tests/                # Test suite
├── .github/workflows/    # CI/CD pipelines
├── Dockerfile            # Container definition
├── docker-compose.yml    # Container orchestration
├── Makefile              # Development commands
├── pyproject.toml        # Project configuration (uv/hatch)
└── README.md
```

## Roadmap

- [x] Core data models and Album Bible
- [x] RAG system with multi-index support
- [x] CrewAI multi-agent orchestration
- [x] Export to MIDI, ChordPro, MusicXML
- [x] Gradio web interface
- [ ] Chordonomicon dataset integration
- [ ] Reference track audio analysis
- [ ] Real-time collaboration features
- [ ] DAW plugin integrations (VST/AU)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [CrewAI](https://github.com/joaomdmoura/crewai) for multi-agent orchestration
- [LangChain](https://github.com/langchain-ai/langchain) for RAG infrastructure
- [Chordonomicon](https://huggingface.co/datasets/ailsntua/Chordonomicon) for chord progression data
- [music21](https://web.mit.edu/music21/) for music theory analysis
- [Gradio](https://gradio.app/) for the web interface

---

*Album Conceptualizer - Transform your concept album vision into reality*
