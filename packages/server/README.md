# @datacenter-tycoon/server

Backend service for Datacenter Tycoon leaderboards and lightweight player registration.

## Current scope

- `GET /healthz`
- `GET /version`
- `GET /players/availability?username=...`
- `POST /players`
- `GET /leaderboard?metric=...&period=all-time&limit=...`
- `POST /leaderboard/runs`

## Local development

### Quickstart

```bash
npm install
bun --version
cp packages/server/.env.example packages/server/.env.local
npm run migrate -w @datacenter-tycoon/server
npm run dev:server
```

The monorepo entrypoint remains `npm`, but the server workspace now executes its runtime scripts with **Bun** internally (`npm run dev:server` → `packages/server` → `bun run --watch src/index.ts`). Build and typecheck still use TypeScript directly during this migration phase.

The server can also be verified locally with:

```bash
npm run check:migrations:server
npm run ci:server
```

### Environment variables

Copy `packages/server/.env.example` into your own local env file or export the values directly before starting the server.

| Variable | Required | Purpose |
| --- | --- | --- |
| `HOST` | local only | Bind host for the Bun-started server process. Defaults to `0.0.0.0`. |
| `PORT` | yes in production | Listening port. Railway injects this automatically. |
| `CORS_ALLOWED_ORIGINS` | yes in production | Comma-separated list of allowed web origins. |
| `SERVER_VERSION` | optional | Overrides the version returned by `GET /version`. |
| `DATABASE_URL` | required in production, optional in local dev | Postgres connection string. When omitted outside production, the server falls back to PGlite. |
| `PGLITE_DATA_DIR` | optional outside production | File-backed PGlite data directory. Defaults to `.data/pglite` in development. |
| `BACKEND_RATE_LIMIT_WINDOW_MS` | optional | Window size for backend-wide request throttling. Defaults to `1000`. |
| `BACKEND_RATE_LIMIT_MAX_REQUESTS` | optional | Max requests across the whole backend within the window. Defaults to `10`. |
| `PLAYER_REGISTRATION_RATE_LIMIT_WINDOW_MS` | optional | Window size for registration throttling. |
| `PLAYER_REGISTRATION_RATE_LIMIT_MAX_REQUESTS` | optional | Max registration attempts per client within the window. |
| `LEADERBOARD_SUBMISSION_RATE_LIMIT_WINDOW_MS` | optional | Window size for leaderboard submission throttling. Defaults to `1000`. |
| `LEADERBOARD_SUBMISSION_RATE_LIMIT_MAX_REQUESTS` | optional | Max leaderboard submissions per client IP within the window. Defaults to `1`. |

## Postgres provisioning

### Local PGlite default

Local development now defaults to **file-backed PGlite** and does not require a separate Postgres daemon. The same provider resolution now drives both `npm run migrate -w @datacenter-tycoon/server` and `npm run dev:server`:

```bash
cp packages/server/.env.example packages/server/.env.local
npm run migrate -w @datacenter-tycoon/server
npm run dev:server
# or: npm run dev:online    # launch the server and Vite web app together from the repo root
```

The database files live under `packages/server/.data/pglite` by default and persist across restarts. `GET /healthz` reports the resolved `databaseMode`, `databaseProvider`, and whether the runtime has a configured on-disk/external database target so local-vs-production behavior is visible without reading startup logs.

### Local Postgres override

If you want production-like local behavior, point `DATABASE_URL` at any Postgres 15+ instance:

```bash
createdb datacenter_tycoon
DATABASE_URL=postgres://localhost:5432/datacenter_tycoon npm run migrate -w @datacenter-tycoon/server
DATABASE_URL=postgres://localhost:5432/datacenter_tycoon npm run dev:server
```

### Railway deployment

This repository includes a checked-in root [`railway.toml`](../../railway.toml) and [`Dockerfile`](../../Dockerfile) for deploying the backend from the monorepo. Railway uses the Dockerfile builder, installs/builds only the workspaces needed by the API (`@datacenter-tycoon/game-logic` and `@datacenter-tycoon/server`), runs migrations with `bun` as a pre-deploy command, starts the compiled Bun/Elysia server with `bun`, and healthchecks `GET /healthz`.

The Docker build context intentionally remains the repository root because the server depends on the workspace package `@datacenter-tycoon/game-logic` and the root lockfile. The final container target is still only the server: `railway.toml` starts `packages/server/dist/index.js` via Bun.

Create or link the Railway project and services from the repository root:

```bash
# If this repo is not linked yet, create the Railway project and production environment link.
railway init --name datacenter-tycoon --json
# Or, for an existing project:
# railway link --project <project-id-or-name> --environment production --json

# Create the API service and database service.
railway add --service dctycoon-api --json
railway add --database postgres --json

# Confirm both services exist before configuring variables.
railway service list --json
```

Configure the API service variables before the first production deploy:

```bash
railway variable set --service dctycoon-api NODE_ENV=production
railway variable set --service dctycoon-api 'DATABASE_URL=${{Postgres.DATABASE_URL}}'
railway variable set --service dctycoon-api 'CORS_ALLOWED_ORIGINS=https://dctycoon.arnav.tech,https://dctycoon-api-production.up.railway.app'
```

Use the Railway Postgres service's private `DATABASE_URL` reference (`${{Postgres.DATABASE_URL}}`, or `${{<postgres-service-name>.DATABASE_URL}}` if the database service is named differently). Do **not** wire `DATABASE_PUBLIC_URL` or another public proxy URL into the server service; API-to-database traffic should stay on Railway's private network.

