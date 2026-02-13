#!/usr/bin/env bash
set -euo pipefail

if ! command -v npx >/dev/null 2>&1; then
  echo "Error: npx is required but not found on PATH." >&2
  exit 1
fi

API_HOST="${ALBUM_CONCEPTUALIZER_API_HOST:-127.0.0.1}"
API_PORT="${ALBUM_CONCEPTUALIZER_API_PORT:-8010}"
UI_HOST="${ALBUM_CONCEPTUALIZER_UI_HOST:-127.0.0.1}"
UI_PORT="${ALBUM_CONCEPTUALIZER_UI_PORT:-7870}"

API_URL="http://${API_HOST}:${API_PORT}"
UI_URL="http://${UI_HOST}:${UI_PORT}"
ARTIFACT_DIR="${PLAYWRIGHT_ARTIFACT_DIR:-output/playwright}"

mkdir -p "${ARTIFACT_DIR}"
mkdir -p .playwright-cli

export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
export PLAYWRIGHT_CLI_SESSION="ui${RANDOM}"

API_PID=""
UI_PID=""

cleanup() {
  if [[ -n "${PLAYWRIGHT_CLI_SESSION:-}" ]]; then
    "${PWCLI}" close >/dev/null 2>&1 || true
  fi
  if [[ -n "${UI_PID}" ]]; then
    kill "${UI_PID}" >/dev/null 2>&1 || true
    wait "${UI_PID}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${API_PID}" ]]; then
    kill "${API_PID}" >/dev/null 2>&1 || true
    wait "${API_PID}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

wait_for_url() {
  local url="$1"
  local timeout="${2:-60}"
  local started
  started="$(date +%s)"
  while true; do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      return 0
    fi
    if (( "$(date +%s)" - started > timeout )); then
      echo "Timed out waiting for ${url}" >&2
      return 1
    fi
    sleep 1
  done
}

run_pw() {
  local log_file="$1"
  shift
  "${PWCLI}" "$@" >"${log_file}" 2>&1
  if grep -Fq "### Error" "${log_file}"; then
    echo "Playwright command failed: $*" >&2
    cat "${log_file}" >&2
    return 1
  fi
}

echo "[STEP] Starting API server on ${API_URL}"
ALBUM_CONCEPTUALIZER_API_KEY=secret \
  uv run --python 3.11 --with '.[dev]' \
  uvicorn album_conceptualizer.api.app:app --host "${API_HOST}" --port "${API_PORT}" \
  >"${ARTIFACT_DIR}/api-server.log" 2>&1 &
API_PID=$!

echo "[STEP] Starting UI server on ${UI_URL}"
uv run --python 3.11 --with '.[dev,ui,music]' \
  python -m album_conceptualizer.cli ui --host "${UI_HOST}" --port "${UI_PORT}" \
  >"${ARTIFACT_DIR}/ui-server.log" 2>&1 &
UI_PID=$!

wait_for_url "${API_URL}/api/v1/health" 90
wait_for_url "${UI_URL}" 90

echo "[STEP] Opening UI in Playwright"
run_pw "${ARTIFACT_DIR}/playwright-open.log" open "${UI_URL}"
run_pw "${ARTIFACT_DIR}/playwright-tracing-start.log" tracing-start

