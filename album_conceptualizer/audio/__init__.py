"""Generative audio: turn an album-coherent brief into a rendered track.

This is deliberately separate from `album_conceptualizer.export.audio`, which
renders a chord progression deterministically through fluidsynth. That path
answers "what do these chords sound like". This one answers "what does this
song sound like", by sending a structured brief to a text-to-music model.
"""

from album_conceptualizer.audio.prompt import (
    GenerationBrief,
    build_generation_prompt,
    build_negative_prompt,
)
from album_conceptualizer.audio.providers import (
    GenerationRequest,
    GenerationResult,
    MusicProvider,
    ProviderNotConfiguredError,
    ProviderRequestError,
    get_provider,
)


__all__ = [
    "GenerationBrief",
    "GenerationRequest",
    "GenerationResult",
    "MusicProvider",
    "ProviderNotConfiguredError",
    "ProviderRequestError",
    "build_generation_prompt",
    "build_negative_prompt",
    "get_provider",
]
