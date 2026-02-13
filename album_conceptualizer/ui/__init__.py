"""User interface components for Album Conceptualizer."""

from __future__ import annotations


def create_app(*args, **kwargs):
    """Lazily import and create the Gradio app."""
    from album_conceptualizer.ui.app import create_app as _create_app

    return _create_app(*args, **kwargs)


def launch_app(*args, **kwargs):
    """Lazily import and launch the Gradio app."""
    from album_conceptualizer.ui.app import launch_app as _launch_app

    return _launch_app(*args, **kwargs)


__all__ = ["create_app", "launch_app"]
