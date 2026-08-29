#!/usr/bin/env bash
set -euo pipefail

ARCHIVE="${1:-}"
RESTORE_ROOT="${RESTORE_ROOT:-.}"
DRY_RUN="${DRY_RUN:-false}"
RESTORE_WEB_DB="${RESTORE_WEB_DB:-false}"

if [[ -z "$ARCHIVE" ]]; then
  echo "Usage: $0 <backup-archive.tar.gz>"
  exit 1
fi

if [[ ! -f "$ARCHIVE" ]]; then
  echo "Archive not found: $ARCHIVE"
  exit 1
fi

if [[ "$DRY_RUN" == "true" ]]; then
  tar -tzf "$ARCHIVE"
  exit 0
fi

mkdir -p "$RESTORE_ROOT"

tar -xzf "$ARCHIVE" -C "$RESTORE_ROOT"

if [[ "${RESTORE_WEB_DB}" == "true" ]]; then
  WEB_DB_DUMP="${RESTORE_ROOT}/web-postgres.dump"
  if [[ ! -f "${WEB_DB_DUMP}" ]]; then
    echo "Archive does not contain web-postgres.dump; nothing to restore to the web database." >&2
    exit 1
  fi

  bash ./scripts/web-db-restore.sh "${WEB_DB_DUMP}"
fi

echo "Restore complete in: $RESTORE_ROOT"
