---
name: Server Migration to Bun, Elysia, and Drizzle
description: Rebuild the online server runtime around Bun, Elysia, and Drizzle while preserving the existing HTTP contract and supporting PGlite in development plus Postgres in production.
status: started
created: 2026-05-29
updated: 2026-05-29
owner: server
---

## Progress

- [x] **Phase 1 — Compatibility baseline and migration decisions**
  - [x] 1.1 Inventory the current server contract and freeze compatibility expectations
  - [x] 1.2 Choose the Bun/Drizzle driver strategy for production Postgres and development PGlite
  - [x] 1.3 Define the cutover boundaries so transport and persistence can migrate independently
- [x] **Phase 2 — Bun runtime foundation**
  - [x] 2.1 Convert server package scripts, entrypoints, and CI commands to Bun-compatible execution
  - [x] 2.2 Migrate the server test harness from `node:test` to `bun:test` while preserving request-level coverage
  - [x] 2.3 Keep monorepo root workflows working while the server package runs on Bun internally
- [x] **Phase 3 — Elysia transport migration**
  - [x] 3.1 Introduce an Elysia app factory with shared config, CORS, and error handling
  - [x] 3.2 Port health and version endpoints to Elysia without changing their response contract
  - [x] 3.3 Port player and leaderboard endpoints with request validation and rate limiting
  - [x] 3.4 Remove the custom Node HTTP adapter once Elysia reaches parity
- [x] **Phase 4 — Drizzle schema and repository migration**
  - [x] 4.1 Model the existing Postgres schema in Drizzle tables and relations
  - [x] 4.2 Add a Drizzle database factory for Bun Postgres and PGlite
  - [x] 4.3 Rewrite player and leaderboard repositories to use Drizzle instead of raw `pg` SQL
  - [x] 4.4 Adopt a Drizzle-led migration workflow without losing compatibility with existing databases
- [x] **Phase 5 — Development and production database modes**
  - [x] 5.1 Reintroduce the dev/prod database-mode rules on top of Drizzle
  - [x] 5.2 Make health/startup output expose runtime, framework, and active database provider
  - [x] 5.3 Support persistent file-backed PGlite in development and external Postgres in production
- [ ] **Phase 6 — Client compatibility, rollout, and documentation**
  - [ ] 6.1 Verify that web and planned CLI integrations continue to work against the migrated API
  - [ ] 6.2 Add integration coverage for Bun + Elysia + Drizzle across dev and production-like modes
  - [ ] 6.3 Update docs, deployment instructions, and follow-on plans to reflect the new stack

## Overview

Today the server package uses a custom fetch-style router layered over Node’s HTTP server and talks to Postgres via hand-written SQL through `pg`; it does **not** currently use a third-party HTTP framework or an ORM. This plan migrates the server package to run on **Bun**, use **Elysia** as the web framework, and use **Drizzle ORM** for schema definition, typed queries, and migrations. Because the backend is not yet live, exact HTTP backwards compatibility is now a **soft** constraint: we should preserve the broad product intent of `/healthz`, `/version`, `/players`, and `/leaderboard`, but we can simplify or reshape route payloads/error formatting when that materially improves the new stack.

The migration is intentionally staged so we do not mix transport, runtime, and persistence rewrites in one opaque change. The end state is a Bun-run backend with Elysia route modules, Drizzle schema/migrations, file-backed **PGlite** in local development, and real **Postgres** in production.

## Architecture

```mermaid
flowchart LR
    subgraph clients[Clients]
      WEB[packages/web]
      CLI[packages/cli]
    end

    subgraph runtime[packages/server on Bun]
      ENTRY[index.ts / server.ts]
      ELY[Elysia app]
      ROUTES[Route modules]
      SVC[Players + leaderboard services]
      DBF[Drizzle database factory]
      RL[Rate limiter]
    end

    subgraph dev[Development]
      PGL[(PGlite data dir)]
    end

    subgraph prod[Production]
      PG[(Postgres)]
    end

    WEB --> ELY
    CLI --> ELY
    ENTRY --> ELY --> ROUTES --> SVC
    ROUTES --> RL
    SVC --> DBF
    DBF -->|development| PGL
    DBF -->|production| PG
```

