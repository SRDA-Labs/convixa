#!/usr/bin/env bash
# Zero-downtime blue-green deployment — pulls pre-built image from GitHub Container Registry.
# Usage: ./deploy-registry.sh [tag]
#
#   ./deploy-registry.sh              # deploys :latest
#   ./deploy-registry.sh git-abc1234  # deploys a specific build (rollback)
#
# The image is built & pushed from your dev machine via ./build-and-push.sh.
#
# One-time server setup:
#   1. Create a GitHub PAT with `read:packages` scope:
#      https://github.com/settings/tokens/new
#   2. Add the token to .env (never in bash history):
#      echo 'GHCR_TOKEN=ghp_your_token' >> .env
#
# If you ever need to build from source directly on the server, use deploy.sh.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Configuration ────────────────────────────────────────────────────────────────
REGISTRY="ghcr.io"
GHCR_OWNER="${GHCR_OWNER:-srda-labs}"
GHCR_USER="${GHCR_USER:-$GHCR_OWNER}"
REGISTRY_IMAGE="${REGISTRY}/${GHCR_OWNER}/convixa-app"
LOCAL_IMAGE="convixa-app"
TAG="${1:-latest}"

HEALTH_PATH="/api/health"
HEALTH_RETRIES=10          # down from 20 — image pull is fast, container starts quickly
HEALTH_INTERVAL=3          # down from 5
NETWORK="convixa-network"
CADDY_CONTAINER="convixa-caddy"
POSTGRES_CONTAINER="convixa-postgres"
CADDYFILE="${SCRIPT_DIR}/Caddyfile"
ENV_FILE="${SCRIPT_DIR}/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "!!! .env file not found at $ENV_FILE"
  exit 1
fi

# ── 0. Authenticate with ghcr.io ────────────────────────────────────────────────
# Auto-login using GHCR_TOKEN from .env (never in bash history).
GHCR_TOKEN="${GHCR_TOKEN:-}"
if [ -z "$GHCR_TOKEN" ]; then
  set +e; GHCR_TOKEN=$(grep -oP '^GHCR_TOKEN=\K.*' "$ENV_FILE" 2>/dev/null || true); set -e
fi

if [ -n "$GHCR_TOKEN" ]; then
  echo "$GHCR_TOKEN" | docker login "$REGISTRY" -u "$GHCR_USER" --password-stdin >/dev/null 2>&1 \
    || { echo "!!! ghcr.io login failed. Check GHCR_TOKEN in .env"; exit 1; }
fi

# ── 1. Ensure Postgres & Caddy are running ─────────────────────────────────────
echo ">>> [1/5] Ensuring infrastructure is running..."

# Start Postgres + Caddy checks in parallel
PG_UP=0
CADDY_UP=0

check_postgres() {
  if ! docker ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER}$"; then
    echo "    $POSTGRES_CONTAINER not running — starting via docker compose..."
    docker compose -f "${SCRIPT_DIR}/docker-compose.yml" --env-file "$ENV_FILE" up -d postgres
  fi
  for i in $(seq 1 15); do
    PG_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "$POSTGRES_CONTAINER" 2>/dev/null || echo "unknown")
    if [ "$PG_HEALTH" = "healthy" ]; then
      echo "    Postgres is healthy."
      return 0
    fi
    echo "    Postgres attempt $i/15 — status: $PG_HEALTH — retrying in 3s"
    sleep 3
  done
  return 1
}

check_caddy() {
  if ! docker ps --format '{{.Names}}' | grep -q "^${CADDY_CONTAINER}$"; then
    echo "    $CADDY_CONTAINER not running — starting via docker compose..."
    docker compose -f "${SCRIPT_DIR}/docker-compose.yml" --env-file "$ENV_FILE" up -d --no-deps caddy
    sleep 2
  fi
  echo "    Caddy is running."
  return 0
}

# Run in parallel
check_postgres & PG_PID=$!
check_caddy & CADDY_PID=$!

wait $PG_PID || { echo "!!! Postgres did not become healthy."; exit 1; }
wait $CADDY_PID

echo "    Infrastructure OK."

# ── 1. Pull image from registry ────────────────────────────────────────────────
echo ""
echo ">>> [2/5] Pulling ${REGISTRY_IMAGE}:${TAG}..."
docker pull "${REGISTRY_IMAGE}:${TAG}"

# ── 2. Determine active color and tag image ─────────────────────────────────────
if docker ps --format '{{.Names}}' | grep -q '^convixa-app-green$'; then
  ACTIVE="green"
  NEXT="blue"
  OLD_CONTAINER="convixa-app-green"
elif docker ps --format '{{.Names}}' | grep -qE '^(convixa-app|convixa-app-blue)$'; then
  ACTIVE="blue"
  NEXT="green"
  OLD_CONTAINER="$(docker ps --format '{{.Names}}' | grep -E '^(convixa-app|convixa-app-blue)$' | head -1)"
else
  ACTIVE=""
  NEXT="blue"
  OLD_CONTAINER=""
fi

NEW_CONTAINER="convixa-app-${NEXT}"
NEW_HOST_PORT="$([[ "$NEXT" == "blue" ]] && echo 3010 || echo 3011)"

