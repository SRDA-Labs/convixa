#!/usr/bin/env bash
# Baseline CI simulation — intentionally unoptimized.
# Builds every workspace package sequentially with no filtering, no remote cache.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

STEP_NAME="${CI_STEP_NAME:-baseline}"
RESULTS_DIR="${ROOT_DIR}/docs/ci-playground/benchmarks"
mkdir -p "$RESULTS_DIR"

ts() { date +%s; }
elapsed() {
  local start="$1"
  local end
  end="$(ts)"
  echo $((end - start))
}

echo "══════════════════════════════════════════════════════"
echo " CI Playground — ${STEP_NAME}"
echo " Mode: FULL rebuild of all packages (no change detection)"
echo "══════════════════════════════════════════════════════"
echo ""
echo "▶ Packages in this run"
echo "  included : @convixa/shared @convixa/notifier @convixa/worker convixa(web)"
if [[ "${SKIP_WEB_BUILD:-0}" == "1" || "${SKIP_WEB_LINT:-0}" == "1" ]]; then
  echo "  notes    : SKIP_WEB_BUILD=${SKIP_WEB_BUILD:-0} SKIP_WEB_LINT=${SKIP_WEB_LINT:-0}"
fi
echo "  filter   : (none — build everything)"
echo "  tip      : omit SKIP_WEB_* for a realistic baseline (~40s+)"

TOTAL_START="$(ts)"

# ── Install (cold path; no cache reuse in baseline) ──────────────────────────
echo ""
echo "▶ [1/4] Dependency install (npm install — no cache priming)"
INSTALL_START="$(ts)"
npm install --no-audit --no-fund
INSTALL_SECS="$(elapsed "$INSTALL_START")"
echo "  ✓ install completed in ${INSTALL_SECS}s"

# ── Lint all packages sequentially ───────────────────────────────────────────
echo ""
echo "▶ [2/4] Lint all packages (sequential)"
LINT_START="$(ts)"
# Shared must be built first so dependents can resolve @convixa/shared types
npm run build --workspace=@convixa/shared
npm run lint --workspace=@convixa/shared
npm run lint --workspace=@convixa/notifier
npm run lint --workspace=@convixa/worker
# Root web lint can be slow / env-sensitive; keep it but allow skip for local demos
if [[ "${SKIP_WEB_LINT:-0}" == "1" ]]; then
  echo "  ⊘ skipped web lint (SKIP_WEB_LINT=1)"
else
  npm run lint --workspace=convixa || npm run lint
fi
LINT_SECS="$(elapsed "$LINT_START")"
echo "  ✓ lint completed in ${LINT_SECS}s"

# ── Build all packages sequentially ──────────────────────────────────────────
echo ""
echo "▶ [3/4] Build all packages (sequential, no turbo filter)"
BUILD_START="$(ts)"
# Optional educational delay so skipping packages later shows clear savings.
# Set CI_DEMO_WORK_SECS=3 (default in demo mode) to simulate heavier builds.
demo_work() {
  local pkg="$1"
  local secs="${CI_DEMO_WORK_SECS:-0}"
  if [[ "$secs" -gt 0 ]]; then
    echo "  … demo work ${secs}s for ${pkg} (CI_DEMO_WORK_SECS)"
    sleep "$secs"
  fi
}

npm run build --workspace=@convixa/shared
demo_work "@convixa/shared"
npm run build --workspace=@convixa/notifier
demo_work "@convixa/notifier"
npm run build --workspace=@convixa/worker
demo_work "@convixa/worker"
if [[ "${SKIP_WEB_BUILD:-0}" == "1" ]]; then
  echo "  ⊘ skipped web build (SKIP_WEB_BUILD=1) — use for fast playground demos"
else
  npm run build --workspace=convixa || npm run build
  demo_work "convixa(web)"
fi
BUILD_SECS="$(elapsed "$BUILD_START")"
echo "  ✓ build completed in ${BUILD_SECS}s"

# ── Test all packages sequentially ───────────────────────────────────────────
echo ""
echo "▶ [4/4] Test all packages (sequential)"
TEST_START="$(ts)"
npm run test --workspace=@convixa/shared || true
npm run test --workspace=@convixa/notifier || true
npm run test --workspace=@convixa/worker || true
TEST_SECS="$(elapsed "$TEST_START")"
echo "  ✓ test completed in ${TEST_SECS}s"

TOTAL_SECS="$(elapsed "$TOTAL_START")"

# ── Persist timing ───────────────────────────────────────────────────────────
RESULT_FILE="${RESULTS_DIR}/${STEP_NAME}.json"
cat > "$RESULT_FILE" <<EOF
{
  "step": "${STEP_NAME}",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "seconds": {
    "install": ${INSTALL_SECS},
    "lint": ${LINT_SECS},
    "build": ${BUILD_SECS},
    "test": ${TEST_SECS},
    "total": ${TOTAL_SECS}
  },
  "flags": {
    "demo_work_secs": ${CI_DEMO_WORK_SECS:-0},
    "skip_web_lint": ${SKIP_WEB_LINT:-0},
    "skip_web_build": ${SKIP_WEB_BUILD:-0},
    "change_detection": false,
    "incremental": false,
    "parallel": false,
    "dep_cache": false,
    "artifact_cache": false
  }
}
EOF

echo ""
echo "══════════════════════════════════════════════════════"
echo " BASELINE RESULTS"
echo "──────────────────────────────────────────────────────"
echo "  install : ${INSTALL_SECS}s"
echo "  lint    : ${LINT_SECS}s"
echo "  build   : ${BUILD_SECS}s"
echo "  test    : ${TEST_SECS}s"
echo "  TOTAL   : ${TOTAL_SECS}s"
echo "──────────────────────────────────────────────────────"
echo "  saved → ${RESULT_FILE}"
echo "══════════════════════════════════════════════════════"
