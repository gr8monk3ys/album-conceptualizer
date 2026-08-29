#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-./backups}"
TIMESTAMP="$(date +"%Y%m%d-%H%M%S")"
ARCHIVE_NAME="album-conceptualizer-${TIMESTAMP}.tar.gz"
INCLUDE_WEB_DB_BACKUP="${INCLUDE_WEB_DB_BACKUP:-auto}"
WORK_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "${WORK_DIR}"
}

trap cleanup EXIT

mkdir -p "${BACKUP_ROOT}"

copy_into_backup() {
  local source_path="$1"
  local target_path="$2"
  local required="${3:-false}"

  if [[ ! -e "${source_path}" ]]; then
    if [[ "${required}" == "true" ]]; then
      echo "Missing required backup path: ${source_path}" >&2
      exit 1
    fi
    return
  fi

  mkdir -p "$(dirname "${target_path}")"
  cp -R "${source_path}" "${target_path}"
}

copy_into_backup "output" "${WORK_DIR}/output" "true"
copy_into_backup "data" "${WORK_DIR}/data" "true"
copy_into_backup ".env.example" "${WORK_DIR}/.env.example"
copy_into_backup "docs/getting-started/production.md" "${WORK_DIR}/docs/getting-started/production.md"

WEB_DB_BACKUP_INCLUDED="false"
if [[ "${INCLUDE_WEB_DB_BACKUP}" != "false" ]]; then
  if [[ -n "${WEB_DATABASE_URL:-${DATABASE_URL:-}}" ]]; then
    bash ./scripts/web-db-backup.sh "${WORK_DIR}/web-postgres.dump"
    WEB_DB_BACKUP_INCLUDED="true"
  elif [[ "${INCLUDE_WEB_DB_BACKUP}" == "required" ]]; then
    echo "Set WEB_DATABASE_URL or DATABASE_URL when INCLUDE_WEB_DB_BACKUP=required." >&2
    exit 1
  fi
fi

cat > "${WORK_DIR}/backup-manifest.txt" <<EOF
created_at=${TIMESTAMP}
web_db_backup_included=${WEB_DB_BACKUP_INCLUDED}
EOF

tar -czf "${BACKUP_ROOT}/${ARCHIVE_NAME}" -C "${WORK_DIR}" .

echo "Backup created: ${BACKUP_ROOT}/${ARCHIVE_NAME}"
