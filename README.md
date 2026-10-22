<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/srda-logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="docs/assets/srda-logo-light.svg">
  <img src="docs/assets/srda-logo-light.svg" alt="SRDA Labs" width="86">
</picture>

# Convixa

**Self-hosted inventory and governance for [Safe](https://safe.global) multisigs.**

Teams, RBAC, alerts, pre-sign checklists and SEAL-aligned security workflows —<br>
running on your own infrastructure.

[![License: MIT](https://img.shields.io/badge/License-MIT-e85c5f.svg?style=flat-square)](LICENSE)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-292c31.svg?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-292c31.svg?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Drizzle-292c31.svg?style=flat-square&logo=postgresql&logoColor=white)](https://orm.drizzle.team)
[![Built by SRDA Labs](https://img.shields.io/badge/built%20by-SRDA%20Labs-e85c5f.svg?style=flat-square)](https://github.com/SRDA-Labs)

[Quick start](#quick-start) · [Features](#features) · [Alerting](#alerting) · [Deployment](docs/DEPLOYMENT.md) · [SEAL compliance](docs/SEAL_COMPLIANCE.md)

<img src="public/convixa-dashboard-screenshot.png" alt="Convixa inventory view" width="760">

</div>

---

> [!IMPORTANT]
> **Convixa never custodies keys and never executes transactions.** Connected wallets can *propose* owner-change Safe transactions (add / remove / rotate signer) from **Inventory → Transactions**; execution still happens in Safe{Wallet}.

> **Scope:** Convixa is released as open source by SRDA Labs under the MIT License. It is structured around [SEAL Secure Multisig Best Practices](https://frameworks.securityalliance.org/wallet-security/secure-multisig-best-practices/) but is **not affiliated with or endorsed by** Security Alliance.

## Quick start

The fastest path is the full Docker stack — Postgres and the app, one command.

```bash
cp .env.example.docker .env     # then set NEXTAUTH_SECRET: openssl rand -base64 32
npm run docker:full             # first start runs Drizzle migrations automatically
```

Open **http://localhost:3000** and register. **The first user to register becomes org owner** with full administrative access.

<details>
<summary><b>Other ways to run it</b> — hybrid dev mode, or a fully manual setup</summary>

<br>

> **Env convention:** The single active config file is `.env` (gitignored — never commit it). Templates are committed for reference:
> - `.env.example` → for local dev / Docker dev mode
> - `.env.example.docker` → for full Docker stack mode
>
> Copy the right template to `.env` and fill in the required values before running.

### Development mode — Postgres in Docker, app local with hot reload

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

For the full Docker stack, optionally set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to enable "Sign in with Google" — compose passes them into the app, and the redirect URI must include `http://localhost:3000/api/auth/callback/google`.

See **[DOCKER.md](DOCKER.md)** for the comprehensive Docker guide and troubleshooting.

### Manual setup

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

</details>

## Features

| | |
|---|---|
| **Org & teams** | Create an org, create teams (e.g. Finance, Ops), assign team leads. |
| **Inventory** | Add Safe addresses by network (Ethereum, Base, Arbitrum, etc.) with optional name and notes. Inventory → Transactions includes a **Propose transaction** wizard for add/remove/rotate signer across selected Safes. |
| **Safe data** | Fetches threshold, signers, pending count and last activity from the [Safe Transaction Service API](https://docs.safe.global/core-api/transaction-service-overview). On-demand refresh, cached in DB. |
| **Export** | CSV export of inventory — address, network, name, team, threshold, signers and more. |
| **Audit log** | Logs who added or removed Safes, and team changes. |
| **SEAL-aligned governance** | Configuration health monitoring, compliance scorecards, signer roster & affiliation verification, pre-sign checklists, OOB verification cases, incident reporting, readiness drills, advanced governance (timelocks, testnet twins, policy gaps), certification export pack, module/guard inventory, signer overlap reports and EOA activity watch. |

Set `SAFE_API_KEY` in `.env` for authenticated Safe API access — recommended for production and tunnel testing to avoid rate limits ([how to use API keys](https://docs.safe.global/core-api/how-to-use-api-keys)).

**SEAL details:** [docs/SEAL_COMPLIANCE.md](docs/SEAL_COMPLIANCE.md) · **Manual test checklist:** [docs/SEAL_MANUAL_TEST_CHECKLIST.md](docs/SEAL_MANUAL_TEST_CHECKLIST.md)

## Stack

- **Next.js 15** (App Router), TypeScript, Tailwind CSS
- **PostgreSQL** + **Drizzle ORM** — production-ready database
- **NextAuth** — email/password (Credentials) and **optional Google sign-in** when `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are set
- **Wallets (optional)** — RainbowKit + WalletConnect for connect flows; optional [Ledger Wallet Provider](https://developers.ledger.com/docs/ledger-wallet-provider/overview) (`NEXT_PUBLIC_LEDGER_WALLET_PROVIDER_API_KEY`) for direct USB/BT Ledger; SIWE-backed link-wallet APIs under `src/app/api/profile/` and settings UI
- **Safe API** — inventory/alerts read path, plus optional in-app **propose** of owner-change txs via Protocol Kit (user wallet signs; service relay with `SAFE_API_KEY`)

Commands use `npm run …`; the repo includes `package-lock.json` (`npm ci` in Docker). You can use **pnpm** or **yarn** locally if you prefer.

## Admin & access control

Convixa is **self-hosted**: there is no platform operator console. The **first registered user** becomes **org owner** with full administrative access. Owners and admins can:

- Invite members and assign **custom roles** with granular permissions (`/dashboard/teams` → Roles)
- Manage teams, safes, alerts, policies and org settings

## Alerting

*Level 1 — proposal-time.*

The app can poll the Safe Transaction Service for **pending** (not executed) multisig transactions, classify them (governance, ERC20, ETH transfer, contract call), and send **email** and **Slack** notifications. Idempotent: no duplicate alerts for the same transaction.

**Flow:** Poll all safes → fetch pending txs → insert `raw_transactions` → classify → insert `normalized_events` → find `alert_subscriptions` → send email/Slack → record `alert_deliveries`.

<details>
<summary><b>Setting up alerts</b></summary>

<br>

1. **Cron:** Call the poll endpoint every ~15 seconds (e.g. Vercel Cron or external cron):
   - `GET` or `POST` `/api/cron/alerts-poll`
   - Optional: set `CRON_SECRET` in env and send `Authorization: Bearer <CRON_SECRET>`.

2. **Subscriptions:** Create rows in `alert_subscriptions` (per org, optional per safe, by `eventType`, channel `email` or `slack`, `channelConfig`: `{ email }` or `{ webhookUrl }`). Example seed:
   ```bash
   npx tsx scripts/seed-alert-subscriptions.ts <orgId>
   ```
   Set `ALERT_EMAIL` or `ADMIN_EMAIL`, and optionally `SLACK_WEBHOOK_URL` in `.env`.

3. **Env (optional):** `ALERT_POLL_INTERVAL_MS`, `CRON_SECRET`, `SLACK_WEBHOOK_URL`. Email uses existing `RESEND_API_KEY` and `EMAIL_FROM`.

</details>

**Event types:** `SIGNER_ADD_PROPOSED`, `SIGNER_REMOVE_PROPOSED`, `THRESHOLD_CHANGE_PROPOSED`, `SIGNER_SWAP_PROPOSED`, `ERC20_TRANSFER_PROPOSED`, `ERC20_APPROVAL_PROPOSED`, `ERC20_TRANSFER_FROM_PROPOSED`, `ETH_TRANSFER_PROPOSED`, `CONTRACT_CALL_PROPOSED`.

## Scripts

<details>
<summary><b>All npm scripts</b> — development, database, Docker, alerting</summary>

<br>

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

</details>

## Project structure

```
src/app          Next.js App Router — pages, API routes, layouts
src/components   Shared UI — nav, providers
src/lib          DB schema, auth, Safe API client, audit, utils
docs/            Deployment notes and SEAL compliance docs
```

See [src/lib/db/README.md](src/lib/db/README.md) for the database layer (schema, repositories).

## Production

The app uses **PostgreSQL**. Recommended providers: **Neon** (serverless, free tier, excellent for Next.js), **Supabase**, **Railway**, **Render**, or **Vercel Postgres** if deploying on Vercel.

Set `DATABASE_URL` to your provider's connection string. For a quick sync you can use `npm run db:push`; for production releases, prefer **`npm run db:generate`** then **`npm run db:migrate`** so schema changes are versioned.

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for hosting, env vars, migrations and cron.

## Safe networks

Ethereum · Base · Arbitrum · Polygon · OP Mainnet · Gnosis Chain · Avalanche · BSC · Sepolia

Add more in `src/lib/safe-api.ts` (`SAFE_CHAINS` and `getBaseUrl`).

## License

MIT License — Copyright (c) 2026 SRDA Labs (Security Research and Defence Advisory). See [LICENSE](LICENSE) for the full terms.

---

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/srda-logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="docs/assets/srda-logo-light.svg">
  <img src="docs/assets/srda-logo-light.svg" alt="SRDA Labs" width="48">
</picture>

**Built and maintained by [SRDA Labs](https://github.com/SRDA-Labs)**<br>
<sub>Security Research and Defence Advisory</sub>

SRDA does not hold client key material or operate production systems on a client's behalf —<br>
and neither does Convixa: it never custodies keys and never executes transactions.

[Issues](https://github.com/SRDA-Labs/convixa/issues) · [hello@srdalabs.com](mailto:hello@srdalabs.com)

</div>
