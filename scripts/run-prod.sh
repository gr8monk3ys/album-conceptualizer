#!/usr/bin/env bash
set -euo pipefail

# Minimal production run: API + UI containers
# Requires Docker and a configured .env for API keys.

echo "Starting Album Conceptualizer (prod)..."
docker compose up -d api app

echo "API: http://localhost:8000"
echo "UI:  http://localhost:7860"
