#!/usr/bin/env bash
set -euo pipefail

echo "Starting Album Conceptualizer (prod profile)..."
docker compose -f docker-compose.prod.yml up -d

if [[ "${ALBUM_CONCEPTUALIZER_DOMAIN:-}" != "" && "${ALBUM_CONCEPTUALIZER_DOMAIN:-}" != "localhost" ]]; then
  echo "Proxy: https://${ALBUM_CONCEPTUALIZER_DOMAIN}"
  echo "API:   https://${ALBUM_CONCEPTUALIZER_DOMAIN}/api/v1/health"
else
  echo "Proxy: http://localhost"
  echo "API:   http://localhost:8000"
  echo "UI:    http://localhost:7860"
fi
