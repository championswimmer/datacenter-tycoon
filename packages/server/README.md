# @datacenter-tycoon/server

Backend service for Datacenter Tycoon leaderboards and lightweight player registration.

## Current scope

- `GET /healthz`
- `GET /version`
- `GET /players/availability?username=...`
- `POST /players`
- `GET /leaderboard?metric=...&period=all-time&limit=...`
- `POST /leaderboard/runs`

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