```mermaid
sequenceDiagram
    autonumber
    participant C as client
    participant E as Elysia route
    participant S as service layer
    participant R as Drizzle repository
    participant D as Drizzle DB

    C->>E: POST /leaderboard/runs
    E->>E: validate params/body
    E->>S: submitLeaderboardRun(payload)
    S->>R: upsertRun(...)
    R->>D: typed query/update
    D-->>R: row(s)
    R-->>S: domain record
    S-->>E: result
    E-->>C: JSON response with existing API shape
```

Key decisions:

- **Prefer pragmatic cleanup over strict wire compatibility.** Keep the same broad endpoint responsibilities unless there is a good reason to rename or consolidate them, but do not let legacy JSON shapes/status codes block a cleaner Elysia/Drizzle design while the backend is still pre-launch.
- **Preserve service-layer business rules.** Username rules, leaderboard monotonicity checks, summary derivation, and rate-limit semantics should not be reimplemented inside Elysia handlers.
- **Use Bun as the server runtime, not necessarily as the monorepo package manager.** The repo can keep npm workspaces while the `server` workspace itself uses `bun run` / `bun test` internally.
- **Use Elysia for transport concerns only.** Route grouping, schema validation, CORS, request parsing, and error formatting belong there; core player/leaderboard behavior remains in `src/players/` and `src/leaderboard/`.
- **Use Drizzle as the persistence boundary.** Schema definitions become typed code, repositories move from raw SQL strings toward typed Drizzle queries, and future migrations should be driven by Drizzle’s migration workflow.
- **Lock the Drizzle driver split early.** Production/staging will use `drizzle-orm/bun-sql` on top of Bun’s native `SQL` Postgres client, while development and DB-backed integration tests will use `drizzle-orm/pglite` on top of file-backed `PGlite` data directories.
- **Keep development and production database providers split by environment.** Development should default to file-backed PGlite; production should require real Postgres.
- **Prefer incremental parity over a big-bang rewrite.** Each phase should leave the server in a runnable, testable state.

Illustrative target shapes:

```ts
export interface ServerDatabaseConfig {
  mode: "postgres" | "pglite";
  postgresUrl?: string;
  pgliteDataDir?: string;
}

export interface ServerRuntimeInfo {
  runtime: "bun";
  framework: "elysia";
  databaseMode: "postgres" | "pglite" | "disabled";
}
```

```ts
// packages/server/src/db/schema.ts
import { bigint, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const players = pgTable("players", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  normalizedUsername: text("normalized_username").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
});
```

```ts
// packages/server/src/server/app.ts
import { Elysia } from "elysia";

export const createServerApp = (deps: AppDependencies) =>
  new Elysia()
    .get("/healthz", () => ({ status: "ok" }))
    .post("/players", ({ body }) => registerPlayer(deps, body));
```

## Phase 1 — Compatibility baseline and migration decisions

**Goal**: lock down what must stay the same and decide the Bun/Elysia/Drizzle integration strategy before code starts moving.

### Step 1.1 — Inventory the current server contract and freeze compatibility expectations

- Files: `packages/server/src/routes/*.ts`, `packages/server/src/routes/*.test.ts`, `packages/server/src/index.test.ts`, new `packages/server/src/contracts/` or `packages/server/src/test-utils/contracts.ts`.
- Record the current API contract for:
  - `GET /healthz`
  - `GET /version`
  - `GET /players/availability`
  - `POST /players`
  - `GET /leaderboard`
  - `POST /leaderboard/runs`
