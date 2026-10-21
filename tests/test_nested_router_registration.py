"""The API must actually have its routes.

This API is built from nested includes (v1/__init__ nests albums, songs,
theory, export, audio, experience and agents under subscription_router, which
is itself included into router, which create_app includes into the app). If
nested routing ever broke, the failure mode would be a server that boots,
answers /health, and 404s every real endpoint -- indistinguishable from a
healthy deploy until someone makes a request. These tests exist so that shows
up here instead.

History: pyproject pinned fastapi <0.137 from 2026-08-29 to 2026-09-20 on the
belief that 0.137 dropped nested routes. It did not. 0.137.0 (fastapi #15745)
stopped flattening ``include_router`` into copied ``APIRoute`` objects and
keeps a tree of ``_IncludedRouter`` nodes instead, so ``app.routes`` no longer
carries a ``.path`` for anything under an included router -- and the previous
version of this file measured "0 routes" by iterating exactly that. Every
request was served the whole time: the real app exposes the same 104
operations under 0.136.3 and 0.141.1. So these tests read the OpenAPI schema
(which walks the tree) and make real requests; they never iterate
``app.routes``, which fastapi now calls an internal implementation detail.
"""

from __future__ import annotations

from fastapi import APIRouter, FastAPI
from fastapi.testclient import TestClient

from album_conceptualizer.api.app import create_app


def _paths(app: FastAPI) -> set[str]:
    """Every path the app serves, from the OpenAPI schema (version-stable)."""
    return set(app.openapi()["paths"])


def test_nested_include_router_actually_registers_routes():
    """The exact shape this API depends on, in isolation: schema and a request."""
    child = APIRouter()

    @child.get("/thing")
    async def thing():
        return {"ok": True}

    parent = APIRouter()
    parent.include_router(child, prefix="/sub")
    app = FastAPI()
    app.include_router(parent, prefix="/api")

    assert _paths(app) == {"/api/sub/thing"}, "nested include_router dropped the route"
    assert TestClient(app).get("/api/sub/thing").status_code == 200


def test_the_real_app_has_its_v1_routes():
    """A guard against shipping an app that serves nothing.

    Asserts a floor rather than an exact count so adding endpoints does not
    break the test, while a collapse to zero -- the actual failure -- does.
    """
    v1 = sorted(p for p in _paths(create_app()) if p.startswith("/api/v1"))
    assert len(v1) > 50, f"expected the full v1 surface, got {len(v1)} paths: {v1[:10]}"


def test_representative_endpoints_from_each_nesting_depth_exist():
    """One path per nesting level, so a partial collapse is caught too.

    Checks the schema and then asks the server: anything but 404 (200, 405
    for a POST-only path, 401/422 for one that wants auth or a body) proves
    the route resolved.
    """
    app = create_app()
    paths = _paths(app)
    client = TestClient(app)
    for expected in (
        "/api/v1/health",  # router -> app
        "/api/v1/identity/register",  # router -> sub-router -> app
        "/api/v1/theory/scale",  # router -> subscription_router -> sub -> app
        "/api/v1/export/progression/mp3",
        "/api/v1/audio/generate",
    ):
        assert expected in paths, f"{expected} missing from the schema -- nested routing is broken"
        status = client.get(expected).status_code
        assert status != 404, f"GET {expected} -> 404 -- nested routing is broken"
