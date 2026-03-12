#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="${ROOT_DIR}/apps/web"
WEB_DOCKER_COMPOSE="${WEB_DIR}/docker-compose.local.yml"
ARTIFACT_DIR="${WEB_E2E_ARTIFACT_DIR:-${ROOT_DIR}/output/web-e2e-backstop}"

WEB_E2E_DATABASE_URL="${WEB_E2E_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5433/album_conceptualizer?schema=album_conceptualizer}"
WEB_E2E_API_KEY="${WEB_E2E_API_KEY:-secret}"
WEB_E2E_SCHEMA="${WEB_E2E_SCHEMA:-album_conceptualizer}"
WEB_E2E_API_HOST="${WEB_E2E_API_HOST:-127.0.0.1}"
WEB_E2E_WEB_HOST="${WEB_E2E_WEB_HOST:-127.0.0.1}"
WEB_E2E_API_PORT="${WEB_E2E_API_PORT:-}"
WEB_E2E_WEB_PORT="${WEB_E2E_WEB_PORT:-}"

API_PID=""
WEB_PID=""

fail() {
  printf '[FAIL] %s\n' "$1" >&2
  exit 1
}

pick_free_port() {
  python3 - <<'PY'
import socket

with socket.socket() as sock:
    sock.bind(("127.0.0.1", 0))
    print(sock.getsockname()[1])
PY
}

wait_for_url() {
  local url="$1"
  local timeout="${2:-90}"
  local started_at
  started_at="$(date +%s)"

  while true; do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      return 0
    fi
    if (( "$(date +%s)" - started_at > timeout )); then
      return 1
    fi
    sleep 1
  done
}

wait_for_container_health() {
  local container_name="$1"
  local timeout="${2:-90}"
  local started_at
  started_at="$(date +%s)"

  while true; do
    local status
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_name}" 2>/dev/null || true)"
    if [[ "${status}" == "healthy" || "${status}" == "running" ]]; then
      return 0
    fi
    if (( "$(date +%s)" - started_at > timeout )); then
      return 1
    fi
    sleep 1
  done
}

