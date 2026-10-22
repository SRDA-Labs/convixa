# Docker setup

Convixa supports two modes: **full stack** (PostgreSQL + app in containers) and **dev DB only** (Postgres in Docker, Next.js on the host for hot reload). First-time env setup is described in the [README Setup](README.md#setup) section—copy `.env.example` or `.env.example.docker` to `.env` as appropriate.

## Ports and URLs

| Mode | App URL | Postgres (host) |
| --- | --- | --- |
| Full stack | `http://localhost:3000` | `localhost:5432` |
| Dev DB + local `npm run dev` | `http://localhost:3001` | `localhost:5432` |

In **full stack**, `docker-compose.yml` sets `NEXTAUTH_URL` and `APP_URL` to `http://localhost:3000` for the app container. In **dev**, use `.env.example` with `NEXTAUTH_URL=http://localhost:3001` and `DATABASE_URL=postgresql://convixa:convixa_password@localhost:5432/convixa`.

## Full stack (`docker:full`)

- **Compose:** [docker-compose.yml](docker-compose.yml) — `postgres` (Postgres 16) + `app` (image built from [Dockerfile](Dockerfile)).
- **Build:** The `deps` stage installs `python3`, `make`, and `g++` on Alpine so `npm ci` can compile optional native modules (e.g. `bufferutil` via node-gyp). Without them, `docker compose build` fails at `RUN npm ci`. Both `deps` and `migration-deps` use BuildKit `--mount=type=cache` on `/root/.npm` so npm tarballs are reused across builds even when `package.json` changes (avoids the ~360 s cold-download penalty on every dep change).
- **App port:** `3000:3000`.
- **Database:** User `convixa`, password `convixa_password`, database `convixa`. Volume: `postgres_data`.
- **Startup:** The `app` service waits for Postgres to be healthy, then runs `npx drizzle-kit migrate` (must succeed—the container exits if migrations fail), then starts `node server.js` (Next.js standalone output). The image includes `node_modules` from the build so `drizzle-kit` can load `drizzle.config.ts` and apply SQL from `drizzle/` plus `drizzle/meta/_journal.json`.

**Required in `.env` for compose:** at minimum set a strong `NEXTAUTH_SECRET` (see `.env.example.docker`). Optional: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (Google sign-in; must be present in `.env` so compose can inject them—see troubleshooting), `ADMIN_*`, `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, `RESEND_API_KEY`, `EMAIL_FROM`.

After the stack is up, open the app and register — the first user becomes org owner with full admin access.

## Dev database only (`docker:dev`)

- **Compose:** [docker-compose.dev.yml](docker-compose.dev.yml) — Postgres only. Container name: `convixa-postgres-dev`. Volume: `postgres_dev_data`.
- Run `npm run db:push` or migrations from the host, then `npm run dev` (port **3001**).

## npm scripts

| Script | What it runs |
| --- | --- |
| `npm run docker:full` | `docker compose up --build` |
| `npm run docker:full:down` | `docker compose down` |
| `npm run docker:full:clean` | `docker compose down -v` |
| `npm run docker:dev` | `docker compose -f docker-compose.dev.yml up -d` |
| `npm run docker:dev:down` | `docker compose -f docker-compose.dev.yml down` |
| `npm run docker:dev:clean` | `docker compose -f docker-compose.dev.yml down -v` |
| `npm run docker:logs` | `docker compose logs -f` |
| `npm run docker:logs:dev` | `docker compose -f docker-compose.dev.yml logs -f` |

You can use `pnpm` or `yarn` instead of `npm` if you prefer; the repo ships a `package-lock.json` and the [Dockerfile](Dockerfile) uses `npm ci`.

## Environment templates

- **[.env.example](.env.example)** — local dev or dev-DB-only Docker (app on host, port 3001).
- **[.env.example.docker](.env.example.docker)** — reference for full-stack mode (app in Docker, port 3000). Copy to `.env` before `docker:full` and set secrets.

## Production deployments (blue-green)

For zero-downtime updates on a production server, use [`deploy.sh`](deploy.sh) instead of `docker compose up --build`. It alternates between `convixa-app-blue` and `convixa-app-green` containers, health-checks before swapping Caddy, and removes the old container only after traffic is confirmed routed to the new one. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full details, including **production `.env`** (`DATABASE_URL=@postgres:5432`, auth secrets, optional alerting cron).

`deploy.sh` is self-contained: it starts Postgres and Caddy automatically if they are not running, so no manual `docker:full` is needed before the first deploy. After the first `deploy.sh` run, the app container is named `convixa-app-blue` or `convixa-app-green` (no longer `convixa-app`).

## Troubleshooting

- **Port 5432 already in use:** Something on your machine is already bound to `localhost:5432` (common: local PostgreSQL, or another container such as `convixa-postgres-dev` from `docker:dev`). **Fix options:** (1) Stop the other service—for example `docker compose -f docker-compose.dev.yml down` if the dev DB is running. (2) Or set **`POSTGRES_PUBLISH_PORT=5433`** in `.env` before `docker:full` so this stack publishes Postgres on **5433** on the host (the app container still uses `postgres:5432` internally; no change to `DATABASE_URL` in compose).
- **Port 3000 in use:** Stop the other process or adjust the `app` ports in `docker-compose.yml`.
- **`NEXTAUTH_SECRET` too weak / missing:** Generate with `openssl rand -base64 32` and set in `.env` for compose variable substitution where applicable.
- **`DATABASE_URL`:** Inside the full-stack app container it must point at the `postgres` service hostname (already set in compose). On the host with `docker:dev`, use `localhost:5432`.
- **“Sign in with Google” does nothing / no logs:** Full-stack compose sets `NEXTAUTH_URL` to port **3000**, but Google OAuth is only enabled when **both** `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in your project `.env` (compose passes them into the container). Without them, the Google provider is not registered and the button cannot complete sign-in; production Next.js also rarely prints per-request logs. **Fix:** Add both variables to `.env`, add redirect URI `http://localhost:3000/api/auth/callback/google` in [Google Cloud credentials](https://console.cloud.google.com/apis/credentials) (Web application), then `docker compose up -d --build` (or recreate the `app` service).
- **App exits during “Running database migrations…” / `relation "…" does not exist`:** Migrations did not apply. Confirm the image was rebuilt after Dockerfile changes, `drizzle/meta/` is present in the repo, and `DATABASE_URL` in compose points at `postgres:5432`. For a dirty DB volume from an old failed state, run `npm run docker:full:clean` (removes volumes) or apply migrations manually: `DATABASE_URL=postgresql://convixa:convixa_password@localhost:5432/convixa npm run db:migrate` from the project root with `node_modules` installed.