- Capture the current API behavior, CORS behavior, rate-limit behavior, and response status codes in focused request-level tests.
- Explicitly mark which details are transport contracts versus internal implementation details that are free to change.
- Acceptance: request-level tests give us a before/after reference point while migrating, but future steps may intentionally rewrite or replace them as the new Elysia routes settle.

### Step 1.2 — Choose the Bun/Drizzle driver strategy for production Postgres and development PGlite

- Files: plan notes in this file, `packages/server/package.json`, future `packages/server/drizzle.config.ts`.
- **Decision (locked in for implementation):**
  - **production/staging**: `drizzle-orm/bun-sql` with Bun’s native `SQL` PostgreSQL client.
  - **development**: `drizzle-orm/pglite` with file-backed `new PGlite("./path")` storage.
  - **DB-backed tests**: default to temporary `drizzle-orm/pglite` databases unless a later production-parity check explicitly needs a real Postgres target.
- **Rationale:**
  - `bun-sql` is the most direct fit for the requested Bun-native server runtime and avoids carrying a Node-compatibility database layer purely for production.
  - Bun SQL accepts standard Postgres connection strings, supports pooling plus TLS/SSL options, and is a good match for Railway-style `DATABASE_URL` deployment.
  - Bun SQL supports parameterized queries / prepared-statement style execution and transactions, which preserves the server’s current consistency requirements while moving to typed Drizzle queries.
  - `drizzle-orm/pglite` is a first-class Drizzle path for local PostgreSQL-compatible development, supports file-backed folders for persistence, and keeps the local-dev story aligned with the earlier plan `042` requirement to avoid requiring a separately managed Postgres daemon.
  - Locking these choices now keeps later steps from branching across `node-postgres`, `postgres.js`, and Bun-native alternatives simultaneously.
- **Migration-tooling note:** use a single Drizzle schema source of truth, then make runtime/apply flows provider-aware in later phases (production Postgres via Bun SQL, development/tests via PGlite).
- Acceptance: the plan records one production driver choice and one dev driver choice, with rationale and no unresolved ambiguity before implementation begins.

### Step 1.3 — Define the cutover boundaries so transport and persistence can migrate independently

- Files: `packages/server/src/types.ts`, `packages/server/src/index.ts`, `packages/server/src/players/service.ts`, `packages/server/src/leaderboard/service.ts`, new `packages/server/src/server/dependencies.ts` if useful.
- Identify seams that allow a phased migration:
  - route handlers can switch from the custom router to Elysia while services stay unchanged;
  - repositories can switch from `pg` to Drizzle while service signatures stay unchanged.
- Formalize the dependency graph so transport/runtime changes do not force an immediate persistence rewrite in the same commit.
- Implementation note: this seam now lives in `packages/server/src/server/dependencies.ts`, where `resolveAppDependencies(...)` keeps route/app factories transport-focused and `createDefaultServerServices(...)` isolates repository construction for later Drizzle migration.
- Acceptance: a short architecture note or dependency helper makes it obvious how to test Elysia handlers with injected fake services and Drizzle repositories independently.

## Phase 2 — Bun runtime foundation

**Goal**: make the server package runnable and testable on Bun before replacing major internals.

### Step 2.1 — Convert server package scripts, entrypoints, and CI commands to Bun-compatible execution

- Files: `packages/server/package.json`, root `package.json`, `packages/server/README.md`, CI docs/config if present.
- Replace `tsx watch src/index.ts`, `node --test --import tsx`, and `node dist/index.js` assumptions with Bun-native equivalents.
- Decide whether the server package still emits `dist/` via `tsc`, uses `bun run` directly in production, or supports both for deployment flexibility.
- Update root scripts so `npm run dev:server`, `npm run test:server`, and `npm run build:server` still work from the monorepo root, even if the server workspace internally invokes Bun.
- Implementation note: runtime scripts now execute through Bun inside `packages/server` (`bun run --watch src/index.ts`, `bun run src/db/*.ts`, `bun run dist/index.js`), while the root monorepo entrypoints remain `npm run ... -w @datacenter-tycoon/server`.
- Acceptance: a developer can run the server package locally through Bun, and the existing monorepo commands still work as documented.

