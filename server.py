"""ASGI entrypoint for the engine on Vercel.

Vercel's Python runtime imports `app` from this module and serves it
directly -- there is no uvicorn process, so nothing here starts a server.

Only the BASE dependency set is installed (see requirements.txt). The `[ai]`
extra -- crewai, langchain, chromadb -- is deliberately excluded: it is far
past the serverless bundle limit, and the agent endpoints already degrade to
a 503 that says so when it is absent. Everything that does not need an LLM
runs here: music theory, MIDI/ChordPro/MusicXML export, health.
"""

from album_conceptualizer.api.app import app

__all__ = ["app"]
