#!/usr/bin/env bash
set -euo pipefail

ARCHIVE="${1:-}"
RESTORE_ROOT="${RESTORE_ROOT:-.}"
DRY_RUN="${DRY_RUN:-false}"

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

echo "Restore complete in: $RESTORE_ROOT"