### Step 2.2 — Migrate the server test harness from `node:test` to `bun:test` while preserving request-level coverage

- Files: `packages/server/src/**/*.test.ts`, `packages/server/src/test-utils/app.ts`, `packages/server/package.json`.
- Convert test imports and any Node-runner-specific assumptions to Bun’s test runner.
- Keep the fetch-based request testing style so route tests remain close to the current implementation and easy to compare before/after the Elysia swap.
- Ensure coverage and CI output remain available, even if the exact reporting toolchain changes.
- Implementation note: the suite now imports `test` from `bun:test`, `npm run test -w @datacenter-tycoon/server` executes `bun test`, and `test:ci` uses Bun’s built-in coverage plus JUnit reporting while preserving the existing request-level app harness.
- Acceptance: the full server test suite passes under `bun test`, and request-level tests still exercise the app without binding a real port unless a test explicitly needs it.

### Step 2.3 — Keep monorepo root workflows working while the server package runs on Bun internally

- Files: root `package.json`, `packages/server/package.json`, root docs.
- Preserve the current developer ergonomics where other packages can continue using npm workspaces from the root.
- Add any necessary runtime detection or wrapper scripts so server-specific Bun requirements are obvious and fail fast when Bun is missing.
- Decide whether CI installs Bun only for the server workspace or standardizes it at the repo level.
- Implementation note: the root now exposes explicit `typecheck:server` and `test:server:ci` wrappers, `ci:server` delegates through those npm entrypoints, and the root README now documents that Bun is only required once execution enters the server workspace.
- Acceptance: root-level development commands continue to work, and the repo documents exactly when Bun is required.

## Phase 3 — Elysia transport migration

**Goal**: replace the custom router and Node HTTP adapter with Elysia while preserving API behavior.

### Step 3.1 — Introduce an Elysia app factory with shared config, CORS, and error handling

- Files: new `packages/server/src/server/app.ts`, `packages/server/src/index.ts`, `packages/server/src/config.ts`, new server plugin/helpers as needed.
- Create a single Elysia app factory that receives injected dependencies for tests and startup.
- Move global concerns into Elysia setup:
  - CORS configuration;
  - shared JSON error formatting;
  - request validation hooks;
  - runtime metadata exposure.
- Map current custom `HttpError` behavior onto Elysia’s error handling so existing error payloads stay stable.
- Implementation note: the foundation now lives in `packages/server/src/server/elysia-app.ts`, with shared `HttpError` helpers in `packages/server/src/server/errors.ts` and a dedicated test suite covering CORS plus 404/validation/internal-error normalization.
- Acceptance: the Elysia app can be instantiated in tests and handles 404/validation/internal errors in a way compatible with current client expectations.

### Step 3.2 — Port health and version endpoints to Elysia without changing their response contract

- Files: `packages/server/src/routes/health.ts`, `packages/server/src/routes/health.test.ts`, `packages/server/src/index.ts`.
- Re-express `GET /healthz` and `GET /version` as Elysia routes or grouped plugins.
- Keep the current JSON payloads, then extend them carefully later with runtime/framework/database fields once compatibility tests are updated intentionally.
- Implementation note: `packages/server/src/routes/health.ts` now exports `registerHealthRoutes(...)` for the Elysia app, and the health test suite now exercises those endpoints through `createElysiaServerApp(...)` while `apiRequest(...)` supports both legacy and Elysia app instances during the transition.
- Acceptance: health/version route tests pass unchanged against the Elysia app.

### Step 3.3 — Port player and leaderboard endpoints with request validation and rate limiting

