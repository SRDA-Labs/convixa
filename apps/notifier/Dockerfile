FROM node:20-alpine3.21 AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/notifier/package.json ./apps/notifier/
RUN npm ci --workspace=@convixa/notifier --include-workspace-root=false --no-audit --no-fund || \
    npm install --workspace=@convixa/notifier --no-audit --no-fund

FROM node:20-alpine3.21 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY packages/shared ./packages/shared
COPY apps/notifier ./apps/notifier
COPY package.json ./
RUN npm run build --workspace=@convixa/shared && npm run build --workspace=@convixa/notifier

FROM node:20-alpine3.21 AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/notifier ./apps/notifier
COPY --from=builder /app/node_modules ./node_modules
WORKDIR /app/apps/notifier
EXPOSE 3101
CMD ["node", "dist/index.js"]
