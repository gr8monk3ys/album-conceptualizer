"""ASGI entrypoint for the engine on Vercel.

Lives at `api/index.py` because Vercel's Python runtime only turns files
under `api/` into serverless functions -- a `server.py` at the project root
is ignored, and the deploy fails with "doesn't match any Serverless
Functions inside the `api` directory".

`vercel.json` rewrites every path here, so FastAPI sees the real request
path and its own routing applies unchanged.

The sys.path insert is required. requirements.txt installs the engine's
DEPENDENCIES, but nothing installs the engine itself -- Vercel does not run
`pip install -e .`, so `album_conceptualizer/` ships in the bundle beside
this file without ever being importable. Without this the function fails at
import with ModuleNotFoundError and every route 500s, which looks from
outside exactly like a broken app rather than a packaging gap.

Only the BASE dependency set is installed. The `[ai]` extra -- crewai,
langchain, chromadb -- is excluded: far past the serverless bundle limit,
and the agent endpoints already degrade to a 503 that says so. Everything
that does not need an LLM runs here: music theory, MIDI/ChordPro/MusicXML
export, health.
"""

import sys
from pathlib import Path


_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from album_conceptualizer.api.app import app  # noqa: E402


__all__ = ["app"]