- Files: `packages/server/src/routes/players.ts`, `packages/server/src/routes/leaderboard.ts`, `packages/server/src/players/service.ts`, `packages/server/src/leaderboard/service.ts`, related tests.
- Move body/query parsing and validation into Elysia route schemas where appropriate.
- Keep service-layer calls, error-code mapping, and rate-limit semantics stable.
- Ensure leaderboard submission continues to use canonical gameplay-derived summary payload validation rather than client-trusting shortcuts.
- Implementation note: `createApp(...)` now builds the real server from `createElysiaServerApp(...)`, while `registerPlayerRoutes(...)` and `registerLeaderboardRoutes(...)` port the interactive endpoints onto Elysia using the existing service layer, explicit JSON parsing, and shared rate-limit helpers. The request-level suite still covers player/leaderboard success, idempotency, validation, and rate-limited flows against the Elysia-backed app.
- Acceptance: all existing player/leaderboard request tests pass against Elysia, including invalid JSON, invalid usernames, duplicate names, and rate-limited cases.

### Step 3.4 — Remove the custom Node HTTP adapter once Elysia reaches parity

- Files: `packages/server/src/server/node-http.ts`, old routing types/helpers, imports across tests and startup.
- Delete obsolete transport scaffolding only after Elysia has full route parity and the test suite no longer depends on the old app shape.
- Keep any reusable JSON/error helper logic only if it still provides value around Elysia.
- Implementation note: the legacy fetch-router (`server/app.ts`) and Node adapter (`server/node-http.ts`) have now been removed, `startServer(...)` listens through Elysia directly, route files only export Elysia registrars, and shared HTTP errors live in `server/errors.ts` for reuse outside the old transport layer.
- Acceptance: the server package no longer depends on `node:http` startup glue or the bespoke route-matching layer.

## Phase 4 — Drizzle schema and repository migration

**Goal**: replace raw SQL/`pg` repository code with Drizzle while keeping domain and API semantics intact.

### Step 4.1 — Model the existing Postgres schema in Drizzle tables and relations

- Files: new `packages/server/src/db/schema.ts`, optional `packages/server/src/db/relations.ts`, `packages/server/migrations/001_leaderboard_foundation.sql`, new `packages/server/drizzle.config.ts`.
- Translate the current `players` and `leaderboard_runs` schema into Drizzle table definitions, including:
  - primary keys;
  - uniqueness constraints;
  - foreign keys;
  - indexed leaderboard ranking fields;
  - timestamp columns.
- Decide how historical SQL migration `001_leaderboard_foundation.sql` maps to Drizzle’s migration source of truth.
- Implementation note: the server now has `src/db/schema.ts` and `src/db/relations.ts` mirroring the existing SQL baseline, a `drizzle.config.ts` that keeps future Drizzle-generated migrations under `./drizzle` instead of overwriting the legacy `migrations/001_leaderboard_foundation.sql`, and a small `schema.test.ts` regression test covering the exported table/column layout.
- Acceptance: a Drizzle schema exists that faithfully represents the current database layout and can generate equivalent future migrations.

### Step 4.2 — Add a Drizzle database factory for Bun Postgres and PGlite

- Files: new `packages/server/src/db/client.ts`, `packages/server/src/db/database.ts`, `packages/server/src/config.ts`, `packages/server/src/types.ts`.
- Build a typed DB factory that returns:
  - a production/staging Drizzle client connected to Postgres under Bun;
  - a development Drizzle client connected to file-backed PGlite;
  - test-friendly variants that can use temporary PGlite data or injected fakes.
- Centralize lifecycle management (open/close) so startup, tests, and migrations all use the same configuration rules.
- Implementation note: `src/db/client.ts` now exposes Bun SQL and PGlite Drizzle initializers bound to the shared schema, while `src/db/database.ts` wraps them in a single `createServerDatabase(...)` abstraction with a common `close()` lifecycle. A new `database.test.ts` covers both the in-memory PGlite path and a Bun SQL wrapper instantiation path.
- Acceptance: startup code can ask for one database abstraction and does not need to know whether it is talking to Postgres or PGlite.

### Step 4.3 — Rewrite player and leaderboard repositories to use Drizzle instead of raw `pg` SQL

