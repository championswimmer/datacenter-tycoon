# AGENTS.md — `packages/server-go`

Go port of `packages/server`. Read the root `AGENTS.md` first. This file adds package rules.

## Rules

- **No game rules in Go.** Scoring, verification-replay state, and contract logic come from `game-logic`, bundled into `jsbridge/bundle.js` and run through goja. If Go needs a new derived answer, add it to `game-logic` (TS) and rebuild the bundle.
- **Never hand-edit `jsbridge/bundle.js`.** Regenerate it with `bash scripts/build-bundle.sh`. CI runs the script and fails on `git diff` drift, so a stale or hand-edited bundle breaks the `go` job.
- **Endpoint parity is the contract.** Paths, status codes, JSON shapes, error codes, and CORS/rate-limit behavior must match `packages/server`. The TS HTTP contract tests are the parity gate: run `npm run test:blackbox -w @datacenter-tycoon/server` against a running Go server (see README for the env).
- **Config parity.** Env names and defaults in `internal/config` mirror `packages/server/src/config.ts`. Change both together.
- **Migrations are shared.** `migrations/*.sql` must stay byte-identical to `packages/server/migrations`. `migrations_test.go` enforces this. Do not edit the SQL here alone.
- **Dependency direction.** Go does not import TS packages. The only link to `game-logic` is the committed bundle.
- Keep `internal/` and `cmd/` changes small and tested. Postgres tests skip without `TEST_DATABASE_URL`, so run them locally before relying on them.

## Deployment files

- `Dockerfile` builds from the **repo root** context. Keep it free of Node stages. It relies on the committed bundle.
- `railway.toml` is the Config-as-code file for the separate Go Railway service. The root `railway.toml` belongs to the TS service and must not be changed for Go work.
- `Dockerfile.dockerignore` only applies to this Dockerfile (BuildKit reads `<Dockerfile>.dockerignore`), so the root image build is unaffected.

## Black-box test expectations

When the TS suite runs against Go, it uses the in-memory mode (no `DATABASE_URL`):

- `/healthz` must report `databaseConfigured: false`. The suite also checks `status`, `environment`, and the top-level field set exactly.
- `runtime`, `framework`, `databaseMode`, and `databaseProvider` values are relaxed on purpose (`expectedHealthBody` in `packages/server/src/test-utils/app.ts`), because `test-utils/contracts.ts` lists the transport and persistence implementations as free to change.
- Tests that seed in-process InMemory repositories or inject fakes are skipped (`inProcessTest`). The list is in the comment above `getBlackboxBaseUrl` in `app.ts`.
- Fixed usernames get a per-test suffix (`uniqueSuffix()`) because players persist across tests on one server.

## Known gaps

- Leaderboard parity is checked black-box only in in-memory mode. The Postgres-backed leaderboard path is covered by Go tests (`TEST_DATABASE_URL`) and not by the shared TS suite, because `/healthz` expects in-memory metadata there.
- The two TS `GET /version` tests are currently marked `inProcessTest`, so black-box runs skip them. They only need HTTP. A manual `curl` against the Go server returns the expected shape, but the tests themselves have not been run against Go. Restoring them to `test` is worth doing once checked.
