#!/usr/bin/env bash
# Compare two benchmark JSON files and print improvement.
# Usage: scripts/ci/benchmark.sh [before.json] [after.json]
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BENCH_DIR="${ROOT_DIR}/docs/ci-playground/benchmarks"

BEFORE="${1:-${BENCH_DIR}/baseline.json}"
AFTER="${2:-}"

if [[ -z "$AFTER" ]]; then
  # Pick the newest non-baseline result if not specified
  AFTER="$(ls -t "${BENCH_DIR}"/*.json 2>/dev/null | grep -v baseline.json | head -1 || true)"
fi

if [[ ! -f "$BEFORE" ]]; then
  echo "Missing before file: $BEFORE"
  echo "Run: npm run ci:baseline   (or SKIP_WEB_BUILD=1 npm run ci:baseline for a fast demo)"
  exit 1
fi

if [[ -z "$AFTER" || ! -f "$AFTER" ]]; then
  echo "Missing after file. Provide path or run an optimized step first."
  echo "Usage: $0 <before.json> <after.json>"
  exit 1
fi

python3 - "$BEFORE" "$AFTER" <<'PY'
import json, sys

before_path, after_path = sys.argv[1], sys.argv[2]
before = json.load(open(before_path))
after = json.load(open(after_path))

bs = before["seconds"]
as_ = after["seconds"]

def pct(old, new):
    if old == 0:
        return "n/a"
    return f"{((old - new) / old) * 100:.1f}%"

print("══════════════════════════════════════════════════════")
print(f" Benchmark: {before['step']} → {after['step']}")
print("──────────────────────────────────────────────────────")
print(f"{'phase':<12} {'before':>8} {'after':>8} {'saved':>8} {'improve':>10}")
print("──────────────────────────────────────────────────────")
for key in ("install", "lint", "build", "test", "total"):
    b = bs.get(key, 0)
    a = as_.get(key, 0)
    saved = b - a
    print(f"{key:<12} {b:>7}s {a:>7}s {saved:>7}s {pct(b,a):>10}")
print("──────────────────────────────────────────────────────")
print(f" before file: {before_path}")
print(f" after file : {after_path}")
print("══════════════════════════════════════════════════════")
PY
