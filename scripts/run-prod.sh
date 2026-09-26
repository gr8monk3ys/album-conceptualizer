#!/usr/bin/env bash
set -euo pipefail

# Minimal production run: API container
# Requires Docker and a configured .env for API keys.

echo "Starting Album Conceptualizer (prod)..."
docker compose up -d api

echo "API: http://localhost:8000"
