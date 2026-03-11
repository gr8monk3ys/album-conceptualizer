#!/usr/bin/env bash
set -euo pipefail

POSTGRES_CLIENT_IMAGE="${POSTGRES_CLIENT_IMAGE:-postgres:16}"
DATABASE_URL_VALUE="${WEB_DATABASE_URL:-${DATABASE_URL:-}}"
BACKUP_ROOT="${BACKUP_ROOT:-./backups}"
OUTPUT_PATH="${1:-}"

if [[ -z "${DATABASE_URL_VALUE}" ]]; then
  echo "Set WEB_DATABASE_URL or DATABASE_URL before running a web DB backup." >&2
  exit 1
fi

if [[ -z "${OUTPUT_PATH}" ]]; then
  TIMESTAMP="$(date +"%Y%m%d-%H%M%S")"
  OUTPUT_PATH="${BACKUP_ROOT}/web-postgres-${TIMESTAMP}.dump"
fi

mkdir -p "$(dirname "${OUTPUT_PATH}")"
OUTPUT_DIR="$(cd "$(dirname "${OUTPUT_PATH}")" && pwd)"
OUTPUT_BASENAME="$(basename "${OUTPUT_PATH}")"

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

run_local_backup() {
  pg_dump --format=custom --no-owner --no-privileges --file "${OUTPUT_PATH}" "${DATABASE_URL_VALUE}"
}

run_docker_backup() {
  local docker_url
  docker_url="$(rewrite_database_url_for_docker "${DATABASE_URL_VALUE}")"

  docker run --rm \
    -e DATABASE_URL="${docker_url}" \
    -e OUTPUT_BASENAME="${OUTPUT_BASENAME}" \
    -v "${OUTPUT_DIR}:/backup" \
    "${POSTGRES_CLIENT_IMAGE}" \
    sh -lc 'pg_dump --format=custom --no-owner --no-privileges --file "/backup/${OUTPUT_BASENAME}" "${DATABASE_URL}"'
}

if command -v pg_dump >/dev/null 2>&1; then
  run_local_backup
elif command -v docker >/dev/null 2>&1; then
  run_docker_backup
else
  echo "Missing pg_dump and docker. Install PostgreSQL client tools or Docker." >&2
  exit 1
fi

echo "Web DB backup created: ${OUTPUT_PATH}"
