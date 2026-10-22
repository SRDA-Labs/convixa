#!/usr/bin/env bash
# =============================================================================
# Step 1 — Change detection
# =============================================================================
#
# PROBLEM (baseline):
#   Every CI run builds ALL packages, even if your PR only touched notifier.
#
# SOLUTION (this script):
#   1. Decide a Turborepo --filter (demo scope OR real git via turbo).
#   2. Run lint/build/test ONLY for packages in that filter.
#   3. Write timings so you can compare against baseline with ci:benchmark.
#
# HOW "DETECTION" WORKS:
#   - Demo mode (CI_CHANGED_SCOPE set): YOU pretend what changed — no git.
#   - Real mode (unset): filter is "...[origin/main]". When turbo runs, IT
#     compares your working tree to that git ref and selects packages.
#     This script never calls `git diff` itself — turbo does under the hood.
#
# TRY IT:
#   chmod +x scripts/ci/run-change-detection.sh
#   CI_CHANGED_SCOPE=notifier npm run ci:change-detection
#   npm run ci:benchmark -- \
#     docs/ci-playground/benchmarks/baseline.json \
#     docs/ci-playground/benchmarks/01-change-detection.json
# =============================================================================

# -e  = exit if any command fails
# -u  = error on unset variables (catches typos like $TURBO_FILTR)
# -o pipefail = a pipeline fails if ANY stage fails, not only the last
set -euo pipefail

# BASH_SOURCE[0] = path to THIS script, even if you invoked it via npm from elsewhere.
# dirname        = directory containing the script  →  scripts/ci
# ../..          = climb to repo root
# cd && pwd      = resolve to an absolute path
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# All relative paths below (package.json, docs/..., npx turbo) assume repo root.
cd "$ROOT_DIR"

# Name used in the banner and in the output JSON filename.
# Override with: CI_STEP_NAME=my-run npm run ci:change-detection
STEP_NAME="${CI_STEP_NAME:-01-change-detection}"

# Where benchmark JSON files live (same folder as baseline.json).
RESULTS_DIR="${ROOT_DIR}/docs/ci-playground/benchmarks"

# Create the folder if it does not exist yet (-p = no error if it already exists).
mkdir -p "$RESULTS_DIR"

# ── Timing helpers (same idea as run-baseline.sh) ────────────────────────────

# Return current Unix time in whole seconds (e.g. 1720000000).
ts() { date +%s; }

# Given a start timestamp, print how many seconds have elapsed.
# Usage: START="$(ts)"; ...work...; SECS="$(elapsed "$START")"
elapsed() {
  local start="$1"   # local = variable only exists inside this function
  local end
  end="$(ts)"
  echo $((end - start))   # $((...)) = arithmetic expansion
}

# ── 1. Resolve TURBO_FILTER ──────────────────────────────────────────────────
# This block only SETS a filter string. Turbo applies it later when we run tasks.
#
# -n "${VAR:-}"  →  true if VAR is set and non-empty.
# ${VAR:-}       →  expands to empty string if VAR is unset (safe with set -u).

if [[ -n "${CI_CHANGED_SCOPE:-}" ]]; then
  # ── Demo mode: you manually choose which “PR area” to simulate ─────────────
  # case matches the value of CI_CHANGED_SCOPE against each pattern.
  case "${CI_CHANGED_SCOPE}" in
    notifier)
      # Trailing "..." = this package + its DEPENDENCIES.
      # So notifier pulls in @convixa/shared (needed to compile imports).
      TURBO_FILTER="@convixa/notifier..."
      INCLUDED_PACKAGES="@convixa/shared @convixa/notifier"
      SKIPPED_PACKAGES="@convixa/worker convixa(web)"
      BASE_REF="(demo: CI_CHANGED_SCOPE=notifier)"
      ;;
    worker)
      TURBO_FILTER="@convixa/worker..."
      INCLUDED_PACKAGES="@convixa/shared @convixa/worker"
      SKIPPED_PACKAGES="@convixa/notifier convixa(web)"
      BASE_REF="(demo: CI_CHANGED_SCOPE=worker)"
      ;;
    shared)
      # Leading "..." = this package + its DEPENDENTS.
      # If shared changes, notifier and worker must rebuild too.
      TURBO_FILTER="...@convixa/shared"
      INCLUDED_PACKAGES="@convixa/shared @convixa/notifier @convixa/worker"
      SKIPPED_PACKAGES="convixa(web)"
      BASE_REF="(demo: CI_CHANGED_SCOPE=shared)"
      ;;
    web)
      # "//" is Turborepo’s name for the root workspace package (Next.js app).
      TURBO_FILTER="//"
      INCLUDED_PACKAGES="convixa(web)"
      SKIPPED_PACKAGES="@convixa/shared @convixa/notifier @convixa/worker"
      BASE_REF="(demo: CI_CHANGED_SCOPE=web)"
      ;;
    *)
      # Fallback: treat whatever you passed as a raw turbo filter string.
      # Example: CI_CHANGED_SCOPE='@convixa/worker...'
      TURBO_FILTER="${CI_CHANGED_SCOPE}"
      INCLUDED_PACKAGES="(see turbo dry-run)"
      SKIPPED_PACKAGES="(see turbo dry-run)"
      BASE_REF="(demo: raw filter)"
      ;;
  esac
