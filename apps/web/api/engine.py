"""The Python engine (album_conceptualizer) served from the web app's Vercel project.

Vercel turns files under the project's `api/` directory (here `apps/web/api/`,
since the web project's Root Directory is `apps/web`) into functions next to the
Next.js build. `next.config.ts` rewrites `/engine` and `/engine/*` to this
function, so the engine answers on the web app's own origin, e.g.
`/engine/api/v1/health`, and ENGINE_API_URL can be `https://<host>/engine/api/v1`.

The request arrives with its original path, so `_StripPrefix` removes `/engine`
before FastAPI routes it: the engine's routes stay exactly as they are.

The engine's source lives at the repo root, outside the Root Directory, and a
function can't bundle files from outside it. So `api/requirements.txt` installs
the repo-root package (`../..`) into the function's environment like any other
dependency. Run from a checkout without that install (local tests), the import
falls back to finding the source by walking up from here.

Writable paths default to /tmp because a function's file system is read-only
everywhere else. Env vars set on the project still win.
"""

import os
import sys
from pathlib import Path


def _ensure_engine_importable() -> None:
    try:
        import album_conceptualizer  # noqa: F401
        return
    except ModuleNotFoundError:
        pass
    here = Path(__file__).resolve()
    for parent in here.parents:
        if (parent / "album_conceptualizer" / "__init__.py").is_file():
            sys.path.insert(0, str(parent))
            return
    raise ModuleNotFoundError(
        "album_conceptualizer is not installed; apps/web/api/requirements.txt installs it"
    )


_ensure_engine_importable()

if os.environ.get("VERCEL"):
    _TMP = Path("/tmp/album-conceptualizer")
    os.environ.setdefault("ALBUM_CONCEPTUALIZER_DATA_DIR", str(_TMP / "data"))
    os.environ.setdefault("ALBUM_CONCEPTUALIZER_CACHE_DIR", str(_TMP / "cache"))
    os.environ.setdefault("ALBUM_CONCEPTUALIZER_OUTPUT_DIR", str(_TMP / "output"))
    os.environ.setdefault(
        "ALBUM_CONCEPTUALIZER_STORAGE_DB", str(_TMP / "data" / "album_conceptualizer.db")
    )

from album_conceptualizer.api.app import app as _engine  # noqa: E402

PREFIX = "/engine"


class _StripPrefix:
    """ASGI wrapper: `/engine/x` -> `/x`, with `root_path` set to `/engine`."""

    def __init__(self, inner, prefix: str) -> None:
        self.inner = inner
        self.prefix = prefix

    async def __call__(self, scope, receive, send):
        if scope["type"] in ("http", "websocket"):
            path = scope.get("path", "")
            if path == self.prefix or path.startswith(self.prefix + "/"):
                scope = dict(scope)
                scope["path"] = path[len(self.prefix):] or "/"
                raw = scope.get("raw_path")
                if raw:
                    scope["raw_path"] = raw[len(self.prefix):] or b"/"
                scope["root_path"] = scope.get("root_path", "") + self.prefix
        await self.inner(scope, receive, send)


app = _StripPrefix(_engine, PREFIX)

__all__ = ["app"]
