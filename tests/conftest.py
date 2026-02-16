"""Shared pytest configuration and fixtures for the Album Conceptualizer test suite."""

import os


def pytest_configure(config):
    """Set environment variables needed by the test suite."""
    # Prevent agent modules from attempting real LLM calls during tests
    os.environ.setdefault("OPENAI_API_KEY", "test-key-not-real")
    os.environ.setdefault("ANTHROPIC_API_KEY", "test-key-not-real")


def pytest_collection_modifyitems(config, items):
    """Auto-skip agent tests when crewai is not installed (belt-and-suspenders)."""
    try:
        import crewai  # noqa: F401
    except ImportError:
        import pytest

        skip_agents = pytest.mark.skip(reason="crewai not installed")
        for item in items:
            if "agents" in item.keywords:
                item.add_marker(skip_agents)
