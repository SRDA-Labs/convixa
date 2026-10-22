# Convixa

*A tool by [SRDA Labs](https://github.com/SRDA-Labs) — Security Research and Defence Advisory.*

**Self-hosted inventory and governance for [Safe](https://safe.global) multisigs.** Deploy on your infrastructure — teams, RBAC, alerts, pre-sign checklists, and SEAL-aligned security workflows. Convixa does **not custody keys or execute** transactions. Optionally, connected wallets can **propose** owner-change Safe transactions (add / remove / rotate signer) from Inventory → Transactions; execution still happens in Safe{Wallet}.

> **Scope:** Convixa is released as open source by SRDA Labs under the MIT License. It is structured around [SEAL Secure Multisig Best Practices](https://frameworks.securityalliance.org/wallet-security/secure-multisig-best-practices/) but is **not affiliated with or endorsed by** Security Alliance.

---

## Features

- **Org & teams:** Create an org, create teams (e.g. Finance, Ops), assign team leads.
- **Inventory:** Add Safe addresses by network (Ethereum, Base, Arbitrum, etc.); optional name and notes. Inventory → Transactions includes a **Propose transaction** wizard for add/remove/rotate signer across selected Safes.
- **Safe data:** Fetches threshold, signers, pending count, and last activity from [Safe Transaction Service API](https://docs.safe.global/core-api/transaction-service-overview). Set `SAFE_API_KEY` in `.env` for authenticated access (recommended for production and tunnel testing to avoid rate limits; see [How to use API Keys](https://docs.safe.global/core-api/how-to-use-api-keys)).
- **Refresh:** On-demand refresh of Safe data; cached in DB.
- **Export:** CSV export of inventory (address, network, name, team, threshold, signers, etc.).
- **Audit log:** Logs who added/removed Safes and team changes.
- **SEAL-aligned governance:** Configuration health monitoring, compliance scorecards, signer roster & affiliation verification, pre-sign checklists, OOB verification cases, incident reporting, readiness drills, advanced governance (timelocks, testnet twins, policy gaps), certification export pack, module/guard inventory, signer overlap reports, and EOA activity watch — see [docs/SEAL_COMPLIANCE.md](docs/SEAL_COMPLIANCE.md). **Manual test checklist:** [docs/SEAL_MANUAL_TEST_CHECKLIST.md](docs/SEAL_MANUAL_TEST_CHECKLIST.md).

## Stack

- **Next.js 15** (App Router), TypeScript, Tailwind CSS
- **PostgreSQL** + **Drizzle ORM** – production-ready database
- **NextAuth** — email/password (Credentials) and **optional Google sign-in** when `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are set
- **Wallets (optional):** RainbowKit + WalletConnect for connect flows; optional [Ledger Wallet Provider](https://developers.ledger.com/docs/ledger-wallet-provider/overview) (`NEXT_PUBLIC_LEDGER_WALLET_PROVIDER_API_KEY`) for direct USB/BT Ledger; SIWE-backed link-wallet APIs under `src/app/api/profile/` and settings UI
- **Safe API** (inventory/alerts read path) + optional in-app **propose** of owner-change txs via Protocol Kit (user wallet signs; service relay with `SAFE_API_KEY`)

Commands below use `npm run …`; the repo includes `package-lock.json` (`npm ci` in Docker). You can use **pnpm** or **yarn** locally if you prefer.

## Setup

> **Env convention:** The single active config file is `.env` (gitignored — never commit it). Templates are committed for reference:
> - `.env.example` → for local dev / Docker dev mode
> - `.env.example.docker` → for full Docker stack mode
>
> Copy the right template to `.env` and fill in the required values before running.

### Option 1: Docker Setup (Recommended)

**Full Stack Mode** (Everything in Docker):

```bash
# 1. Copy Docker environment template
cp .env.example.docker .env
# Edit .env — set NEXTAUTH_SECRET (generate with: openssl rand -base64 32)
# Optional: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET for “Sign in with Google”
# (compose passes them into the app; redirect URI must include http://localhost:3000/api/auth/callback/google)

# 2. Start everything (PostgreSQL + App)
npm run docker:full
# On first start the app container runs Drizzle migrations (see DOCKER.md if startup fails).

# 3. Open http://localhost:3000 and register — the first user becomes org owner (full admin).
```

**Development Mode** (PostgreSQL in Docker, App runs locally with hot-reload):

```bash
# 1. Copy local environment template
cp .env.example .env
# Edit .env — set NEXTAUTH_SECRET and ensure:
# DATABASE_URL=postgresql://convixa:convixa_password@localhost:5432/convixa

# 2. Start PostgreSQL in Docker
npm run docker:dev

# 3. Run migrations
npm run db:push

# 4. Start app locally with hot-reload
npm run dev

# 5. Open http://localhost:3001 and register your first account
```

See **[DOCKER.md](DOCKER.md)** for comprehensive Docker setup guide.

### Option 2: Manual Setup

1. **Clone and install**

   ```bash
   npm install
   ```

2. **Environment**

   Copy `.env.example` to `.env` and fill in:

   - `NEXTAUTH_SECRET` – generate with `openssl rand -base64 32`
   - `NEXTAUTH_URL` – e.g. `http://localhost:3001`
   - `DATABASE_URL` – PostgreSQL connection string (required)

3. **Database**

   Install PostgreSQL locally or use a cloud provider (Neon, Supabase, Railway, Render).

   **Local setup:**
   ```bash
   createdb convixa
   ```

   Then set `DATABASE_URL` in `.env`:
   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/convixa
   ```

   **Push schema to database:**
   ```bash
   npm run db:push
   ```

4. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3001](http://localhost:3001). Create an account, then add a Safe from the dashboard.

## Scripts

**Development:**
- `npm run dev` – Start dev server (port **3001**)
- `npm run dev:turbo` – Same as `dev` but with Turbopack
- `npm run build` – Production build
- `npm run start` – Start production server

**Database:**
- `npm run db:push` – Push schema to DB (development)
- `npm run db:generate` – Generate Drizzle migrations
- `npm run db:migrate` – Run migrations (production)
- `npm run db:studio` – Open Drizzle Studio (DB GUI)

**Alerting (optional):**
- `npx tsx scripts/seed-alert-subscriptions.ts <orgId>` – Create example alert subscriptions (email + Slack) for proposal-time events. Set `ALERT_EMAIL` or `ADMIN_EMAIL`, and optionally `SLACK_WEBHOOK_URL`.

**Docker:**
- `npm run docker:full` – Start full stack (PostgreSQL + App)
- `npm run docker:dev` – Start PostgreSQL only (for local dev)
- `npm run docker:full:down` – Stop full stack
- `npm run docker:dev:down` – Stop dev services
- `npm run docker:full:clean` / `npm run docker:dev:clean` – Stop and remove volumes
- `npm run docker:logs` – View full-stack container logs
- `npm run docker:logs:dev` – View dev Postgres logs

See **[DOCKER.md](DOCKER.md)** for all Docker commands and detailed usage.

## Admin & access control

Convixa is **self-hosted**: there is no platform operator console. The **first registered user** becomes **org owner** with full administrative access. Owners and admins can:

- Invite members and assign **custom roles** with granular permissions (`/dashboard/teams` → Roles)
- Manage teams, safes, alerts, policies, and org settings

## Alerting (Level 1 – proposal-time)

The app can poll the Safe Transaction Service for **pending** (not executed) multisig transactions, classify them (governance, ERC20, ETH transfer, contract call), and send **email** and **Slack** notifications. Idempotent: no duplicate alerts for the same transaction.

**Flow:** Poll all safes → fetch pending txs → insert `raw_transactions` → classify → insert `normalized_events` → find `alert_subscriptions` → send email/Slack → record `alert_deliveries`.

**Setup:**

1. **Cron:** Call the poll endpoint every ~15 seconds (e.g. Vercel Cron or external cron):
   - `GET` or `POST` `/api/cron/alerts-poll`
   - Optional: set `CRON_SECRET` in env and send `Authorization: Bearer <CRON_SECRET>`.

2. **Subscriptions:** Create rows in `alert_subscriptions` (per org, optional per safe, by `eventType`, channel `email` or `slack`, `channelConfig`: `{ email }` or `{ webhookUrl }`). Example seed:
   ```bash
   npx tsx scripts/seed-alert-subscriptions.ts <orgId>
   ```
   Set `ALERT_EMAIL` or `ADMIN_EMAIL`, and optionally `SLACK_WEBHOOK_URL` in `.env`.

3. **Env (optional):** `ALERT_POLL_INTERVAL_MS`, `CRON_SECRET`, `SLACK_WEBHOOK_URL`. Email uses existing `RESEND_API_KEY` and `EMAIL_FROM`.

**Event types:** `SIGNER_ADD_PROPOSED`, `SIGNER_REMOVE_PROPOSED`, `THRESHOLD_CHANGE_PROPOSED`, `SIGNER_SWAP_PROPOSED`, `ERC20_TRANSFER_PROPOSED`, `ERC20_APPROVAL_PROPOSED`, `ERC20_TRANSFER_FROM_PROPOSED`, `ETH_TRANSFER_PROPOSED`, `CONTRACT_CALL_PROPOSED`.

## Project structure

- `src/app` – Next.js App Router (pages, API routes, layouts)
- `src/components` – Shared UI (nav, providers)
- `src/lib` – DB schema, auth, Safe API client, audit, utils
- `docs/` – Deployment notes ([docs/DEPLOYMENT.md](docs/DEPLOYMENT.md))
- [src/lib/db/README.md](src/lib/db/README.md) – Database layer (schema, repositories)

## Production

The app uses **PostgreSQL**. Recommended providers:

- **Neon** – serverless Postgres with free tier, excellent for Next.js
- **Supabase** – managed Postgres with free tier
- **Railway** – easy deployment with managed Postgres
- **Render** – managed Postgres with free tier
- **Vercel Postgres** – if deploying on Vercel

Set `DATABASE_URL` to your provider's connection string. For a quick sync you can use `npm run db:push`; for production releases, prefer **`npm run db:generate`** then **`npm run db:migrate`** so schema changes are versioned.

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for hosting, env vars, migrations, and cron.

## Safe networks

Supported networks (Safe API): Ethereum, Base, Arbitrum, Polygon, OP Mainnet, Gnosis Chain, Avalanche, BSC, Sepolia. Add more in `src/lib/safe-api.ts` (`SAFE_CHAINS` and `getBaseUrl`).

## License

MIT License — Copyright (c) 2026 SRDA Labs (Security Research and Defence Advisory). See [LICENSE](LICENSE) for the full terms.

## About SRDA Labs

Convixa is built and maintained by **SRDA Labs** (Security Research and Defence Advisory). SRDA does not hold client key material or operate production systems on a client's behalf — and neither does Convixa: it never custodies keys and never executes transactions.

- Issues and feature requests: https://github.com/SRDA-Labs/convixa/issues
- Contact: hello@srdalabs.com
