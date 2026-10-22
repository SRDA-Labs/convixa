#!/usr/bin/env bash
# Zero-downtime blue-green deployment for Convixa.
# Usage: ./deploy.sh
#
# Ensures the network, Postgres, and Caddy are running, then builds a new
# image, starts the inactive color container, health-checks it, swaps Caddy
# to route traffic to it, and tears down the old container.
# On health-check failure: tears down the new container and exits non-zero (old container keeps serving).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_NAME="convixa-app"
HEALTH_PATH="/api/health"
HEALTH_RETRIES=20
HEALTH_INTERVAL=5
NETWORK="convixa-network"
CADDY_CONTAINER="convixa-caddy"
POSTGRES_CONTAINER="convixa-postgres"
CADDYFILE="${SCRIPT_DIR}/Caddyfile"
ENV_FILE="${SCRIPT_DIR}/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "!!! .env file not found at $ENV_FILE"
  exit 1
fi

# ---------------------------------------------------------------------------
# 0. Ensure infrastructure (Postgres, Caddy) is running
# ---------------------------------------------------------------------------
echo ">>> [1/6] Ensuring infrastructure is running..."

# Start Postgres if not already up; docker compose also creates the network
if ! docker ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER}$"; then
  echo "    $POSTGRES_CONTAINER not running — starting via docker compose..."
  docker compose -f "${SCRIPT_DIR}/docker-compose.yml" --env-file "$ENV_FILE" up -d postgres
fi

# Wait for Postgres health check to pass
PG_READY=0
for i in $(seq 1 20); do
  PG_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "$POSTGRES_CONTAINER" 2>/dev/null || echo "unknown")
  if [ "$PG_HEALTH" = "healthy" ]; then
    echo "    Postgres is healthy."
    PG_READY=1
    break
  fi
  echo "    Attempt $i/20 — postgres status: $PG_HEALTH — retrying in 5s"
  sleep 5
done

if [ "$PG_READY" = "0" ]; then
  echo "!!! Postgres did not become healthy after 100 s. Aborting."
  exit 1
fi

# Start Caddy if not already up (--no-deps skips the 'app' dependency in compose)
if ! docker ps --format '{{.Names}}' | grep -q "^${CADDY_CONTAINER}$"; then
  echo "    $CADDY_CONTAINER not running — starting via docker compose..."
  docker compose -f "${SCRIPT_DIR}/docker-compose.yml" --env-file "$ENV_FILE" up -d --no-deps caddy
fi

echo "    Infrastructure OK."

# ---------------------------------------------------------------------------
# Determine which color is currently active
# ---------------------------------------------------------------------------
ACTIVE=""
OLD_CONTAINER=""

if docker ps --format '{{.Names}}' | grep -q '^convixa-app-green$'; then
  ACTIVE="green"
  NEXT="blue"
  OLD_CONTAINER="convixa-app-green"
elif docker ps --format '{{.Names}}' | grep -qE '^(convixa-app|convixa-app-blue)$'; then
  ACTIVE="blue"
  NEXT="green"
  OLD_CONTAINER="$(docker ps --format '{{.Names}}' | grep -E '^(convixa-app|convixa-app-blue)$' | head -1)"
else
  # First deploy — no app container running yet
  ACTIVE=""
  NEXT="blue"
  OLD_CONTAINER=""
fi

NEW_CONTAINER="convixa-app-${NEXT}"
# Temporary host-bound port used only for the health check; not exposed after swap
NEW_HOST_PORT="$([[ "$NEXT" == "blue" ]] && echo 3010 || echo 3011)"

echo ""
echo "=== Convixa deploy: ${ACTIVE:-none} → ${NEXT} ==="
echo "    New container : $NEW_CONTAINER"
echo "    Old container : ${OLD_CONTAINER:-none}"

# ---------------------------------------------------------------------------
# 1. Build
# ---------------------------------------------------------------------------
echo ""
echo ">>> [2/6] Building image ${IMAGE_NAME}:${NEXT}..."
docker build -t "${IMAGE_NAME}:${NEXT}" "$SCRIPT_DIR"
docker tag "${IMAGE_NAME}:${NEXT}" "${IMAGE_NAME}:latest"

# ---------------------------------------------------------------------------
# 2. Run migrations (one-shot, before new app starts)
# ---------------------------------------------------------------------------
echo ""
echo ">>> [3/6] Running database migrations..."
docker run --rm \
  --name "convixa-migrate-$$" \
  --network "$NETWORK" \
  --env-file "$ENV_FILE" \
  --entrypoint /bin/sh \
  "${IMAGE_NAME}:latest" \
  -c "npx drizzle-kit migrate && echo 'Migrations complete.'"

# ---------------------------------------------------------------------------
# 3. Start new container
# ---------------------------------------------------------------------------
echo ""
echo ">>> [4/6] Starting $NEW_CONTAINER on temp port $NEW_HOST_PORT..."
docker run -d \
  --name "$NEW_CONTAINER" \
  --network "$NETWORK" \
  --env-file "$ENV_FILE" \
  --restart unless-stopped \
  -p "127.0.0.1:${NEW_HOST_PORT}:3000" \
  "${IMAGE_NAME}:${NEXT}"

# ---------------------------------------------------------------------------
# 4. Health check
# ---------------------------------------------------------------------------
echo ""
echo ">>> [5/6] Waiting for $NEW_CONTAINER to pass health check..."
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

# ---------------------------------------------------------------------------
# 5. Swap Caddy to new container
# ---------------------------------------------------------------------------
echo ""
echo ">>> [6/6] Swapping Caddy → $NEW_CONTAINER..."

# Read current domain from first line of Caddyfile
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

# Push config via admin API first (bypasses any stale bind-mount the reload would see)
docker exec "$CADDY_CONTAINER" sh -c \
  "caddy adapt --config /etc/caddy/Caddyfile --adapter caddyfile 2>/dev/null \
   | curl -fsSX POST localhost:2019/load -H 'Content-Type: application/json' --data-binary @-" \
  || { echo "!!! Caddy admin API push failed — falling back to restart"; docker restart "$CADDY_CONTAINER"; sleep 3; }

# Verify Caddy's live config actually routes to the new container
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

# Post-swap end-to-end check: confirm the domain is actually reachable
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
