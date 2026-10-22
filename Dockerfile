# Multi-stage build optimised for fast deploys.
#
# Stages:
#   deps    — full npm ci (BuildKit cache mount keeps tarballs across builds)
#   builder — Next.js compile using deps node_modules, then prune + add drizzle-kit
#   runner  — lean production image with standalone output + pruned node_modules
#
# Big win over the old Dockerfile: eliminated the migration-deps stage that re-ran
# `npm ci --omit=dev` separately, saving ~200s of duplicate package downloads.
#
# Cache mounts used:
#   convixa-npm-deps              — npm tarball cache (shared across all npm ci runs)
#   convixa-nextjs-build-cache    — Next.js incremental compile cache
#   convixa-apk-cache             — Alpine package cache (gcc/g++ re-download ~300s)

# Pin to a specific Alpine version — prevents the floating `node:20-alpine` tag
# from changing digest on every Alpine security update, which invalidates all layers.
FROM node:20-alpine3.21 AS base

# ── Full deps (build-time) ────────────────────────────────────────────────────
FROM base AS deps
# apk cache mount reuses downloaded packages across builds even if the layer
# above gets invalidated. `--no-cache` removed so apk writes to /var/cache/apk.
RUN --mount=type=cache,id=convixa-apk-cache,target=/var/cache/apk \
    apk add libc6-compat python3 make g++
ENV PYTHON=/usr/bin/python3
WORKDIR /app
COPY package.json package-lock.json* ./
# --no-audit --no-fund skips security audit and funding messages (~15s savings)
RUN --mount=type=cache,id=convixa-npm-deps,target=/root/.npm \
    npm ci --no-audit --no-fund

# ── Builder ───────────────────────────────────────────────────────────────────
FROM base AS builder
# Reuses the same apk cache mount — packages already downloaded by deps stage.
# Install itself is still needed (native deps like keccak, bufferutil, better-sqlite3
# may need compilation during npm install of drizzle-kit after prune).
RUN --mount=type=cache,id=convixa-apk-cache,target=/var/cache/apk \
    apk add libc6-compat python3 make g++
ENV PYTHON=/usr/bin/python3
WORKDIR /app

# Copy full node_modules from deps (shared via BuildKit cache internally)
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env vars (NEXT_PUBLIC_* are inlined into client bundle by Next.js).
# Set via --build-arg in CI; defaults let local builds work unmodified.
ARG NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
ARG NEXT_PUBLIC_APP_BASE_URL
ARG NEXT_PUBLIC_APP_VERSION
ARG NEXT_PUBLIC_CHAIN
ARG NEXT_PUBLIC_LEDGER_DAPP_IDENTIFIER
ARG NEXT_PUBLIC_LEDGER_WALLET_PROVIDER_API_KEY

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV CI=true
ENV NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=$NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
ENV NEXT_PUBLIC_APP_BASE_URL=$NEXT_PUBLIC_APP_BASE_URL
ENV NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION
ENV NEXT_PUBLIC_CHAIN=$NEXT_PUBLIC_CHAIN
ENV NEXT_PUBLIC_LEDGER_DAPP_IDENTIFIER=$NEXT_PUBLIC_LEDGER_DAPP_IDENTIFIER
ENV NEXT_PUBLIC_LEDGER_WALLET_PROVIDER_API_KEY=$NEXT_PUBLIC_LEDGER_WALLET_PROVIDER_API_KEY

# Build Next.js with persistent cache (warm builds ~60s, cold ~240s)
RUN --mount=type=cache,id=convixa-nextjs-build-cache,target=/app/.next/cache \
    npm run build

# After build, prune dev deps. drizzle-kit and dotenv are now regular
# dependencies (moved from devDeps in package.json) so prune keeps them.
RUN npm prune --omit=dev --no-audit --no-fund

# ── Runner ────────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Next.js standalone output (app runtime)
COPY --chown=nextjs:nodejs --from=builder /app/public ./public
COPY --chown=nextjs:nodejs --from=builder /app/.next/standalone ./
COPY --chown=nextjs:nodejs --from=builder /app/.next/static ./.next/static

# Migration SQL files
COPY --chown=nextjs:nodejs --from=builder /app/drizzle ./drizzle

# Pruned node_modules (production only + drizzle-kit) 
COPY --chown=nextjs:nodejs --from=builder /app/node_modules ./node_modules

# Migration runner support files
COPY --chown=nextjs:nodejs --from=builder /app/scripts ./scripts
COPY --chown=nextjs:nodejs --from=builder /app/package.json ./package.json
COPY --chown=nextjs:nodejs --from=builder /app/package-lock.json ./package-lock.json
COPY --chown=nextjs:nodejs --from=builder /app/drizzle.config.ts ./drizzle.config.ts

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
