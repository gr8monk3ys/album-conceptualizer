"""
Album Conceptualizer - A RAG-powered concept album ideation system.

This package provides tools for creating concept albums using AI-powered
ideation, including multi-agent orchestration, music theory RAG, and
narrative coherence tracking.
"""

__version__ = "0.3.0"
__author__ = "Lorenzo"

from album_conceptualizer.models.album import Album, Section, Song
from album_conceptualizer.models.album_bible import AlbumBible


__all__ = [
    "Album",
    "AlbumBible",
    "Section",
    "Song",
    "__version__",
]
