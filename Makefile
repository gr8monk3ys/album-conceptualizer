.PHONY: help install install-dev lint format test test-cov test-cov-integration test-cov-unit test-cov-mock clean build docker docker-up docker-down ui api docs billing-smoke billing-lifecycle-smoke staging-e2e ui-playwright-smoke ui-e2e email-smoke backup-data restore-backup web-db-backup web-db-restore web-lighthouse-public web-lighthouse-auth

PY_DEV = uv run --python 3.11 --with '.[dev,music]'
PY_UI = uv run --python 3.11 --with '.[dev,ui,music]'

# Default target
help:
	@echo "Album Conceptualizer - Development Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make install       Install production dependencies"
	@echo "  make install-dev   Install development dependencies"
	@echo "  make install-full  Install all dependencies"
	@echo ""
	@echo "Development:"
	@echo "  make lint          Run linter (ruff check)"
	@echo "  make format        Format code (ruff format)"
	@echo "  make test          Run tests"
	@echo "  make test-cov      Run tests with coverage"
	@echo "  make test-cov-integration  Run integration-marked tests with coverage"
	@echo "  make test-cov-unit Run unit-marked tests with coverage"
	@echo "  make test-cov-mock Run mock-marked tests with coverage"
	@echo "  make type-check    Run type checker (mypy)"
	@echo ""
	@echo "Application:"
	@echo "  make api           Start FastAPI server"
	@echo "  make api-dev       Start FastAPI with hot reload"
	@echo "  make ui            Launch Gradio UI"
	@echo "  make cli           Show CLI help"
	@echo "  make billing-smoke Run billing/subscription smoke test"
	@echo "  make billing-lifecycle-smoke Run simulated subscription lifecycle smoke"
	@echo "  make staging-e2e   Run end-to-end API staging smoke flow"
	@echo "  make ui-playwright-smoke  Run Playwright UI smoke check"
	@echo "  make ui-e2e        Run Playwright UI E2E assertions"
	@echo "  make email-smoke   Send onboarding email smoke test"
	@echo "  make web-lighthouse-public  Run the public Lighthouse 100/100 audit"
	@echo "  make web-lighthouse-auth  Run the authenticated Lighthouse 100/100 audit"
	@echo ""
	@echo "Documentation:"
	@echo "  make docs          Build documentation"
	@echo "  make docs-serve    Serve documentation locally"
	@echo ""
	@echo "Docker:"
	@echo "  make docker        Build Docker image"
	@echo "  make docker-api    Start API container"
	@echo "  make docker-up     Start UI container"
	@echo "  make docker-down   Stop containers"
	@echo "  make docker-dev    Start development container"
	@echo "  make docker-test   Run tests in container"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean         Remove build artifacts"
	@echo "  make build         Build package"
	@echo "  make backup-data   Create an application backup archive"
	@echo "  make restore-backup ARCHIVE=/path/to/archive.tar.gz"
	@echo "                     Restore an application backup archive"
	@echo "  make web-db-backup Create a Postgres dump for the Next.js app"
	@echo "  make web-db-restore DUMP=/path/to/web-postgres.dump"
	@echo "                     Restore a Postgres dump for the Next.js app"
	@echo "  make pre-commit    Run pre-commit hooks"

# =============================================================================
# Setup
# =============================================================================

install:
	uv pip install --system -e .

install-dev:
	uv pip install --system -e ".[dev]"

install-full:
	uv pip install --system -e ".[full,dev]"

install-ai:
	uv pip install --system -e ".[ai,rag]"

# =============================================================================
# Development
# =============================================================================

lint:
	@if command -v ruff >/dev/null 2>&1; then \
		ruff check album_conceptualizer/ tests/ ; \
	elif [ -x .venv/bin/ruff ]; then \
		.venv/bin/ruff check album_conceptualizer/ tests/ ; \
	else \
		uv run --python 3.11 --with '.[dev]' ruff check album_conceptualizer/ tests/ ; \
	fi

lint-fix:
	@if command -v ruff >/dev/null 2>&1; then \
		ruff check album_conceptualizer/ tests/ --fix ; \
	elif [ -x .venv/bin/ruff ]; then \
		.venv/bin/ruff check album_conceptualizer/ tests/ --fix ; \
	else \
		uv run --python 3.11 --with '.[dev]' ruff check album_conceptualizer/ tests/ --fix ; \
	fi

format:
	@if command -v ruff >/dev/null 2>&1; then \
		ruff format album_conceptualizer/ tests/ ; \
	elif [ -x .venv/bin/ruff ]; then \
		.venv/bin/ruff format album_conceptualizer/ tests/ ; \
	else \
		uv run --python 3.11 --with '.[dev]' ruff format album_conceptualizer/ tests/ ; \
	fi

format-check:
	@if command -v ruff >/dev/null 2>&1; then \
		ruff format --check album_conceptualizer/ tests/ ; \
	elif [ -x .venv/bin/ruff ]; then \
		.venv/bin/ruff format --check album_conceptualizer/ tests/ ; \
	else \
		uv run --python 3.11 --with '.[dev]' ruff format --check album_conceptualizer/ tests/ ; \
	fi

