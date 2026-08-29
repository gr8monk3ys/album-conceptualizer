"""The API must actually have its routes.

From fastapi 0.137.0, a router included into a router included into the app
contributes NOTHING and raises nothing. This API is built from exactly that
shape (v1/__init__ nests albums, songs, theory, export, audio, experience and
agents under subscription_router, which is itself included into router, which
create_app includes into the app), so the failure mode is a server that boots,
answers /health, and 404s every real endpoint -- indistinguishable from a
healthy deploy until someone makes a request.

pyproject pins fastapi <0.137 for this reason. These tests are what makes
raising that bound safe: if a future release fixes nested routing, they pass
and the pin can move. If it does not, they fail loudly here instead of
silently in production.
"""

from __future__ import annotations

from fastapi import APIRouter, FastAPI

from album_conceptualizer.api.app import create_app


def test_nested_include_router_actually_registers_routes():
    """The exact shape this API depends on, in isolation."""
    child = APIRouter()

    @child.get("/thing")
    async def thing():  # pragma: no cover - never called
        return {}

    parent = APIRouter()
    parent.include_router(child, prefix="/sub")
    app = FastAPI()
    app.include_router(parent, prefix="/api")

    paths = [r.path for r in app.routes if getattr(r, "path", "").startswith("/api")]
    assert paths == ["/api/sub/thing"], (
        "Nested include_router dropped the route. This is the fastapi >=0.137 "
        "regression the <0.137 pin in pyproject.toml exists to prevent."
    )


def test_the_real_app_has_its_v1_routes():
    """A guard against shipping an app that serves nothing.

    Asserts a floor rather than an exact count so adding endpoints does not
    break the test, while a collapse to zero -- the actual failure -- does.
    """
    app = create_app()
    v1 = [r.path for r in app.routes if getattr(r, "path", "").startswith("/api/v1")]
    assert len(v1) > 50, f"expected the full v1 surface, got {len(v1)} routes: {v1[:10]}"


def test_representative_endpoints_from_each_nesting_depth_exist():
    """One path per nesting level, so a partial collapse is caught too."""
    app = create_app()
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    for expected in (
        "/api/v1/health",  # router -> app
        "/api/v1/identity/register",  # router -> sub-router -> app
        "/api/v1/theory/scale",  # router -> subscription_router -> sub -> app
        "/api/v1/export/progression/mp3",
        "/api/v1/audio/generate",
    ):
        assert expected in paths, f"{expected} missing -- nested routing is broken"
