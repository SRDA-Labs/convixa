FROM node:20-alpine3.21 AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/worker/package.json ./apps/worker/
RUN npm ci --workspace=@convixa/worker --include-workspace-root=false --no-audit --no-fund || \
    npm install --workspace=@convixa/worker --no-audit --no-fund

FROM node:20-alpine3.21 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY packages/shared ./packages/shared
COPY apps/worker ./apps/worker
COPY package.json ./
RUN npm run build --workspace=@convixa/shared && npm run build --workspace=@convixa/worker

FROM node:20-alpine3.21 AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/worker ./apps/worker
COPY --from=builder /app/node_modules ./node_modules
WORKDIR /app/apps/worker
CMD ["node", "dist/index.js"]
