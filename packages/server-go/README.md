# Datacenter Tycoon — Go server

Go port of [`packages/server`](../server) (TypeScript, Bun + Elysia). It exposes the same HTTP endpoints, so the web client only needs a different base URL to talk to it.

Game rules are not reimplemented in Go. `game-logic` stays TypeScript and is bundled into `jsbridge/bundle.js`, which is embedded into the binary and executed with [goja](https://github.com/dop251/goja). See `AGENTS.md` for the rules.

## Layout

```
packages/server-go/
├── cmd/
│   ├── server/            # HTTP server (net/http)
│   ├── migrate/           # Applies SQL migrations to DATABASE_URL (Railway pre-deploy)
│   └── check-migrations/  # Validates embedded migrations
├── internal/
│   ├── config/            # Env parsing, mirrors packages/server/src/config.ts
│   ├── httpserver/        # Routes, JSON/error envelopes, CORS, rate limits
│   ├── players/           # Username rules and repositories (in-memory, pgx)
│   ├── leaderboard/       # Verified-run replay, heads, queries (in-memory, pgx)
│   ├── ratelimit/         # Fixed-window limiter
│   └── db/                # pgx pool, migrator, workflow
├── jsbridge/              # game-logic bundle (bundle.js, committed) + goja runtime
├── migrations/            # SQL shared with packages/server (embedded)
├── scripts/build-bundle.sh
├── Dockerfile             # Build context = repo root
└── railway.toml           # Railway config-as-code for the separate Go service
```

## Endpoints

Same as the TS server:

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/healthz` | Liveness plus runtime/database metadata |
| GET | `/version` | Server and game-logic versions |
| GET | `/players/availability?username=` | Username check |
| POST | `/players` | Register a username (201) |
| GET | `/leaderboard` | Ranked verified entries |
| POST | `/leaderboard/runs` | Submit a verified run checkpoint (201, or 200 on exact retry) |

## Commands

Run from `packages/server-go` unless noted.

```bash
go vet ./...
go test ./...                       # Postgres-backed tests need TEST_DATABASE_URL, else they skip
go run ./cmd/server                 # PORT defaults to 3000; in-memory unless DATABASE_URL is set
go run ./cmd/migrate                # needs DATABASE_URL
go run ./cmd/check-migrations
bash scripts/build-bundle.sh        # rebuild jsbridge/bundle.js (needs root `npm ci` for esbuild)
```

Black-box contract tests (TS suite, run against a running Go server; from the repo root):

```bash
npm ci
npm run build -w @datacenter-tycoon/game-logic
# start the server in-memory with the CI env below, then:
SERVER_BASE_URL=http://127.0.0.1:3000 npm run test:blackbox -w @datacenter-tycoon/server
```

The CI env that the suite expects (see the `go` job in `.github/workflows/pr-tests.yml`):

```bash
NODE_ENV=test SERVER_VERSION=9.9.9-test CORS_ALLOWED_ORIGINS=http://localhost:5173 \
BACKEND_RATE_LIMIT_MAX_REQUESTS=100000 PLAYER_REGISTRATION_RATE_LIMIT_MAX_REQUESTS=100000 \
LEADERBOARD_SUBMISSION_RATE_LIMIT_MAX_REQUESTS=100000 ./server
```

Docker (from the repo root, not from this directory):

```bash
docker build -f packages/server-go/Dockerfile -t dct-server-go .
```

The image contains `/app/server` (the default command) and `/app/migrate`.

## Environment variables

Names and defaults match `packages/server/src/config.ts` and `packages/server/.env.example`.

| Variable | Default | Notes |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `test`, or `production` |
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `3000` | 1–65535 |
| `CORS_ALLOWED_ORIGINS` | dev: `http://localhost:5173` | Comma-separated. Required in production. `https://dctycoon.arnav.tech` is always added in production. |
| `DATABASE_URL` | unset | Postgres. Unset means in-memory (no persistence). Required when `NODE_ENV=production`. |
| `SERVER_VERSION` | `npm_package_version` or `0.1.0` | Reported by `/version` and `/healthz` |
| `BACKEND_RATE_LIMIT_WINDOW_MS` / `_MAX_REQUESTS` | `1000` / `10` | Global throttle, all routes |
| `PLAYER_REGISTRATION_RATE_LIMIT_WINDOW_MS` / `_MAX_REQUESTS` | `60000` / `10` | `POST /players` |
| `LEADERBOARD_SUBMISSION_RATE_LIMIT_WINDOW_MS` / `_MAX_REQUESTS` | `1000` / `1` | `POST /leaderboard/runs` |
| `LEADERBOARD_VERIFICATION_PROTOCOL_VERSION` | `verified-run-v1` | |
| `LEADERBOARD_VERIFICATION_RULESET_ID` | `leaderboard-ruleset-v1` | |
| `LEADERBOARD_VERIFICATION_MAX_TICK_DELTA` | `15` | |
| `LEADERBOARD_VERIFICATION_MAX_ACTION_COUNT` | `1024` | |
| `LEADERBOARD_VERIFICATION_MAX_REQUEST_BODY_BYTES` | `262144` | |
| `TEST_DATABASE_URL` | unset | Go tests only: Postgres admin URL |

Not supported in Go: `PGLITE_DATA_DIR`. The Go server has no PGlite fallback. Development uses in-memory mode or a local Postgres through `DATABASE_URL`.

Metadata differs by design. `/healthz` reports `runtime: "go"`, `framework: "net/http"`, `databaseMode: "memory"` or `"postgres"`, and `databaseProvider: "memory"` or `"pgx"`. The TS server reports `bun`, `elysia`, and `pglite-*`/`bun-sql`. The field shape is the same.

## Railway deployment

The Go server is a **separate Railway service** from the TS server, with its own domain.

- Root `railway.toml` belongs to the TS service and is not changed.
- For the Go service, set **Settings → Config as code** to `packages/server-go/railway.toml`.
- Build uses the Dockerfile at `packages/server-go/Dockerfile` with the repo root as the build context.
- Pre-deploy runs `/app/migrate`, start runs `/app/server`, and the health check is `GET /healthz`.
- Set `NODE_ENV=production`, `DATABASE_URL`, and `CORS_ALLOWED_ORIGINS` on the Go service.
- Use a **separate database by default**, not the TS service's database. Both services run the same baseline migrations, but the two schemas are not shared unless you point `DATABASE_URL` at the same database on purpose.
- The endpoints are identical, so the web client switches servers by changing its API base URL.

## Live v2 deployment

- Railway service `dctycoon-api-v2` (project `datacenter-tycoon`, production): https://dctycoon-api-v2-production.up.railway.app
- It shares the existing `Postgres` service with the TS `dctycoon-api` (`DATABASE_URL=${{Postgres.DATABASE_URL}}`). Both servers use the same `schema_migrations` table, so either can migrate it.
- Build uses `RAILWAY_DOCKERFILE_PATH=packages/server-go/Dockerfile`. Deploy from the CLI with a staged directory containing `packages/server-go/` and its `railway.toml` at the root (so the TS root `railway.toml` isn't applied), or set the service's config-as-code path to `packages/server-go/railway.toml` in the dashboard to get the `/app/migrate` pre-deploy step and healthcheck.
- The web client picks its backend via `BACKEND_API_URL` in `packages/web/src/online/backend.ts` (`BACKEND_API_URLS.v2` = Go (default); `.v1` = deprecated TS).

## Railway deployment (Infrastructure as Code)

The API service is defined in `.railway/railway.ts` (`dctycoon-api-v2` = this Go server, the default API; the legacy TS `dctycoon-api` is no longer deployed). It deploys from GitHub `main`
with its own Dockerfile, watch paths, pre-deploy migration, start command and healthcheck, and uses the `Postgres` service
(same `schema_migrations` table). Changes to `.railway/**` are planned on PRs and applied on merge by `.github/workflows/railway-iac.yml`
(needs a `RAILWAY_TOKEN` project token secret); locally use `railway config plan` / `railway config apply`.

- v2: https://dctycoon-api-v2-production.up.railway.app
- The web client picks its backend via `BACKEND_API_URL` in `packages/web/src/online/backend.ts`.
