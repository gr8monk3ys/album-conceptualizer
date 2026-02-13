import pytest

from album_conceptualizer.ui import create_app


gr = pytest.importorskip("gradio")


def test_create_app_smoke():
    app = create_app()
    assert app is not None
    assert isinstance(app, gr.Blocks)
