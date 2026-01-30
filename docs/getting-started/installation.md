# Installation

This guide covers all installation methods for Album Conceptualizer.

## Prerequisites

- **Python 3.11** or higher
- **uv** (recommended) or pip

## Quick Install

### Using uv (Recommended)

[uv](https://docs.astral.sh/uv/) is a fast Python package manager.

```bash
# Clone the repository
git clone https://github.com/gr8monk3ys/album-conceptualizer.git
cd album-conceptualizer

# Install with uv
uv pip install --system -e .
```

### Using pip

```bash
# Clone the repository
git clone https://github.com/gr8monk3ys/album-conceptualizer.git
cd album-conceptualizer

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install
pip install -e .
```

### Using Docker

```bash
# Build and run
docker compose up -d app

# Access at http://localhost:7860
```

## Optional Dependencies

Album Conceptualizer uses optional dependencies to keep the base install light.
Install what you need:

### AI Features

For CrewAI multi-agent workflows:

```bash
uv pip install --system -e ".[ai]"
```

### RAG Features

For vector search and embeddings:

```bash
uv pip install --system -e ".[rag]"
```

### Music Processing

For MIDI and MusicXML export:

```bash
uv pip install --system -e ".[music]"
```

### Web UI

For the Gradio interface:

```bash
uv pip install --system -e ".[ui]"
```

### Full Installation

Install everything:

```bash
uv pip install --system -e ".[full]"
```

### Development

For contributing:

```bash
uv pip install --system -e ".[dev]"
```

## Configuration

### API Keys

For AI features, set your API keys:

```bash
# Create .env file
cat > .env << EOF
ANTHROPIC_API_KEY=your-key-here
# Or for OpenAI
OPENAI_API_KEY=your-key-here
EOF
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude | None |
| `OPENAI_API_KEY` | OpenAI API key | None |
| `LOG_LEVEL` | Logging level | INFO |
| `CHROMA_PERSIST_DIR` | ChromaDB storage path | ./data/chroma |
| `ALBUM_CONCEPTUALIZER_TELEMETRY` | Enable telemetry | false |

## Verify Installation

```bash
# Check CLI
album-conceptualizer --help

# Run tests
pytest tests/ -v

# Start API
uvicorn album_conceptualizer.api.app:app --reload
```

## Troubleshooting

### Import Errors

If you see import errors, ensure all dependencies are installed:

```bash
uv pip install --system -e ".[full,dev]"
```

### MIDI Export Not Working

MIDI export requires compiled dependencies:

```bash
uv pip install --system -e ".[music]"
```

### ChromaDB Issues

If ChromaDB fails to initialize:

```bash
# Clear the database
rm -rf ./data/chroma

# Reinstall
uv pip install --system chromadb --force-reinstall
```

## Next Steps

- [Quick Start Guide](quickstart.md) - Create your first album
- [Configuration](configuration.md) - Customize settings
- [REST API](../api/rest-api.md) - API documentation
