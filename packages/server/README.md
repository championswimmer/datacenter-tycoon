# @datacenter-tycoon/server

Backend service for Datacenter Tycoon leaderboards and lightweight player registration.

## Current scope

- `GET /healthz`
- `GET /version`
- `GET /players/availability?username=...`
- `POST /players`
- `GET /leaderboard?metric=...&period=all-time&limit=...`
- `POST /leaderboard/runs`

## Environment variables

Copy `packages/server/.env.example` into your own local env file or export the values directly before starting the server.

| Variable | Required | Purpose |
| --- | --- | --- |
| `HOST` | local only | Bind host for the Node HTTP server. Defaults to `0.0.0.0`. |
| `PORT` | yes in production | Listening port. Railway injects this automatically. |
| `CORS_ALLOWED_ORIGINS` | yes in production | Comma-separated list of allowed web origins. |
| `SERVER_VERSION` | optional | Overrides the version returned by `GET /version`. |
| `DATABASE_URL` | required for persistent players and leaderboard runs | Postgres connection string for local dev or Railway Postgres. |
| `PLAYER_REGISTRATION_RATE_LIMIT_WINDOW_MS` | optional | Window size for registration throttling. |
| `PLAYER_REGISTRATION_RATE_LIMIT_MAX_REQUESTS` | optional | Max registration attempts per client within the window. |
| `LEADERBOARD_SUBMISSION_RATE_LIMIT_WINDOW_MS` | optional | Window size for leaderboard submission throttling. |
| `LEADERBOARD_SUBMISSION_RATE_LIMIT_MAX_REQUESTS` | optional | Max leaderboard submissions per client within the window. |

## Postgres provisioning

### Local Postgres

A minimal local setup can use any Postgres 15+ instance. For example:

```bash
createdb datacenter_tycoon
DATABASE_URL=postgres://localhost:5432/datacenter_tycoon npm run migrate -w @datacenter-tycoon/server
```

### Railway Postgres

1. Create the backend service from this monorepo using the checked-in `railway.toml`.
2. Add a Railway Postgres service to the same project.
3. Attach the Postgres service so Railway injects `DATABASE_URL` into the backend service.
4. Set `CORS_ALLOWED_ORIGINS` to the allowed web origin list for your deployed frontend.
5. Confirm the pre-deploy migration command succeeds before exposing the public domain.

## Trust model

This first backend launch accepts **top-level run summaries**, not full save snapshots or deterministic replays.
That means it is intentionally conservative about what it validates:

- usernames, ids, and request JSON must be well-formed;
- leaderboard metrics must be safe non-negative integers with the shared `game-logic` contract;
- repeated submissions for the same `clientRunId` must move forward monotonically for fields where monotonicity is expected (`gameMonth`, `cumulativeRevenue`);
- registration and submission endpoints are protected by simple in-memory rate limiting.

What it does **not** guarantee yet:

- cryptographic anti-cheat protection;
- cross-device account recovery;
- replay verification of every submitted run.

If stronger guarantees are needed later, the next step is to design deterministic replay or signed run-summary verification on top of the existing `game-logic` helpers.
