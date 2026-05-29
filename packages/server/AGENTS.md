# AGENTS.md — `@datacenter-tycoon/server`

Backend workspace for Datacenter Tycoon online services.

Today this package contains the first deployable backend slice:

- health/version endpoints;
- lightweight player username registration;
- leaderboard submission and read APIs;
- Bun + Elysia runtime wiring;
- Drizzle schema, repositories, and migration workflow;
- PGlite-backed local development plus Postgres production support.

It does **not** yet host multiplayer sessions, password auth, cross-device account recovery, or full replay verification.

## Core package rules

- Reuse `@datacenter-tycoon/game-logic` for shared gameplay-derived summaries and validation contracts — never re-implement scoring rules in routes.
- Keep transport (HTTP) thin. Route files should parse requests, call services, and serialize responses; business rules belong in `src/players/`, `src/leaderboard/`, or `game-logic`.
- Treat all client input as untrusted. Validate usernames, query params, payload shapes, and leaderboard metrics before touching persistence.
- Prefer adding or extending repository/service interfaces over embedding SQL or storage branching directly in route handlers.
- Keep transport (Elysia routes/hooks) thin. Business rules stay in services/repositories, not in route callbacks.
- Keep state JSON-serializable at the API boundary.
- Do **not** hand-edit generated output under `packages/server/dist/` or test artifacts under `packages/server/coverage/`.

## What currently exists inside this package

### Runtime shape

- `src/index.ts`
  - Main entrypoint.
  - Loads config, wires runtime services, creates the Elysia app, and starts the Bun server when executed directly.
- `src/config.ts`
  - Parses environment variables.
  - Enforces production-only requirements like `CORS_ALLOWED_ORIGINS`.
  - Exposes server version, game-logic version, and rate-limit config.
- `src/server/`
  - Elysia app foundation and shared error handling.
  - `elysia-app.ts` configures CORS plus shared JSON error mapping.
  - `errors.ts` contains shared `HttpError` handling.
- `src/routes/`
  - Route registration only.
  - `health.ts` exposes `GET /healthz` and `GET /version`.
  - `players.ts` exposes username availability and registration endpoints.
  - `leaderboard.ts` exposes leaderboard reads and run submissions.
- `src/players/`
  - Username rules, identity helpers, player repository interfaces, in-memory fallback implementation, Drizzle repository, and service-layer request normalization.
- `src/leaderboard/`
  - Submission/query types, validation, ranking queries, service orchestration, and repository implementations.
  - Includes idempotent run upserts and monotonic-update checks for repeated submissions.
- `src/rate-limit/`
  - In-memory fixed-window rate limiter used to throttle player registration and leaderboard submissions.
- `src/db/`
  - Drizzle schema/client/database factories, migration loader/workflow, and migration verification scripts.
- `src/test-utils/`
  - Helpers for constructing the app in tests without binding a real network port.
- `migrations/`
  - Checked-in SQL migrations. The current foundation migration is `001_leaderboard_foundation.sql`.
- `docs/`
  - Operational notes such as Redis rationale and release checklist.
- `.env.example`
  - Local env template.
- `README.md`
  - Human-facing setup and deployment instructions.

### Current API surface

- `GET /healthz`
  - Liveness/config visibility.
  - Returns environment and whether a database is configured.
- `GET /version`
  - Returns server package version and `@datacenter-tycoon/game-logic` version.
- `GET /players/availability?username=...`
  - Validates and checks normalized username availability.
- `POST /players`
  - Registers a username and returns `{ playerId, username }`.
- `GET /leaderboard?metric=...&period=all-time&limit=...`
  - Reads ranked leaderboard entries.
- `POST /leaderboard/runs`
  - Upserts a leaderboard run summary for a `(playerId, clientRunId)` pair.

### Current persistence behavior

- In `production`:
  - `DATABASE_URL` is required;
  - Bun SQL + Drizzle talk to external Postgres;
  - migrations are expected to have been applied.
- In `development` without `DATABASE_URL`:
  - the server defaults to file-backed PGlite under `.data/pglite`;
  - player registration and leaderboard routes work against that local database;
  - rate limiting remains in-memory.
- In `test` without an explicit database target:
  - most helpers still prefer injected/in-memory services unless a test opts into PGlite-backed persistence.

## How the package is organized conceptually

Use this layering when adding features:

1. **Route layer** — request parsing + HTTP status codes (`src/routes/**`)
2. **Service layer** — package-level orchestration + domain error normalization (`src/players/service.ts`, `src/leaderboard/service.ts`)
3. **Repository layer** — persistence interface + in-memory/Postgres implementations (`src/players/*repository*`, `src/leaderboard/repository.ts`)
4. **Database/migrations** — schema changes and migration scripts (`src/db/**`, `migrations/**`)

If a change needs shared gameplay-derived answers, add them to `@datacenter-tycoon/game-logic` and consume them here instead of recomputing them in the server package.

## Commands you will actually use

From the repo root:

```bash
npm run dev:server
npm run test:server
npm run build:server
npm run check:migrations:server
npm run ci:server
```