test:
	$(PY_DEV) pytest tests/ -v

test-cov:
	$(PY_DEV) pytest tests/ -v --cov=album_conceptualizer --cov-report=term-missing --cov-report=html

test-cov-integration:
	$(PY_DEV) pytest tests/ -v -m integration --cov=album_conceptualizer --cov-report=term-missing --cov-report=html

test-cov-unit:
	$(PY_DEV) pytest tests/ -v -m unit --cov=album_conceptualizer --cov-report=term-missing --cov-report=html

test-cov-mock:
	$(PY_DEV) pytest tests/ -v -m mock --cov=album_conceptualizer --cov-report=term-missing --cov-report=html

test-fast:
	$(PY_DEV) pytest tests/ -v -x --tb=short

type-check:
	@if command -v mypy >/dev/null 2>&1; then \
		mypy album_conceptualizer/ --ignore-missing-imports ; \
	elif [ -x .venv/bin/mypy ]; then \
		.venv/bin/mypy album_conceptualizer/ --ignore-missing-imports ; \
	else \
		uv run --python 3.11 --with '.[dev]' mypy album_conceptualizer/ --ignore-missing-imports ; \
	fi

pre-commit:
	pre-commit run --all-files

pre-commit-install:
	pre-commit install
	pre-commit install --hook-type commit-msg

# =============================================================================
# Application
# =============================================================================

api:
	$(PY_DEV) uvicorn album_conceptualizer.api.app:app --host 0.0.0.0 --port 8000

api-dev:
	$(PY_DEV) uvicorn album_conceptualizer.api.app:app --host 0.0.0.0 --port 8000 --reload

ui:
	$(PY_UI) python3 -m album_conceptualizer.cli ui

cli:
	$(PY_DEV) python3 -m album_conceptualizer.cli --help

# =============================================================================
# Documentation
# =============================================================================

docs:
	mkdocs build

docs-serve:
	mkdocs serve

docs-deploy:
	mkdocs gh-deploy --force

# =============================================================================
# Docker
# =============================================================================

docker:
	docker build -t album-conceptualizer:latest --target production .

docker-api:
	docker build -t album-conceptualizer:api --target api .

docker-dev:
	docker build -t album-conceptualizer:dev --target development .

docker-up:
	docker compose up -d app

docker-api-up:
	docker compose up -d api

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

docker-test:
	docker compose --profile test up --build test

docker-lint:
	docker compose --profile lint up --build lint

docker-shell:
	docker compose run --rm dev bash

docker-full:
	docker compose --profile full up -d

# =============================================================================
# Build & Release
# =============================================================================

build:
	uv build

clean:
	rm -rf build/
	rm -rf dist/
	rm -rf *.egg-info/
	rm -rf .pytest_cache/
	rm -rf .ruff_cache/
	rm -rf .mypy_cache/
	rm -rf htmlcov/
	rm -rf .coverage
	rm -rf coverage.xml
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete

# =============================================================================
# Utilities
# =============================================================================

billing-smoke:
	$(PY_DEV) python3 scripts/stripe-billing-smoke.py

billing-lifecycle-smoke:
	$(PY_DEV) python3 scripts/stripe-billing-smoke.py --simulate-lifecycle --skip-checkout

staging-e2e:
	$(PY_DEV) python3 scripts/staging-e2e.py

ui-playwright-smoke:
	bash scripts/ui-playwright-smoke.sh

ui-e2e:
	bash scripts/ui-e2e-playwright.sh

email-smoke:
	.venv/bin/python scripts/email-smoke.py

web-lighthouse-public:
	bash scripts/web-lighthouse-public.sh

web-lighthouse-auth:
	bash scripts/web-lighthouse-auth.sh

backup-data:
	./scripts/backup-data.sh

restore-backup:
	@if [ -z "$(ARCHIVE)" ]; then \
		echo "Usage: make restore-backup ARCHIVE=/path/to/archive.tar.gz" ; \
		exit 1 ; \
	fi
	./scripts/restore-backup.sh "$(ARCHIVE)"

web-db-backup:
	./scripts/web-db-backup.sh

web-db-restore:
	@if [ -z "$(DUMP)" ]; then \
		echo "Usage: make web-db-restore DUMP=/path/to/web-postgres.dump" ; \
		exit 1 ; \
	fi
	./scripts/web-db-restore.sh "$(DUMP)"

# Update dependencies
update:
	uv pip compile pyproject.toml -o requirements.txt
	uv pip compile pyproject.toml --extra dev -o requirements-dev.txt

# Generate requirements files for pip users
requirements:
	uv pip compile pyproject.toml -o requirements.txt
	uv pip compile pyproject.toml --extra full -o requirements-full.txt
	uv pip compile pyproject.toml --extra dev -o requirements-dev.txt