- Files: `packages/server/src/players/postgres-repository.ts` or renamed replacements, `packages/server/src/leaderboard/repository.ts`, repository tests.
- Replace raw SQL string execution with Drizzle query builders and explicit row-to-domain mapping.
- Preserve domain behavior:
  - username normalization and uniqueness handling;
  - monotonic leaderboard updates;
  - idempotent `(playerId, clientRunId)` upserts;
  - deterministic leaderboard ordering.
- Keep repository interfaces stable where possible so the service layer changes minimally.
- Implementation note: the raw `pg` player repository has been replaced by `players/drizzle-repository.ts`, the leaderboard repository now uses Drizzle query builders plus conflict-aware upsert logic, `createDefaultServerServices(...)` now wires `DATABASE_URL` configs through Bun SQL + Drizzle, and PGlite-backed repository/integration tests exercise the same request-level flows through the real Elysia routes.
- Acceptance: repository tests and request-level contract tests pass against Drizzle-backed persistence in both dev-like and prod-like configurations.

### Step 4.4 — Adopt a Drizzle-led migration workflow without losing compatibility with existing databases

- Files: `packages/server/drizzle.config.ts`, `packages/server/src/db/migrate.ts`, `packages/server/src/db/check-migrations.ts`, migration directories, docs.
- Choose a safe migration transition strategy, for example:
  - keep `001_leaderboard_foundation.sql` as the historical baseline;
  - introduce Drizzle migration metadata for all new changes from this point forward;
  - add a one-time bootstrap/baseline procedure for already-provisioned databases if Drizzle requires its own migration ledger.
- Ensure migrations work for both:
  - file-backed PGlite in local development;
  - external Postgres in production/staging.
- Implementation note: the repo now carries an explicit Drizzle journal at `packages/server/drizzle/meta/_journal.json`, `migrate.ts` delegates to a provider-aware workflow that applies the historical SQL baseline first and then runs Drizzle migrations for either Bun SQL or PGlite, and `check-migrations.ts` validates both the legacy SQL folder and the Drizzle journal. `migration-workflow.test.ts` verifies that an empty PGlite database can be bootstrapped end-to-end without destructive re-initialization.
- Acceptance: a clean database can be initialized through the new migration workflow, and an existing database can be adopted without destructive re-bootstrap.

## Phase 5 — Development and production database modes

**Goal**: restore the desired runtime behavior of local PGlite development and production Postgres on top of the new stack.

### Step 5.1 — Reintroduce the dev/prod database-mode rules on top of Drizzle

- Files: `packages/server/src/config.ts`, `packages/server/src/index.ts`, `packages/server/.env.example`, tests.
- Encode the environment rules explicitly:
  - `production` requires Postgres;
  - `development` defaults to file-backed PGlite when no Postgres URL is provided;
  - `test` uses temporary or injected DBs unless a test explicitly needs persistence.
- Ensure the configuration surface is simple and typed.
- Implementation note: `loadServerConfig(...)` now resolves a typed `config.database` object, production rejects missing `DATABASE_URL`, development defaults to `.data/pglite`, and runtime startup goes through `createRuntimeServerServices(...)` so the Bun server actually boots against persistent PGlite by default while test-only `createApp(...)` callers can still stay in-memory unless they opt into persistence.
- Acceptance: config tests cover production-without-Postgres failure, development PGlite defaulting, and explicit Postgres override.

### Step 5.2 — Make health/startup output expose runtime, framework, and active database provider

- Files: `packages/server/src/routes/health.ts`, `packages/server/src/index.ts`, tests.
- Extend operational visibility so a developer can immediately see:
  - runtime = Bun;
  - framework = Elysia;
  - database mode/provider = PGlite or Postgres.
