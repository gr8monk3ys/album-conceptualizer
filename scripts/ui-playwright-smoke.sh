#!/usr/bin/env bash
set -euo pipefail

if ! command -v npx >/dev/null 2>&1; then
  echo "Error: npx is required but not found on PATH." >&2
  exit 1
fi

BASE_URL="${1:-${ALBUM_CONCEPTUALIZER_UI_BASE_URL:-http://localhost:7860}}"
SESSION="ui$RANDOM"

export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
export PLAYWRIGHT_CLI_SESSION="$SESSION"

mkdir -p output/playwright

echo "[STEP] Opening UI at ${BASE_URL}"
"$PWCLI" open "$BASE_URL"

echo "[STEP] Capturing snapshot"
"$PWCLI" snapshot >/dev/null

echo "[STEP] Saving screenshot"
"$PWCLI" screenshot --full-page --filename output/playwright/ui-smoke-home.png >/dev/null

echo "[STEP] Closing browser session"
"$PWCLI" close >/dev/null

echo "[PASS] UI Playwright smoke completed. Artifact: output/playwright/ui-smoke-home.png"
