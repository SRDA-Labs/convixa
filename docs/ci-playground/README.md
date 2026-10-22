# CI Playground (DevSecOps learning path)

Convert this repo into a hands-on lab for CI/CD performance optimizations
and security scanning. Each step is explained first; **you write the code**,
then we re-run and compare timings.

## Current status

| Step | Optimization | Status |
|------|--------------|--------|
| 0 | Foundation + unoptimized baseline | ✅ done (provided) |
| 1 | Change detection (affected packages only) | ✍️ you implement |
| 2 | Incremental builds | pending |
| 3 | Parallel independent jobs | pending |
| 4 | Cache dependency installation | pending |
| 5 | Cache build artifacts | pending |
| 6 | Docker layer caching | pending |
| 7 | Semgrep (changed files on PRs) | pending |
| 8 | Trivy (skip when lockfiles unchanged) | pending |
| 9 | Syft SBOM (reuse when dep hashes match) | pending |
| 10 | Nightly full security suite | pending |
| 11 | Dependency-graph skip (Turbo filters) | pending |

## Quick start

```bash
# Your full baseline (~40s)
npm run ci:baseline

# After you implement Step 1:
# CI_CHANGED_SCOPE=notifier npm run ci:change-detection
# npm run ci:benchmark -- docs/ci-playground/benchmarks/baseline.json docs/ci-playground/benchmarks/01-change-detection.json
```

## Docs

- **[DEVSECOPS-CI-OPTIMIZATIONS-GUIDE.md](./DEVSECOPS-CI-OPTIMIZATIONS-GUIDE.md)** — full article on all techniques (read this if short on time)
- [STEP-00-baseline.md](./STEP-00-baseline.md)
- [STEP-01-change-detection.md](./STEP-01-change-detection.md)
