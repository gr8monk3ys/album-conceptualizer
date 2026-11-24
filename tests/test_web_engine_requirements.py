"""apps/web/api/requirements.txt must list exactly pyproject's base dependencies.

The engine served from the web project (apps/web/api/engine.py) installs only
that file on Vercel, so a dependency added to pyproject.toml but not there would
fail at import time in production only.
"""

import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _requirement_lines(path: Path) -> list[str]:
    lines = []
    for raw in path.read_text().splitlines():
        line = raw.split("#", 1)[0].strip()
        if line:
            lines.append(line)
    return lines


def test_web_engine_requirements_match_pyproject_dependencies() -> None:
    pyproject = tomllib.loads((ROOT / "pyproject.toml").read_text())
    expected = sorted(pyproject["project"]["dependencies"])
    actual = sorted(_requirement_lines(ROOT / "apps" / "web" / "api" / "requirements.txt"))
    assert actual == expected