else
  # ── Real git mode: turbo will compare against a base ref ───────────────────
  # ${CI_BASE_REF:-origin/main} = use CI_BASE_REF if set, otherwise origin/main.
  BASE_REF="${CI_BASE_REF:-origin/main}"

  # "...[ref]" tells turbo: select packages that differ from that git ref.
  # Turbo runs the equivalent of a git diff internally — we do not call git here.
  TURBO_FILTER="...[${BASE_REF}]"

  # We cannot know the exact list until turbo runs, so the banner says so.
  INCLUDED_PACKAGES="(resolved by turbo from git diff vs ${BASE_REF})"
  SKIPPED_PACKAGES="(whatever turbo did not select)"
fi

# ── 2. Banner — so you can SEE the decision before work starts ───────────────

echo "══════════════════════════════════════════════════════"
echo " CI Playground — ${STEP_NAME}"
echo " Mode: CHANGE DETECTION (only affected packages)"
echo "══════════════════════════════════════════════════════"
echo ""
echo "▶ Packages in this run"
echo "  included : ${INCLUDED_PACKAGES}"
echo "  skipped  : ${SKIPPED_PACKAGES}"
echo "  filter   : ${TURBO_FILTER}"
echo "  base ref : ${BASE_REF}"
echo "  tip      : demo with CI_CHANGED_SCOPE=notifier to skip the web build"

# ── 3. Dry-run — print what turbo WOULD run (no compile yet) ─────────────────
# Read the "Packages in scope" section. That is the core lesson of Step 1.
# sed -n '1,40p' = show only the first 40 lines so the log stays readable.
# || true        = do not abort the script if dry-run exits non-zero.

echo ""
echo "▶ Turbo dry-run (what WOULD execute — learn from this)"
npx turbo run build --filter="${TURBO_FILTER}" --dry-run 2>&1 | sed -n '1,40p' || true

# Start the overall wall-clock timer for the whole pipeline.
TOTAL_START="$(ts)"

# ── 4. Install — still FULL install (dependency caching is Step 4) ───────────

echo ""
echo "▶ [1/4] Dependency install (still uncached — that’s Step 4)"
INSTALL_START="$(ts)"
npm install --no-audit --no-fund
INSTALL_SECS="$(elapsed "$INSTALL_START")"
echo "  ✓ install completed in ${INSTALL_SECS}s"

# ── 5. Lint / build / test — ONLY packages matching TURBO_FILTER ─────────────
#
# --filter=...  = restrict which packages run
# --force       = ignore turbo’s local task cache so THIS step measures
#                 “skip unaffected packages” only. Cache wins come in Steps 2/5.
#
# turbo.json already says build depends on ^build, so shared builds before
# notifier when the filter includes both.

echo ""
echo "▶ [2/4] Lint affected packages"
LINT_START="$(ts)"
npx turbo run lint --filter="${TURBO_FILTER}" --force
LINT_SECS="$(elapsed "$LINT_START")"
echo "  ✓ lint completed in ${LINT_SECS}s"

echo ""
echo "▶ [3/4] Build affected packages"
BUILD_START="$(ts)"
npx turbo run build --filter="${TURBO_FILTER}" --force
BUILD_SECS="$(elapsed "$BUILD_START")"
echo "  ✓ build completed in ${BUILD_SECS}s"

echo ""
echo "▶ [4/4] Test affected packages"
TEST_START="$(ts)"
# || true = playground packages may have no real tests yet; don’t fail the lab
npx turbo run test --filter="${TURBO_FILTER}" --force || true
TEST_SECS="$(elapsed "$TEST_START")"
echo "  ✓ test completed in ${TEST_SECS}s"

TOTAL_SECS="$(elapsed "$TOTAL_START")"

# ── 6. Persist timings (same JSON shape as baseline for ci:benchmark) ────────

RESULT_FILE="${RESULTS_DIR}/${STEP_NAME}.json"

# cat <<EOF ... EOF  = write a multi-line file (heredoc).
# Variables inside are expanded by the shell before writing.
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
    "change_detection": true,
    "incremental": false,
    "parallel": false,
    "dep_cache": false,
    "artifact_cache": false,
    "turbo_filter": "${TURBO_FILTER}",
    "base_ref": "${BASE_REF}",
    "included_packages": "${INCLUDED_PACKAGES}",
    "skipped_packages": "${SKIPPED_PACKAGES}"
  }
}
EOF

echo ""
echo "══════════════════════════════════════════════════════"
echo " RESULTS — ${STEP_NAME}"
echo "──────────────────────────────────────────────────────"
echo "  install : ${INSTALL_SECS}s"
echo "  lint    : ${LINT_SECS}s"
echo "  build   : ${BUILD_SECS}s"
echo "  test    : ${TEST_SECS}s"
echo "  TOTAL   : ${TOTAL_SECS}s"
echo "──────────────────────────────────────────────────────"
echo "  saved → ${RESULT_FILE}"
echo "══════════════════════════════════════════════════════"
echo ""
echo "Next: compare to baseline with:"
echo "  npm run ci:benchmark -- \\"
echo "    docs/ci-playground/benchmarks/baseline.json \\"
echo "    ${RESULT_FILE}"
