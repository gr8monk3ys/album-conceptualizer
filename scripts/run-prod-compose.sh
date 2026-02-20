#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"

# Default to strict validation for production compose runs.
export ALBUM_CONCEPTUALIZER_STRICT_PRODUCTION="${ALBUM_CONCEPTUALIZER_STRICT_PRODUCTION:-true}"

echo "Validating compose configuration..."
docker compose -f "${COMPOSE_FILE}" config --quiet

echo "Running strict-production preflight..."
docker compose -f "${COMPOSE_FILE}" run --rm --no-deps api \
  python -c "from album_conceptualizer.api.app import create_app; create_app(); print('Preflight OK')"

echo "Starting Album Conceptualizer (prod profile)..."
BUILD_IMAGES="${ALBUM_CONCEPTUALIZER_BUILD_IMAGES:-true}"
if [[ "${BUILD_IMAGES}" == "true" ]]; then
  docker compose -f "${COMPOSE_FILE}" up -d --build
else
  docker compose -f "${COMPOSE_FILE}" up -d
fi

if [[ "${ALBUM_CONCEPTUALIZER_DOMAIN:-}" != "" && "${ALBUM_CONCEPTUALIZER_DOMAIN:-}" != "localhost" ]]; then
  echo "Proxy: https://${ALBUM_CONCEPTUALIZER_DOMAIN}"
  echo "API:   https://${ALBUM_CONCEPTUALIZER_DOMAIN}/api/v1/health"
else
  echo "Proxy: http://localhost"
  echo "API:   http://localhost:8000"
  echo "UI:    http://localhost:7860"
fi