- Add these fields in a backwards-compatible way or update compatibility tests intentionally if the health payload contract changes.
- Implementation note: `/healthz` now returns `runtime`, `framework`, `databaseMode`, and `databaseProvider`, while startup logs emit the same runtime/framework/provider tuple so a single curl or boot log shows whether the server is using `bun-sql`, `pglite-file`, or `pglite-memory`.
- Acceptance: smoke tests and docs make it trivial to verify that the intended runtime stack is active.

### Step 5.3 — Support persistent file-backed PGlite in development and external Postgres in production

- Files: `packages/server/src/db/client.ts`, `packages/server/src/index.ts`, docs, ignore files if needed.
- Choose and document a default local data directory for PGlite.
- Ensure local data persists across server restarts.
- Ensure production startup rejects accidental PGlite usage and requires the correct Postgres configuration.
- Implementation note: development now defaults to `packages/server/.data/pglite`, the Bun startup path eagerly creates that directory before opening PGlite, `.gitignore` excludes the local data folder, docs and `.env.example` explain the PGlite default plus Postgres override, and `pglite-persistence.test.ts` proves that data survives a close/reopen cycle.
- Acceptance: local dev can start with no separate Postgres daemon, while production-like configuration connects cleanly to a real Postgres instance.

## Phase 6 — Client compatibility, rollout, and documentation

**Goal**: make the migration safe for dependent clients and easy for future contributors to understand.

### Step 6.1 — Verify that web and planned CLI integrations continue to work against the migrated API

- Files: `packages/web/src/online/*.ts`, `packages/cli/src/online/*.ts` once implemented, integration tests, plan `042` references.
- Confirm that web leaderboard registration/submission helpers still work without payload or endpoint changes.
- Validate that the `042` CLI online-sync plan can continue against the migrated server with no server-side API drift.
- Acceptance: at least one browser/client integration path and one CLI-oriented test path exercise the migrated API successfully.

### Step 6.2 — Add integration coverage for Bun + Elysia + Drizzle across dev and production-like modes

- Files: `packages/server/src/**/*.test.ts`, optional integration-test helpers.
- Add tests that boot the real Elysia app and exercise:
  - PGlite-backed development mode;
  - Postgres-backed production-like mode where feasible;
  - migration initialization;
  - rate limiting and error formatting.
- Keep unit tests fast, but add enough end-to-end coverage to catch framework/runtime-specific regressions.
- Acceptance: server tests cover the migrated stack, not just isolated domain helpers.

### Step 6.3 — Update docs, deployment instructions, and follow-on plans to reflect the new stack

- Files: `packages/server/README.md`, `packages/server/AGENTS.md`, root `package.json` docs/comments if any, `.agents/plans/042-online-identity-cli-sync-and-dev-db-modes.md` if server assumptions need revision, `.agents/plans/README.md`.
- Update setup docs for Bun-based local development, Drizzle migrations, PGlite local persistence, and Postgres production deployment.
- Revise package guidance so future contributors no longer assume the old custom router or raw `pg` setup.
- If plan `042` still contains Node/raw-SQL server assumptions, add a changelog note or successor reference so the online-sync work builds on the migrated stack.
- Acceptance: a new contributor can read the docs and correctly understand that the server runs on Bun, uses Elysia, and persists through Drizzle.

## References

