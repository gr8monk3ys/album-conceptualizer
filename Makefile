.PHONY: help install install-dev lint format test test-cov clean build docker docker-up docker-down ui api docs

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
	@echo "  make type-check    Run type checker (mypy)"
	@echo ""
	@echo "Application:"
	@echo "  make api           Start FastAPI server"
	@echo "  make api-dev       Start FastAPI with hot reload"
	@echo "  make ui            Launch Gradio UI"
	@echo "  make cli           Show CLI help"
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
	ruff check album_conceptualizer/ tests/

lint-fix:
	ruff check album_conceptualizer/ tests/ --fix

format:
	ruff format album_conceptualizer/ tests/

format-check:
	ruff format --check album_conceptualizer/ tests/

test:
	pytest tests/ -v

test-cov:
	pytest tests/ -v --cov=album_conceptualizer --cov-report=term-missing --cov-report=html

test-fast:
	pytest tests/ -v -x --tb=short

type-check:
	mypy album_conceptualizer/ --ignore-missing-imports

pre-commit:
	pre-commit run --all-files

pre-commit-install:
	pre-commit install
	pre-commit install --hook-type commit-msg

# =============================================================================
# Application
# =============================================================================

api:
	uvicorn album_conceptualizer.api.app:app --host 0.0.0.0 --port 8000

api-dev:
	uvicorn album_conceptualizer.api.app:app --host 0.0.0.0 --port 8000 --reload

ui:
	python -m album_conceptualizer.cli ui

cli:
	python -m album_conceptualizer.cli --help

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

# Update dependencies
update:
	uv pip compile pyproject.toml -o requirements.txt
	uv pip compile pyproject.toml --extra dev -o requirements-dev.txt

# Generate requirements files for pip users
requirements:
	uv pip compile pyproject.toml -o requirements.txt
	uv pip compile pyproject.toml --extra full -o requirements-full.txt
	uv pip compile pyproject.toml --extra dev -o requirements-dev.txt
