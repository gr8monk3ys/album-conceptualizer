#!/usr/bin/env bash
set -euo pipefail

echo "Stopping Album Conceptualizer (prod)..."
docker compose down
