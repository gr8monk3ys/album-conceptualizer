#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-./backups}"
TIMESTAMP="$(date +"%Y%m%d-%H%M%S")"
ARCHIVE_NAME="album-conceptualizer-${TIMESTAMP}.tar.gz"

mkdir -p "$BACKUP_ROOT"

tar -czf "${BACKUP_ROOT}/${ARCHIVE_NAME}" \
  output \
  data \
  .env.example \
  docs/getting-started/production.md

echo "Backup created: ${BACKUP_ROOT}/${ARCHIVE_NAME}"