Inside the workspace or via `-w @datacenter-tycoon/server`:

```bash
npm run dev
npm run test
npm run build
npm run typecheck
npm run migrate
npm run check:migrations
npm run start
```

## How to run it locally

### 1. Prepare env

```bash
cp packages/server/.env.example packages/server/.env.local
```

Then export the needed values in your shell, or otherwise load them before running the server.

Important variables:

- `HOST` — defaults to `0.0.0.0`
- `PORT` — defaults to `3000`
- `CORS_ALLOWED_ORIGINS` — required in production, optional in local dev
- `DATABASE_URL` — required in production, optional in local dev
- `PGLITE_DATA_DIR` — optional local data path, defaults to `.data/pglite` in development
- `SERVER_VERSION` — optional version override
- `PLAYER_REGISTRATION_RATE_LIMIT_*` — optional registration throttling
- `LEADERBOARD_SUBMISSION_RATE_LIMIT_*` — optional submission throttling

### 2. Migrate the local database

By default local development uses file-backed PGlite:

```bash
npm run migrate -w @datacenter-tycoon/server
```

If you want a production-like local Postgres run instead:

```bash
createdb datacenter_tycoon
DATABASE_URL=postgres://localhost:5432/datacenter_tycoon npm run migrate -w @datacenter-tycoon/server
```

### 3. Start the dev server

```bash
npm run dev:server
```

### 4. Smoke test it

```bash
curl http://localhost:3000/healthz
curl "http://localhost:3000/players/availability?username=champion"
curl -X POST http://localhost:3000/players \
  -H 'content-type: application/json' \
  -d '{"username":"champion"}'
```

With a returned `playerId`, a leaderboard submission looks like:

```bash
curl -X POST http://localhost:3000/leaderboard/runs \
  -H 'content-type: application/json' \
  -d '{
    "playerId": "<player-id>",
    "clientRunId": "local-run-001",
    "metrics": {
      "money": 100000,
      "cumulativeRevenue": 250000,
      "totalServers": 12,
      "computeCapacity": 300,
      "memoryCapacity": 1200,
      "storageCapacity": 10000,
      "gpuCapacity": 8
    },
    "gameMonth": 18
  }'
```

Then query the leaderboard:

```bash
curl "http://localhost:3000/leaderboard?metric=money&period=all-time&limit=10"
```

## Guidance for common edits

### Adding a new endpoint

- Add the route in `src/routes/`.
- Put parsing/validation orchestration in the relevant service module.
- Extend repository interfaces if persistence is needed.
- Add tests near the new route/service.
- Prefer returning structured JSON errors through `HttpError`.

### Adding a new leaderboard metric

- Update shared metric/type definitions in `src/leaderboard/types.ts`.
- Update payload validation in `src/leaderboard/validation.ts`.
- Update ranking/query logic in `src/leaderboard/queries.ts` and repository ordering in `src/leaderboard/repository.ts`.
- If the metric is derived from gameplay state, prefer a canonical helper in `@datacenter-tycoon/game-logic` rather than a server-local recomputation.
- Check whether the migration/schema needs a new column or derived query expression.

### Changing player identity rules

- Start in `src/players/identity.ts` and its tests.
- Keep normalization, allowed characters, and length limits consistent between availability checks and registration.
- Preserve stable, user-friendly error codes for the frontend.

### Changing schema or persistence

- Keep `src/db/schema.ts`, `src/db/relations.ts`, and `drizzle.config.ts` aligned with any schema changes.
- Preserve `migrations/001_leaderboard_foundation.sql` as the historical bootstrap baseline; do not rewrite applied migrations.
- Add future Drizzle-generated migrations under `packages/server/drizzle/` and keep the `_journal.json` ledger valid.
- Maintain parity between in-memory, PGlite, and Postgres-backed repository behavior where tests rely on multiple providers.

## Testing expectations

- Keep unit tests next to source files as `*.test.ts`.
- Route tests should use `src/test-utils/app.ts` or app construction helpers rather than binding real ports.
- Prefer dependency injection and in-memory repositories for tests unless the behavior is specifically about Postgres migrations.
- At minimum, run the relevant workspace tests after changing behavior:

```bash
npm run test -w @datacenter-tycoon/server
npm run typecheck -w @datacenter-tycoon/server
```

If you touch migrations, also run:

```bash
npm run check:migrations -w @datacenter-tycoon/server
```

## Deployment notes

- Railway is the intended first deployment target.
- The service must bind to Railway's `PORT`.
- Run migrations before exposing the service publicly.
- Production must set `CORS_ALLOWED_ORIGINS` explicitly.
- Redis is intentionally **not** required for the first launch; see `packages/server/docs/redis-decision.md` before introducing it.

## What not to assume yet

- No password login or secure account recovery.
- No deterministic replay verification yet.
- No multiplayer/session-hosting implementation yet.
- No durable cache layer beyond Postgres/PGlite.
- No extra web-framework abstractions beyond the current Elysia-based stack.

If you need any of the above, document the change clearly and prefer a new implementation plan when the work becomes multi-step or architectural.
