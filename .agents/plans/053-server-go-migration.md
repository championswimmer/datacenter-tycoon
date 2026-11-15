---
name: Server Go Migration
description: Port packages/server (Bun/Elysia/Drizzle) to Go in packages/server-go with identical HTTP behavior, deployable to Railway as a separate service alongside the TS server.
status: completed
created: 2026-11-15
updated: 2026-11-15
---

## Progress

- [x] **Phase 0 — Approach spike**: game-logic bundled via esbuild and run inside Go with goja; genesis/replay state hashes match Bun byte-for-byte (`testdata/jsbridge-golden.json`).
- [x] **Phase 1 — Domain**: players, leaderboard validation/queries/service/verification, in-memory repos, jsbridge package
- [x] **Phase 2 — Persistence**: Postgres migrator/workflow (same tracking table as TS), pg repositories, migrate + check-migrations commands
- [x] **Phase 3 — HTTP**: config, errors, CORS, rate limiting, routes, main
- [x] **Phase 4 — Black-box parity**: TS HTTP test suite runnable against the Go server via `SERVER_BASE_URL`
- [x] **Phase 5 — Delivery**: Dockerfile + railway config (separate service), CI job, README/AGENTS docs, PR

## Decisions

- **Game rules stay in TS (`game-logic`)** — AGENTS.md rule #1. The Go server embeds a bundle of `game-logic` (`jsbridge/bundle.js`, built by `scripts/build-bundle.sh`) and executes it in goja. Re-porting ~9k lines of deterministic sim to Go would risk hash drift and violate the single-source-of-truth rule.
- Canonical JSON hashing is computed inside the JS runtime so float formatting and `localeCompare` key ordering are identical to the TS server.
- TS server is untouched; Go is a second Railway service with its own domain.

## Changelog

- 2026-11-15 — Implemented `packages/server-go` (domain, pg persistence, HTTP, Docker/Railway, CI, docs). Go tests pass against Postgres; TS HTTP suite passes against the Go server (`test:blackbox`: 25 pass, 13 in-process-only skips). TS server left in place for later removal.
