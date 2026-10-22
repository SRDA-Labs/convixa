# Deployment guide

High-level notes for running Convixa outside local development. For Docker-based setups, see [DOCKER.md](../DOCKER.md). For product and architecture context, see [PROJECT_PROGRESS.md](../PROJECT_PROGRESS.md).

## Prerequisites

- **Node.js 20** (matches the [Dockerfile](../Dockerfile) base image).
- **PostgreSQL** (managed Neon, Supabase, Railway, Render, Vercel Postgres, or self-hosted).
- **Environment variables:** Copy [.env.example](../.env.example) (local dev) or [.env.example.docker](../.env.example.docker) (Docker / `deploy.sh`) to `.env` on the server. Required for all deployments: `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `APP_URL`. See [Environment variables](#environment-variables) below. Full list and comments: `.env.example`.

## Database: push vs migrations

- **Development:** `npm run db:push` can sync schema quickly (may prompt interactively if the DB diverges).
- **Production:** Use versioned migrations:
  1. `npm run db:generate` — writes SQL under [drizzle/](../drizzle/) after schema changes.
  2. `npm run db:migrate` — applies pending migrations.

The OSS baseline is a **single squashed migration** (`drizzle/0000_oss_baseline.sql`). Fresh installs: empty Postgres → `npm run db:migrate`.

**Upgrading from pre-OSS Convixa:** The old multi-file migration chain is gone. Reset the database (backup first if needed), then migrate:

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO public;
```

Then `npm run db:migrate`. Docker: `npm run docker:full:clean` wipes the volume, then `npm run docker:full`.

The Docker full-stack entrypoint runs `npx drizzle-kit migrate` before starting the app ([docker-compose.yml](../docker-compose.yml)). Commit `drizzle/meta/` with migration SQL.

## Hosting the Next.js app

Typical pattern: deploy the Next.js app to **Vercel**, **Railway**, **Render**, or any Node-friendly platform, and point `DATABASE_URL` at managed Postgres.

- Set **`NEXTAUTH_URL`** to your public origin (e.g. `https://app.example.com`). OAuth and redirects depend on this.
- Set **`APP_URL`** (and if needed **`NEXT_PUBLIC_APP_BASE_URL`**) for correct logout, invite links, or tunnel testing—see comments in `.env.example`.
- If you use **Google OAuth**, add your production callback URL: `{NEXTAUTH_URL}/api/auth/callback/google`.

Build command: `npm run build` (or your package manager equivalent). Start: `npm run start` (after build). The [Dockerfile](../Dockerfile) uses Next.js **standalone** output for container images.

## Environment variables

Put these in the server `.env` used by `deploy.sh` (see [.env.example.docker](../.env.example.docker)). Keep [.env.example](../.env.example) in sync for local dev.

### Required

| Variable | Docker / `deploy.sh` value | Notes |
|----------|----------------------------|-------|
| `DATABASE_URL` | `postgresql://convixa:convixa_password@postgres:5432/convixa` | App runs **inside** Docker — use hostname `postgres`, not `localhost` |
| `NEXTAUTH_SECRET` | Strong random string | Generate: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://yourdomain.com` | Public origin; required for auth redirects |
| `APP_URL` | `https://yourdomain.com` | Used for invite links and auth redirects |

### Optional (recommended)

| Variable | Purpose if unset |
|----------|------------------|
| `RESEND_API_KEY` | No 2FA OTP emails |
| `EMAIL_FROM` | Defaults to `Convixa <onboarding@resend.dev>` |
| `CRON_SECRET` | Alerts cron endpoint is unprotected |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth sign-in disabled |

**First user:** After deploy, register at your public URL — the first account becomes **org owner** with full administrative access. There is no separate platform admin console.

## Background jobs and alerting

Proposal-time alerting uses a **cron** or scheduler to call:

- `GET` or `POST` `/api/cron/alerts-poll` on an interval (e.g. every ~15 seconds).