UI_FLOW_CODE=$(cat <<'EOF'
async (page) => {
  await page.getByRole("tab", { name: "Quick Start" }).click();
  await page.locator('textarea[placeholder="e.g., The Last Summer"]').fill("Playwright CI Album");
  await page.locator('textarea[placeholder="e.g., The Storytellers"]').fill("QA Ensemble");
  await page
    .locator('textarea[placeholder="One or two sentences about the album concept..."]')
    .fill("An end-to-end UI rehearsal that validates create, edit, and export paths.");
  await page.getByRole("button", { name: "Generate album.json" }).click();
  await page.waitForFunction(
    () => {
      const visible = Array.from(document.querySelectorAll("textarea")).filter(
        (el) => el.offsetParent !== null
      );
      return visible.some((el) => (el.value || "").includes('"title": "Playwright CI Album"'));
    },
    undefined,
    { timeout: 20000 }
  );

  await page.getByRole("tab", { name: "Song Editor" }).click();
  await page
    .locator("textarea[placeholder=\"Brief summary of this song's story...\"]")
    .fill("Updated in Playwright to verify edit persistence.");
  await page
    .locator('textarea[placeholder="Enter lyrics for this section..."]')
    .fill("City lights rewrite the map in my hands.");
  await page.keyboard.press("Tab");
  await page.waitForTimeout(700);

  await page.getByRole("tab", { name: "Export" }).click();
  await page.getByRole("button", { name: "Preview Export" }).click();
  await page.waitForFunction(
    () => {
      const visible = Array.from(document.querySelectorAll("textarea")).filter(
        (el) => el.offsetParent !== null
      );
      return visible.length > 0 && (visible[0].value || "").includes("album.json");
    },
    undefined,
    { timeout: 20000 }
  );

  await page.getByRole("button", { name: "Export Album" }).click();
  await page.waitForFunction(
    () => {
      const visible = Array.from(document.querySelectorAll("textarea")).filter(
        (el) => el.offsetParent !== null
      );
      return visible.length > 1 && /Exported to/.test(visible[1].value || "");
    },
    undefined,
    { timeout: 30000 }
  );
}
EOF
)
run_pw "${ARTIFACT_DIR}/playwright-ui-flow.log" run-code "${UI_FLOW_CODE}"
run_pw "${ARTIFACT_DIR}/playwright-ui-screenshot.log" screenshot --full-page --filename "${ARTIFACT_DIR}/ui-e2e-export.png"

EXPERIENCE_FLOW_CODE=$(cat <<'EOF'
async (page) => {
  await page.getByRole("tab", { name: "Experience" }).click();
  await page
    .locator('textarea[placeholder="e.g., hook-first choruses with narrative payoff"]')
    .fill("dense hooks with emotional lift");

  await page.getByRole("button", { name: "Generate Jam Plan" }).click();
  await page.waitForFunction(
    () => {
      const visible = Array.from(document.querySelectorAll("textarea")).filter(
        (el) => el.offsetParent !== null
      );
      return visible.some((el) => (el.value || "").includes("Challenge pack:"));
    },
    undefined,
    { timeout: 15000 }
  );

  await page.getByRole("button", { name: "Run Progress Coach" }).click();
  await page.waitForFunction(
    () => {
      const visible = Array.from(document.querySelectorAll("textarea")).filter(
        (el) => el.offsetParent !== null
      );
      return visible.some((el) => (el.value || "").includes("Completion:"));
    },
    undefined,
    { timeout: 15000 }
  );

  await page.getByRole("button", { name: "Generate Release Kit" }).click();
  await page.waitForFunction(
    () => {
      const visible = Array.from(document.querySelectorAll("textarea")).filter(
        (el) => el.offsetParent !== null
      );
      return visible.some((el) => (el.value || "").includes("Album pitch:"));
    },
    undefined,
    { timeout: 15000 }
  );
}
EOF
)
run_pw "${ARTIFACT_DIR}/playwright-experience-flow.log" run-code "${EXPERIENCE_FLOW_CODE}"
run_pw "${ARTIFACT_DIR}/playwright-experience-screenshot.log" screenshot --full-page --filename "${ARTIFACT_DIR}/ui-e2e-experience.png"

echo "[STEP] Verifying API docs include experience endpoints"
run_pw "${ARTIFACT_DIR}/playwright-goto-docs.log" goto "${API_URL}/docs"
DOCS_ASSERT_CODE=$(cat <<'EOF'
async (page) => {
  await page.waitForFunction(
    () => document.body.innerText.includes("/api/v1/experience/prompt-packs"),
    undefined,
    { timeout: 30000 }
  );
  await page.waitForFunction(
    () => document.body.innerText.includes("/api/v1/albums/{album_id}/experience/jam-mode"),
    undefined,
    { timeout: 30000 }
  );
}
EOF
)
run_pw "${ARTIFACT_DIR}/playwright-docs-assert.log" run-code "${DOCS_ASSERT_CODE}"
run_pw "${ARTIFACT_DIR}/playwright-docs-screenshot.log" screenshot --full-page --filename "${ARTIFACT_DIR}/api-docs-experience.png"

run_pw "${ARTIFACT_DIR}/playwright-tracing-stop.log" tracing-stop
run_pw "${ARTIFACT_DIR}/playwright-close.log" close

echo "[PASS] Playwright UI E2E assertions completed."