echo ""
echo "=== Convixa deploy (registry): ${ACTIVE:-none} → ${NEXT} ==="
echo "    Image tag : ${TAG}"
echo "    New       : $NEW_CONTAINER"
echo "    Old       : ${OLD_CONTAINER:-none}"

# Tag the pulled image for local use
docker tag "${REGISTRY_IMAGE}:${TAG}" "${LOCAL_IMAGE}:${NEXT}"
docker tag "${REGISTRY_IMAGE}:${TAG}" "${LOCAL_IMAGE}:latest"

# ── 3. Run migrations ──────────────────────────────────────────────────────────
echo ""
echo ">>> [3/5] Running database migrations..."
docker run --rm \
  --name "convixa-migrate-$$" \
  --network "$NETWORK" \
  --env-file "$ENV_FILE" \
  --entrypoint /bin/sh \
  "${LOCAL_IMAGE}:latest" \
  -c "npx drizzle-kit migrate && echo 'Migrations complete.'"

# ── 4. Start new container ─────────────────────────────────────────────────────
echo ""
echo ">>> [4/5] Starting $NEW_CONTAINER on temp port $NEW_HOST_PORT..."
docker run -d \
  --name "$NEW_CONTAINER" \
  --network "$NETWORK" \
  --env-file "$ENV_FILE" \
  --restart unless-stopped \
  -p "127.0.0.1:${NEW_HOST_PORT}:3000" \
  "${LOCAL_IMAGE}:${NEXT}"

# ── 5. Health check ────────────────────────────────────────────────────────────
echo ""
echo ">>> [5/5] Health check — waiting for $NEW_CONTAINER..."
PASSED=0
for i in $(seq 1 "$HEALTH_RETRIES"); do
  STATUS=$(curl -sf -o /dev/null -w "%{http_code}" \
    "http://127.0.0.1:${NEW_HOST_PORT}${HEALTH_PATH}" 2>/dev/null || echo "000")
  if [ "$STATUS" = "200" ]; then
    echo "    Health check passed on attempt $i"
    PASSED=1
    break
  fi
  echo "    Attempt $i/$HEALTH_RETRIES — HTTP $STATUS — retrying in ${HEALTH_INTERVAL}s"
  sleep "$HEALTH_INTERVAL"
done

if [ "$PASSED" = "0" ]; then
  echo ""
  echo "!!! Health check failed after $HEALTH_RETRIES attempts."
  echo "!!! Rolling back: removing $NEW_CONTAINER (old container keeps serving)."
  docker rm -f "$NEW_CONTAINER" || true
  exit 1
fi

# ── 6. Swap Caddy ──────────────────────────────────────────────────────────────
echo ""
echo ">>> Swapping Caddy → $NEW_CONTAINER..."

DOMAIN="$(head -1 "$CADDYFILE" | awk '{print $1}')"
if [ -z "$DOMAIN" ]; then
  echo "!!! Could not read domain from Caddyfile. Aborting swap."
  docker rm -f "$NEW_CONTAINER" || true
  exit 1
fi

cat > "$CADDYFILE" <<CADDYEOF
${DOMAIN} {
    reverse_proxy ${NEW_CONTAINER}:3000
}
CADDYEOF

docker exec "$CADDY_CONTAINER" sh -c \
  "caddy adapt --config /etc/caddy/Caddyfile --adapter caddyfile 2>/dev/null \
   | curl -fsSX POST localhost:2019/load -H 'Content-Type: application/json' --data-binary @-" \
  || { echo "!!! Caddy admin API push failed — falling back to restart"; docker restart "$CADDY_CONTAINER"; sleep 3; }

# Verify live config
LIVE_UPSTREAM=$(docker exec "$CADDY_CONTAINER" sh -c \
  "curl -fs localhost:2019/config/apps/http/servers/ 2>/dev/null" \
  | grep -o '"dial":"[^"]*"' | head -1 || true)
if echo "$LIVE_UPSTREAM" | grep -q "$NEW_CONTAINER"; then
  echo "    Caddy config verified — live upstream: $NEW_CONTAINER:3000"
else
  echo "!!! Caddy config mismatch (got: ${LIVE_UPSTREAM:-unknown}). Forcing restart..."
  docker restart "$CADDY_CONTAINER"
  sleep 3
fi

# Post-swap end-to-end check
E2E_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 10 \
  "http://127.0.0.1:80" -H "Host: ${DOMAIN}" 2>/dev/null || echo "000")
if [ "$E2E_STATUS" = "000" ] || [ "$E2E_STATUS" = "502" ] || [ "$E2E_STATUS" = "503" ]; then
  echo "!!! Post-swap check failed — Caddy returned HTTP $E2E_STATUS on ${DOMAIN}."
  echo "!!! Rolling back: removing $NEW_CONTAINER."
  docker rm -f "$NEW_CONTAINER" || true
  exit 1
fi
echo "    Post-swap check passed (HTTP $E2E_STATUS)"

# Tear down old container
if [ -n "$OLD_CONTAINER" ]; then
  echo "    Tearing down old container: $OLD_CONTAINER"
  docker rm -f "$OLD_CONTAINER" || true
fi

echo ""
echo "=== Deployment complete. Active: $NEXT ($NEW_CONTAINER) ==="
