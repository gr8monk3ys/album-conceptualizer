"""User interface components for Album Conceptualizer."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:  # pragma: no cover - import for type checkers only
    from album_conceptualizer.ui.app import create_app as create_app
    from album_conceptualizer.ui.app import launch_app as launch_app


def create_app(*args, **kwargs):  # type: ignore[override]
    """Lazily import and create the Gradio app."""
    from album_conceptualizer.ui.app import create_app as _create_app

    return _create_app(*args, **kwargs)


def launch_app(*args, **kwargs):  # type: ignore[override]
    """Lazily import and launch the Gradio app."""
    from album_conceptualizer.ui.app import launch_app as _launch_app

    return _launch_app(*args, **kwargs)


__all__ = ["create_app", "launch_app"]