Optional: set `CRON_SECRET` and send `Authorization: Bearer <CRON_SECRET>`. Event types and subscription behavior are documented in the **Alerting** section of the [README](../README.md).

## Docker

To run Postgres + the app in containers locally or on a VM, use [DOCKER.md](../DOCKER.md) and `npm run docker:full`.

## Zero-downtime deployments (`deploy.sh`)

For production VMs running the full Docker stack, use [`deploy.sh`](../deploy.sh) instead of `docker compose up --build`. It implements a **blue-green swap** via Caddy:

1. Builds a new Docker image.
2. Runs database migrations as a one-shot container (before the new app starts).
3. Starts the new app container (`convixa-app-blue` or `convixa-app-green`) on a temporary localhost port.
4. Health-checks `GET /api/health` up to 20 times (5 s apart, 100 s total). On failure: tears down the new container and exits non-zero — old container keeps serving.
5. Rewrites `Caddyfile` to point at the new container name and runs `caddy reload` (graceful, no dropped connections).
6. Removes the old container.

**Usage:**
```bash
# On the production server, from the repo root
./deploy.sh
```

**Requirements:** `.env` must exist in the repo root with all [required env vars](#environment-variables). The script handles Postgres, Caddy, migrations, and the blue-green swap automatically.

**What the script manages automatically:**
- Starts `convixa-postgres` via `docker compose` if it isn't running, then waits for it to be healthy (up to 100 s).
- Starts `convixa-caddy` via `docker compose --no-deps` if it isn't running.
- Builds the new image, runs migrations, starts the new app container, health-checks it, swaps Caddy, and removes the old container.

**Container naming:** After the first `deploy.sh` run, the app container will be named `convixa-app-blue` or `convixa-app-green` (alternating per deploy) instead of the initial `convixa-app`. The Caddyfile will reflect whichever is active.

## Cron jobs

| Endpoint | Interval | Purpose |
|----------|----------|---------|
| `GET /api/cron/alerts-poll` | ~15s | Alert polling, policy enforcement, snapshot refresh side effects |
| `GET /api/cron/signer-activity-poll` | Daily (recommended) | EOA activity cache for signer roster addresses |

Secure with `Authorization: Bearer $CRON_SECRET` when `CRON_SECRET` is set. Signer activity polling requires `ETHERSCAN_API_KEY` (Etherscan-family explorers).

## Health endpoint

`GET /api/health` — returns `{"status":"ok"}` (HTTP 200) when the app and database are reachable, or `{"status":"error"}` (HTTP 503) when the DB connection fails. Used by `deploy.sh` to verify a new container is ready before traffic is switched.

## Troubleshooting: missing columns / drift

If app logs show `PostgresError: column … does not exist` (for example `safes.is_active`), the Postgres volume is behind committed migrations:

1. **Preferred:** Run pending migrations once from the repo root (same `.env` and network as prod):

   ```bash
   docker run --rm \
     --network convixa-network \
     --env-file .env \
     --entrypoint /bin/sh \
     convixa-app:latest \
     -c "npx drizzle-kit migrate && echo Migrations OK"
   ```

   Use whichever image tag matches your last deploy (`convixa-app:latest` or `convixa-app-blue` / `convixa-app-green` from `docker images`).

2. **Then** confirm: `docker logs convixa-app-blue` / `-green` shows no recurrence when hitting affected routes.

3. Ensure `.env` has `DATABASE_URL` pointing at the **same Postgres** instance the app containers use (`host` should resolve on `convixa-network`, usually the `postgres` service hostname from compose).

Never apply app code migrations out of band without running `drizzle-kit migrate` — or Postgres and the codebase will drift.

**Interpreting filtered app logs:** Commands like `docker logs … | rg -i 'wallet|reown|403|error'` often surface **Postgres** failures (e.g. `column … does not exist`) before or instead of anything wallet-related. Fix schema drift first (migrations above). Real WalletConnect/Reown problems are usually in the **browser** (Console / Network); they may not appear in `docker logs` at all unless something runs on the server during SSR.