cleanup() {
  if [[ -n "${WEB_PID}" ]] && kill -0 "${WEB_PID}" >/dev/null 2>&1; then
    kill "${WEB_PID}" >/dev/null 2>&1 || true
    wait "${WEB_PID}" 2>/dev/null || true
  fi
  if [[ -n "${API_PID}" ]] && kill -0 "${API_PID}" >/dev/null 2>&1; then
    kill "${API_PID}" >/dev/null 2>&1 || true
    wait "${API_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

command -v docker >/dev/null 2>&1 || fail "docker is required."
command -v uv >/dev/null 2>&1 || fail "uv is required."
command -v npm >/dev/null 2>&1 || fail "npm is required."

mkdir -p "${ARTIFACT_DIR}"

if [[ -z "${WEB_E2E_API_PORT}" ]]; then
  WEB_E2E_API_PORT="$(pick_free_port)"
fi
if [[ -z "${WEB_E2E_WEB_PORT}" ]]; then
  WEB_E2E_WEB_PORT="$(pick_free_port)"
fi

WEB_BASE_URL="http://${WEB_E2E_WEB_HOST}:${WEB_E2E_WEB_PORT}"
API_BASE_URL="http://${WEB_E2E_API_HOST}:${WEB_E2E_API_PORT}"

printf '[STEP] Starting local Postgres/Redis via %s\n' "${WEB_DOCKER_COMPOSE}"
docker compose -f "${WEB_DOCKER_COMPOSE}" up -d

wait_for_container_health "album-conceptualizer-web-postgres" 90 || fail "Postgres container did not become healthy."
wait_for_container_health "album-conceptualizer-web-redis" 90 || fail "Redis container did not become healthy."

printf '[STEP] Applying Prisma migrations against %s\n' "${WEB_E2E_DATABASE_URL}"
(
  cd "${WEB_DIR}"
  DATABASE_URL="${WEB_E2E_DATABASE_URL}" \
  PRISMA_ADAPTER=pg \
  PRISMA_DB_SCHEMA="${WEB_E2E_SCHEMA}" \
  npm run prisma:migrate:deploy
) >"${ARTIFACT_DIR}/prisma-migrate.log" 2>&1 || {
  cat "${ARTIFACT_DIR}/prisma-migrate.log" >&2
  fail "Prisma migrate deploy failed."
}

printf '[STEP] Starting API server on %s\n' "${API_BASE_URL}"
(
  cd "${ROOT_DIR}"
  ALBUM_CONCEPTUALIZER_API_KEY="${WEB_E2E_API_KEY}" \
  uv run --python 3.11 --with '.[dev,music]' \
  uvicorn album_conceptualizer.api.app:app --host "${WEB_E2E_API_HOST}" --port "${WEB_E2E_API_PORT}"
) >"${ARTIFACT_DIR}/api-server.log" 2>&1 &
API_PID=$!

wait_for_url "${API_BASE_URL}/api/v1/health" 90 || {
  cat "${ARTIFACT_DIR}/api-server.log" >&2
  fail "API server did not become ready."
}

printf '[STEP] Starting production web server on %s\n' "${WEB_BASE_URL}"
(
  cd "${WEB_DIR}"
  DATABASE_URL="${WEB_E2E_DATABASE_URL}" \
  PRISMA_ADAPTER=pg \
  PRISMA_DB_SCHEMA="${WEB_E2E_SCHEMA}" \
  NEXTAUTH_SECRET=dev-secret \
  AUTH_SECRET=dev-secret \
  NEXTAUTH_URL="${WEB_BASE_URL}" \
  NEXT_PUBLIC_APP_URL="${WEB_BASE_URL}" \
  ENABLE_DEV_LOGIN=1 \
  NEXT_PUBLIC_ENABLE_DEV_LOGIN=1 \
  ENGINE_API_URL="${API_BASE_URL}/api/v1" \
  ENGINE_API_KEY="${WEB_E2E_API_KEY}" \
  AC_E2E=1 \
  npm run build
  DATABASE_URL="${WEB_E2E_DATABASE_URL}" \
  PRISMA_ADAPTER=pg \
  PRISMA_DB_SCHEMA="${WEB_E2E_SCHEMA}" \
  NEXTAUTH_SECRET=dev-secret \
  AUTH_SECRET=dev-secret \
  NEXTAUTH_URL="${WEB_BASE_URL}" \
  NEXT_PUBLIC_APP_URL="${WEB_BASE_URL}" \
  ENABLE_DEV_LOGIN=1 \
  NEXT_PUBLIC_ENABLE_DEV_LOGIN=1 \
  ENGINE_API_URL="${API_BASE_URL}/api/v1" \
  ENGINE_API_KEY="${WEB_E2E_API_KEY}" \
  AC_E2E=1 \
  npm run start -- -p "${WEB_E2E_WEB_PORT}"
) >"${ARTIFACT_DIR}/web-server.log" 2>&1 &
WEB_PID=$!

wait_for_url "${WEB_BASE_URL}/sign-in" 120 || {
  cat "${ARTIFACT_DIR}/web-server.log" >&2
  fail "Web server did not become ready."
}

printf '[STEP] Running local API smoke\n'
(
  cd "${ROOT_DIR}"
  ALBUM_CONCEPTUALIZER_BASE_URL="${API_BASE_URL}" \
  ALBUM_CONCEPTUALIZER_API_KEY="${WEB_E2E_API_KEY}" \
  uv run --python 3.11 --with '.[dev,music]' \
  python3 scripts/staging-e2e.py
) >"${ARTIFACT_DIR}/api-smoke.log" 2>&1 || {
  cat "${ARTIFACT_DIR}/api-smoke.log" >&2
  fail "Local API smoke failed."
}

printf '[STEP] Running local web smoke against %s\n' "${WEB_BASE_URL}"
(
  cd "${ROOT_DIR}"
  ALBUM_CONCEPTUALIZER_WEB_BASE_URL="${WEB_BASE_URL}" \
  bash scripts/web-staging-smoke.sh
) >"${ARTIFACT_DIR}/web-smoke.log" 2>&1 || {
  cat "${ARTIFACT_DIR}/web-smoke.log" >&2
  fail "Local web smoke failed."
}

printf '[STEP] Running full web Playwright E2E against %s\n' "${WEB_BASE_URL}"
(
  cd "${WEB_DIR}"
  PLAYWRIGHT_BASE_URL="${WEB_BASE_URL}" npm run test:e2e
) >"${ARTIFACT_DIR}/web-playwright.log" 2>&1 || {
  cat "${ARTIFACT_DIR}/web-playwright.log" >&2
  fail "Full web Playwright E2E failed."
}

printf '[PASS] Local web/API E2E backstop completed successfully.\n'
printf '[PASS] Artifacts written to %s\n' "${ARTIFACT_DIR}"
