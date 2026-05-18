# Redis decision for the first leaderboard launch

## Decision

**Do not add Redis for the first backend launch.**

## Why

The initial leaderboard workload is small enough that indexed Postgres queries are the simpler and safer default:

- `leaderboard_runs` already has ranking indexes for money, cumulative revenue, server count, and per-resource capacity columns.
- Postgres is already the source of truth for players and runs, so skipping Redis avoids projection drift and cache invalidation bugs during the first public release.
- The current API only exposes all-time rankings with bounded `limit` values, which are cheap to satisfy directly from Postgres for expected launch traffic.

## Revisit criteria

Revisit this decision only if one of the following becomes true:

- leaderboard reads dominate backend traffic and indexed Postgres queries are no longer fast enough;
- we add richer ranking periods or more expensive aggregation views;
- we need precomputed sorted sets for product reasons, not just hypothetical scale.

## If Redis is added later

Keep Postgres as the source of truth. Redis should only cache or project leaderboard views, and the backend must fall back to Postgres if Redis is unavailable.