Deploy and verify:

```bash
railway up --service dctycoon-api
railway deployment list --service dctycoon-api --json
railway logs --service dctycoon-api --build --latest --lines 200
railway logs --service dctycoon-api --deployment --latest --lines 200
railway domain --service dctycoon-api
curl https://<generated-api-domain>/healthz
```

Before enabling traffic, review production rate-limit values, confirm the pre-deploy migration command succeeds, and verify `/healthz`, `/version`, player registration, leaderboard submission, and leaderboard reads against the Railway URL.

Current production Railway details:

- Project: `datacenter-tycoon` (`02342aec-7d94-4cb7-9090-5bf53d101eaf`)
- Environment: `production` (`77ff1d78-bf23-4e3b-b5a4-66616c4fe080`)
- API service: `dctycoon-api` (`00549536-b2e0-49f8-888b-3ffc66275920`)
- Database service: `Postgres` (`4659293a-0f78-4a4d-af42-addb4c0ab33d`)
- Public API URL: `https://dctycoon-api-production.up.railway.app`
- Web production origin: `https://dctycoon.arnav.tech`
- Healthcheck: `GET /healthz`
- Runtime: Dockerfile final image `oven/bun:1.3.14`; Railway pre-deploy/start commands run `bun` against compiled server files.
- Database URL: `DATABASE_URL` is set from the private Railway Postgres URL (`postgres.railway.internal`), not a public proxy URL.
- Required CORS config: `CORS_ALLOWED_ORIGINS=https://dctycoon.arnav.tech,https://dctycoon-api-production.up.railway.app`
- Runtime note: production config now always unions the first-party web origin `https://dctycoon.arnav.tech` into the allowed-origin list even when the environment variable only names the API origin.

Autodeploy should be configured manually in Railway by connecting the `dctycoon-api` service to the GitHub repository. Keep the Railway build context/root at the repository root so the Dockerfile can access workspace manifests, `packages/server`, and `packages/game-logic`. Configure Railway watch paths so unrelated package-only changes do not redeploy the API; include at least `packages/server/**`, `packages/game-logic/**`, `package.json`, `package-lock.json`, `tsconfig.json`, `Dockerfile`, `.dockerignore`, and `railway.toml`.

### Rollback considerations

If the backend misbehaves after launch, the safest rollback is to disable online submission in the frontend by removing `VITE_API_BASE_URL` from the web deployment and redeploying the web app. Local gameplay continues to work without the backend.

## CI and verification

The main pull-request workflow now checks backend health through:

```bash
npm run typecheck
npm run build
npm run check:migrations:server
npm run test:ci
```

For server-only verification, run:

```bash
npm run ci:server
```

## Redis decision

Redis is **not required** for the first leaderboard launch. Indexed Postgres queries are the source of truth and should remain the only production dependency until real traffic proves caching is necessary.

See [`docs/redis-decision.md`](./docs/redis-decision.md) for the rationale and revisit criteria.

## Release readiness

See [`docs/release-checklist.md`](./docs/release-checklist.md) for the first-launch smoke tests, rollback steps, and operational checks.

## Player identity model

`POST /players` is a lightweight username-claim endpoint for leaderboard identity, not a full account system.

- Usernames are normalized before uniqueness checks, so values like `John Doe123`, ` john   doe123 `, and `JOHN DOE123` all refer to the same claimed leaderboard name.
- A successful registration returns `{ playerId, username }` where `playerId` is the client-held identifier used for future leaderboard submissions. New registrations now receive UUID strings in the `playerId` field.
- Clients are expected to persist that `playerId` locally (for example in browser local storage) and reuse it for future `POST /leaderboard/runs` calls.
- If a normalized username has already been claimed, the server returns `409 USERNAME_UNAVAILABLE`.
- Security is intentionally lightweight for now: possession of a valid `playerId` is sufficient to submit or update runs for that player.
- Abuse resistance is intentionally simple and single-instance for now: Elysia applies an app-wide `onRequest` throttle, and leaderboard submissions also use a tighter per-IP submission throttle.

## Trust model

This first backend launch accepts **top-level run summaries**, not full save snapshots or deterministic replays.
That means it is intentionally conservative about what it validates:

- usernames, ids, and request JSON must be well-formed;
- leaderboard metrics must be safe non-negative integers with the shared `game-logic` contract;
- repeated submissions for the same `clientRunId` must move forward monotonically for fields where monotonicity is expected (`gameMonth`, `cumulativeRevenue`);
- the entire backend is protected by a simple in-memory 10 req/sec throttle, and leaderboard submissions are further limited to 1 req/sec per client IP.

What it does **not** guarantee yet:

- cryptographic anti-cheat protection;
- cross-device account recovery;
- replay verification of every submitted run.

If stronger guarantees are needed later, the next step is to design deterministic replay or signed run-summary verification on top of the existing `game-logic` helpers.

## Compatibility note for existing player ids

The `players.id` column is stored as text and the API treats `playerId` as opaque. That means there is no migration requirement for older stored ids such as `player_<hex>` values: they remain valid in the database and on existing clients, while newly registered players now receive UUID strings.

Mixed fleets are expected during rollout: existing browsers/CLI profiles may continue submitting with older ids, and new clients will submit UUIDs through the same `playerId` field. Do not add client-side regex validation that assumes only one id format.
