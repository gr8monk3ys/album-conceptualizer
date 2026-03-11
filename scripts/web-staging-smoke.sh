#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_URL="${ALBUM_CONCEPTUALIZER_WEB_BASE_URL:-${PLAYWRIGHT_BASE_URL:-}}"
INSECURE="${ALBUM_CONCEPTUALIZER_INSECURE:-false}"

fail() {
  printf '[FAIL] %s\n' "$1" >&2
  exit 1
}

if [[ -z "${BASE_URL}" ]]; then
  fail "Set ALBUM_CONCEPTUALIZER_WEB_BASE_URL or PLAYWRIGHT_BASE_URL."
fi

BASE_URL="${BASE_URL%/}"
CURL_FLAGS=(-fsSL)
if [[ "${INSECURE}" == "true" ]]; then
  CURL_FLAGS+=(-k)
fi

printf '[STEP] Health check %s/api/health\n' "${BASE_URL}"
HEALTH_JSON="$(curl "${CURL_FLAGS[@]}" "${BASE_URL}/api/health")" || fail "Health endpoint failed."
export HEALTH_JSON
python3 - <<'PY'
import json
import os
import sys

payload = json.loads(os.environ["HEALTH_JSON"])
checks = payload.get("checks") or {}

if not payload.get("ok"):
    print("[FAIL] Web health reported ok=false", file=sys.stderr)
    sys.exit(1)

required_checks = ("config", "db", "engine")
missing = [name for name in required_checks if checks.get(name) is not True]
if missing:
    print(f"[FAIL] Web health checks not green: {', '.join(missing)}", file=sys.stderr)
    sys.exit(1)

print("[PASS] Web health checks are green.")
PY

printf '[STEP] Auth providers %s/api/auth/providers\n' "${BASE_URL}"
PROVIDERS_JSON="$(curl "${CURL_FLAGS[@]}" "${BASE_URL}/api/auth/providers")" || fail "Auth providers endpoint failed."
export PROVIDERS_JSON
python3 - <<'PY'
import json
import os
import sys

payload = json.loads(os.environ["PROVIDERS_JSON"])
if not isinstance(payload, dict) or not payload:
    print("[FAIL] Auth providers endpoint returned no providers.", file=sys.stderr)
    sys.exit(1)

print(f"[PASS] Auth providers available: {', '.join(sorted(payload.keys()))}")
PY

printf '[STEP] Playwright production smoke against %s\n' "${BASE_URL}"
(
  cd "${ROOT_DIR}/apps/web"
  PLAYWRIGHT_BASE_URL="${BASE_URL}" npm run test:e2e:prod-smoke
)

printf '[PASS] Web staging smoke completed successfully.\n'
