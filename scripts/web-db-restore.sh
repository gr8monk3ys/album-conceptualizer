#!/usr/bin/env bash
set -euo pipefail

POSTGRES_CLIENT_IMAGE="${POSTGRES_CLIENT_IMAGE:-postgres:16}"
DATABASE_URL_VALUE="${WEB_DATABASE_URL:-${DATABASE_URL:-}}"
DUMP_PATH="${1:-}"

if [[ -z "${DUMP_PATH}" ]]; then
  echo "Usage: $0 <web-postgres.dump>" >&2
  exit 1
fi

if [[ ! -f "${DUMP_PATH}" ]]; then
  echo "Dump not found: ${DUMP_PATH}" >&2
  exit 1
fi

if [[ -z "${DATABASE_URL_VALUE}" ]]; then
  echo "Set WEB_DATABASE_URL or DATABASE_URL before restoring the web DB." >&2
  exit 1
fi

if [[ "${DRY_RUN:-false}" == "true" ]]; then
  if command -v pg_restore >/dev/null 2>&1; then
    pg_restore --list "${DUMP_PATH}"
  elif command -v docker >/dev/null 2>&1; then
    DUMP_DIR="$(cd "$(dirname "${DUMP_PATH}")" && pwd)"
    DUMP_BASENAME="$(basename "${DUMP_PATH}")"
    docker run --rm \
      -e DUMP_BASENAME="${DUMP_BASENAME}" \
      -v "${DUMP_DIR}:/backup" \
      "${POSTGRES_CLIENT_IMAGE}" \
      sh -lc 'pg_restore --list "/backup/${DUMP_BASENAME}"'
  else
    echo "Missing pg_restore and docker. Install PostgreSQL client tools or Docker." >&2
    exit 1
  fi
  exit 0
fi

if [[ "${CONFIRM_WEB_DB_RESTORE:-}" != "1" ]]; then
  echo "Set CONFIRM_WEB_DB_RESTORE=1 to confirm restoring the target web database." >&2
  exit 1
fi

DUMP_DIR="$(cd "$(dirname "${DUMP_PATH}")" && pwd)"
DUMP_BASENAME="$(basename "${DUMP_PATH}")"

rewrite_database_url_for_docker() {
  python3 - "$1" <<'PY'
import sys
from urllib.parse import quote, urlsplit, urlunsplit

raw_url = sys.argv[1]
parts = urlsplit(raw_url)
host = parts.hostname
if host not in {"localhost", "127.0.0.1"}:
    print(raw_url)
    raise SystemExit

credentials = ""
if parts.username is not None:
    credentials = quote(parts.username, safe="")
    if parts.password is not None:
        credentials += ":" + quote(parts.password, safe="")
    credentials += "@"

port = f":{parts.port}" if parts.port else ""
netloc = f"{credentials}host.docker.internal{port}"
print(urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment)))
PY
}

run_local_restore() {
  pg_restore \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    --dbname "${DATABASE_URL_VALUE}" \
    "${DUMP_PATH}"
}

run_docker_restore() {
  local docker_url
  docker_url="$(rewrite_database_url_for_docker "${DATABASE_URL_VALUE}")"

  docker run --rm \
    -e DATABASE_URL="${docker_url}" \
    -e DUMP_BASENAME="${DUMP_BASENAME}" \
    -v "${DUMP_DIR}:/backup" \
    "${POSTGRES_CLIENT_IMAGE}" \
    sh -lc 'pg_restore --clean --if-exists --no-owner --no-privileges --dbname "${DATABASE_URL}" "/backup/${DUMP_BASENAME}"'
}

if command -v pg_restore >/dev/null 2>&1; then
  run_local_restore
elif command -v docker >/dev/null 2>&1; then
  run_docker_restore
else
  echo "Missing pg_restore and docker. Install PostgreSQL client tools or Docker." >&2
  exit 1
fi

echo "Web DB restore complete from: ${DUMP_PATH}"
