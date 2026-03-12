#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="${ROOT_DIR}/apps/web"
REPORT_DIR="${LIGHTHOUSE_REPORT_DIR:-${ROOT_DIR}/output/lighthouse/auth}"
SERVER_LOG="${REPORT_DIR}/server.log"

pick_free_port() {
  python3 - <<'PY'
import socket

with socket.socket() as sock:
    sock.bind(("127.0.0.1", 0))
    print(sock.getsockname()[1])
PY
}

if [[ -n "${ALBUM_CONCEPTUALIZER_WEB_BASE_URL:-}" ]]; then
  BASE_URL="${ALBUM_CONCEPTUALIZER_WEB_BASE_URL%/}"
  PORT="${LIGHTHOUSE_PORT:-}"
else
  PORT="${LIGHTHOUSE_PORT:-$(pick_free_port)}"
  BASE_URL="http://127.0.0.1:${PORT}"
fi

mkdir -p "${REPORT_DIR}"

export ALBUM_CONCEPTUALIZER_WEB_BASE_URL="${BASE_URL}"
export LIGHTHOUSE_BASE_URL="${BASE_URL}"
export LIGHTHOUSE_REPORT_DIR="${REPORT_DIR}"
export AC_E2E="${AC_E2E:-1}"
export PRISMA_ADAPTER="${PRISMA_ADAPTER:-pg}"
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5433/album_conceptualizer?schema=album_conceptualizer}"
export NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-dev-secret}"
export AUTH_SECRET="${AUTH_SECRET:-${NEXTAUTH_SECRET}}"
export NEXTAUTH_URL="${NEXTAUTH_URL:-${BASE_URL}}"
export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-${BASE_URL}}"
export ENABLE_DEV_LOGIN="${ENABLE_DEV_LOGIN:-1}"
export NEXT_PUBLIC_ENABLE_DEV_LOGIN="${NEXT_PUBLIC_ENABLE_DEV_LOGIN:-1}"

cd "${WEB_DIR}"
npm run build

npm run start -- -p "${PORT}" >"${SERVER_LOG}" 2>&1 &
SERVER_PID=$!

cleanup() {
  if kill -0 "${SERVER_PID}" >/dev/null 2>&1; then
    kill "${SERVER_PID}" >/dev/null 2>&1 || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

for _ in $(seq 1 60); do
  if ! kill -0 "${SERVER_PID}" >/dev/null 2>&1; then
    cat "${SERVER_LOG}" >&2
    exit 1
  fi
  if curl -fsS "${BASE_URL}/sign-in" >/dev/null 2>&1; then
    curl -fsS "${BASE_URL}/sign-in" >/dev/null
    sleep 1
    npm run test:lighthouse:auth
    exit 0
  fi
  sleep 1
done

echo "Timed out waiting for ${BASE_URL}." >&2
exit 1