- [`AGENTS.md`](../../AGENTS.md)
- [`packages/server/AGENTS.md`](../../packages/server/AGENTS.md)
- [`042-online-identity-cli-sync-and-dev-db-modes.md`](./042-online-identity-cli-sync-and-dev-db-modes.md)
- [`038-backend-leaderboard-foundation.md`](./archive/038-backend-leaderboard-foundation.md)
- [`packages/server/src/server/app.ts`](../../packages/server/src/server/app.ts)
- [`packages/server/src/server/node-http.ts`](../../packages/server/src/server/node-http.ts)
- [`packages/server/src/routes/health.ts`](../../packages/server/src/routes/health.ts)
- [`packages/server/src/routes/players.ts`](../../packages/server/src/routes/players.ts)
- [`packages/server/src/routes/leaderboard.ts`](../../packages/server/src/routes/leaderboard.ts)
- [`packages/server/src/players/postgres-repository.ts`](../../packages/server/src/players/postgres-repository.ts)
- [`packages/server/src/leaderboard/repository.ts`](../../packages/server/src/leaderboard/repository.ts)
- [`packages/server/migrations/001_leaderboard_foundation.sql`](../../packages/server/migrations/001_leaderboard_foundation.sql)
- [Elysia documentation](https://elysiajs.com/)
- [Drizzle ORM documentation](https://orm.drizzle.team/)
- [Bun documentation](https://bun.sh/docs)
- [PGlite support in Drizzle](https://orm.drizzle.team/docs/get-started-postgresql#pglite)

## Changelog

- 2026-05-29 — Created plan for migrating the server from the custom Node router + raw `pg` stack to Bun, Elysia, and Drizzle.
- 2026-05-29 — Completed step 1.1 by freezing the current HTTP contract in request-level tests and documenting which transport details must remain stable during the migration.
- 2026-05-29 — Completed step 1.2 by locking the Drizzle driver split to Bun SQL for production/staging and PGlite for development/tests, with deployment/runtime rationale recorded in the plan.
- 2026-05-29 — Completed step 1.3 by extracting a transport/persistence dependency seam so the future Elysia and Drizzle migrations can be tested and landed independently.
- 2026-05-29 — Completed step 2.1 by switching server runtime scripts to Bun while preserving root npm workspace orchestration and documenting the Bun requirement.
- 2026-05-29 — Completed step 2.2 by moving the server test suite to `bun:test` and Bun-native CI coverage/reporter flags without losing request-level contract coverage.
- 2026-05-29 — Completed step 2.3 by codifying root npm wrappers around the Bun-run server workspace and documenting exactly where Bun is required in the monorepo.
- 2026-05-29 — Completed step 3.1 by adding the first Elysia app factory, wiring shared CORS/error handling, and freezing its base behavior in dedicated tests before porting real endpoints.
- 2026-05-29 — Relaxed the migration constraint from strict HTTP backwards compatibility to broad endpoint-level continuity because the backend is not yet live and can absorb cleaner route/response changes during the stack rewrite.
- 2026-05-29 — Completed step 3.2 by porting health/version endpoints into an Elysia route registrar and running the existing health tests against the Elysia app harness.
- 2026-05-29 — Completed step 3.3 by switching `createApp(...)` to Elysia and porting player/leaderboard routes, while relaxing the old transport snapshot tests to accept Bun/Elysia header formatting differences.
- 2026-05-29 — Completed step 3.4 by deleting the bespoke fetch-router and `node:http` adapter, simplifying the server to a direct Elysia/Bun startup path.
- 2026-05-29 — Completed step 4.1 by adding Drizzle schema/relations/config files that mirror the existing leaderboard SQL baseline without yet changing runtime persistence.
- 2026-05-29 — Completed step 4.2 by introducing shared Bun SQL / PGlite Drizzle client factories and a unified database connection abstraction with closeable lifecycle helpers.
- 2026-05-29 — Completed step 4.3 by replacing raw `pg` repositories with Drizzle implementations and proving the new persistence path through both repository tests and a PGlite-backed request-level integration test.
- 2026-05-29 — Completed step 4.4 by adding a provider-aware migration workflow that preserves the historical SQL baseline while introducing Drizzle’s migration journal and migrator entrypoints.
- 2026-05-29 — Completed step 5.1 by restoring explicit dev/prod database-mode rules on top of Drizzle and proving that a Bun-started development server now boots against default file-backed PGlite.
- 2026-05-29 — Completed step 5.2 by exposing runtime/framework/database-provider metadata in both `/healthz` and startup logs.
- 2026-05-29 — Completed step 5.3 by documenting the persistent PGlite default, ignoring its data directory, and adding a regression test that proves file-backed data survives restarts.
