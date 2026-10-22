#!/usr/bin/env bash
# Build Convixa Docker image and push to GitHub Container Registry.
# Usage: ./build-and-push.sh [tag]
#
# Prior setup (one-time):
#   1. Create a GitHub Personal Access Token with `write:packages` scope:
#      https://github.com/settings/tokens/new
#   2. Add the token to .env (never in bash history):
#      echo 'GHCR_TOKEN=ghp_your_token' >> .env
#
# The server only needs `read:packages` scope to pull (see deploy-registry.sh).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"
REGISTRY="ghcr.io"
GHCR_OWNER="${GHCR_OWNER:-srda-labs}"
GHCR_USER="${GHCR_USER:-$GHCR_OWNER}"
REPO="${GHCR_OWNER}/convixa-app"
IMAGE="${REGISTRY}/${REPO}"

# Tag strategy: 'latest' for the most recent, plus a git-hash tag for pinning/rollback
TAG="${1:-latest}"
GIT_HASH=$(git -C "$SCRIPT_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown")

echo "=== Convixa: build & push ==="
echo "    Registry : $REGISTRY"
echo "    Image    : $IMAGE"
echo "    Tags     : $TAG, git-$GIT_HASH"
echo ""

# ── Authenticate ────────────────────────────────────────────────────────────────
# Auto-login using GHCR_TOKEN from .env (never in bash history).
# To set up, add this line to your .env file:
#   GHCR_TOKEN=ghp_your_token_here
GHCR_TOKEN="${GHCR_TOKEN:-}"

# If GHCR_TOKEN not in environment, try sourcing .env
if [ -z "$GHCR_TOKEN" ] && [ -f "$ENV_FILE" ]; then
  set +e; GHCR_TOKEN=$(grep -oP '^GHCR_TOKEN=\K.*' "$ENV_FILE" 2>/dev/null || true); set -e
fi

if ! docker pull "$IMAGE:latest" >/dev/null 2>&1; then
  if [ -n "$GHCR_TOKEN" ]; then
    echo "    Logging into $REGISTRY (using GHCR_TOKEN from .env)..."
    echo "$GHCR_TOKEN" | docker login "$REGISTRY" -u "$GHCR_USER" --password-stdin >/dev/null 2>&1 \
      && echo "    Authenticated." \
      || { echo "!!! Login failed. Check your GHCR_TOKEN."; exit 1; }
  else
    echo "!!! Not authenticated with $REGISTRY."
    echo "    Add GHCR_TOKEN to your .env file:"
    echo ""
    echo "      echo 'GHCR_TOKEN=ghp_your_token' >> .env"
    echo ""
    echo "    Or login interactively (input is NOT saved to bash history):"
    echo "      docker login $REGISTRY -u $GHCR_USER"
    echo ""
    echo "    Create a PAT at: https://github.com/settings/tokens/new"
    echo "    Required scope: write:packages"
    echo ""
    # Continue — docker push will give the definitive error
  fi
fi

# ── Build & Push ────────────────────────────────────────────────────────────────
# Build for linux/amd64 (server architecture). Your Mac is ARM64, so native
# modules (keccak, better-sqlite3, etc.) will cross-compile via QEMU — slower
# than native, but the server never builds, only you do.
#
# Using --push combines build + push in one step. The image goes straight to
# the registry. If you need it locally for testing, pull it back:
#   docker pull ghcr.io/$GHCR_OWNER/convixa-app:latest
echo ">>> Building for linux/amd64 and pushing to $REGISTRY..."
docker buildx build \
  --platform linux/amd64 \
  -t "$IMAGE:$TAG" \
  -t "$IMAGE:git-$GIT_HASH" \
  -t "$IMAGE:latest" \
  --push \
  "$SCRIPT_DIR"

echo ""
echo "=== Build & push complete ==="
echo "    Server can now run:  ./deploy-registry.sh"
echo ""
echo "    To rollback:  ./deploy-registry.sh git-<hash>"
