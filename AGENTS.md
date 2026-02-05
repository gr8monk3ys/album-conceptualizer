# Repository Guidelines

## Project Structure & Module Organization
- `album_conceptualizer/` holds the Python package (CLI, UI, agents, RAG, models, export).
- `tests/` contains pytest suites and fixtures.
- `docs/` and `mkdocs.yml` drive the documentation site.
- `data/` stores datasets (e.g., chord progressions); `output/` is for generated exports.
- Top-level tooling: `pyproject.toml` (config), `Makefile` (common tasks), `Dockerfile` and `docker-compose.yml` (containers).

## Build, Test, and Development Commands
- `make help` lists all supported tasks.
- `make install-dev` installs dev dependencies with `uv`.
- `make lint` runs `ruff check` on `album_conceptualizer/` and `tests/`.
- `make format` applies `ruff format`.
- `make test` runs pytest in `tests/`.
- `make test-cov` adds coverage (`--cov=album_conceptualizer`).
- `make api-dev` starts the FastAPI server with reload; `make ui` launches the Gradio UI.
- Docker flows: `docker compose up -d app` or `make docker-up`.

## Coding Style & Naming Conventions
- Python 3.11 target, 4-space indentation, line length 100.
- Formatting and linting via Ruff (`ruff format`, `ruff check`).
- Quote style is double quotes; import order is enforced by Ruff’s isort rules.
- First-party imports are under `album_conceptualizer`.

## Testing Guidelines
- Pytest with `tests/` as root and `test_*.py` file naming.
- Test functions must be named `test_*`.
- Markers: `slow` and `integration` (use `-m "not slow"` to skip slow tests).
- Coverage is configured for `album_conceptualizer/` (tests are omitted from coverage).

## Commit & Pull Request Guidelines
- Commit history follows Conventional Commits (e.g., `fix:`, `style:`, `ci(deps):`).
- Prefer small, focused commits; use scopes when useful (e.g., `docker(deps): ...`).
- PRs should describe the change, reference related issues, and include screenshots for UI changes.
- If you add features, include tests or explain why not.

## Configuration & Secrets
- API keys are read from `.env` (e.g., `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`).
- Do not commit secrets; document new config entries in `README.md`.

## Ops & Backup Drill
- Create backups with `BACKUP_ROOT=./backups ./scripts/backup-data.sh`.
- Verify archives before restore: `DRY_RUN=true ./scripts/restore-backup.sh ./backups/<file>.tar.gz`.
- Restore into a staging folder first: `RESTORE_ROOT=./restore-test ./scripts/restore-backup.sh ./backups/<file>.tar.gz`.
- Cron example (daily 2am): `0 2 * * * /path/to/repo/scripts/backup-data.sh >> /var/log/album-backup.log 2>&1`
