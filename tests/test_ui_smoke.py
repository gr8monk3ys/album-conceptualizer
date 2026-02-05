import pytest

gr = pytest.importorskip("gradio")

from album_conceptualizer.ui import create_app


def test_create_app_smoke():
    app = create_app()
    assert app is not None
    assert isinstance(app, gr.Blocks)
