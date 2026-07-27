---
name: Leaderboard Hide Zero-Revenue Runs
description: Exclude leaderboard runs with cumulative revenue of 0 from leaderboard read responses across verified and all visibility modes.
status: completed
created: 2026-07-27
updated: 2026-07-27
---

## Progress

- [x] **Phase 1 — Repository filtering**
  - [x] 1.1 Exclude zero-revenue rows from in-memory and Drizzle leaderboard reads before ranking/limit application
- [x] **Phase 2 — Regression coverage**
  - [x] 2.1 Add backend tests proving zero-revenue runs are omitted from verified and all leaderboard responses
  - [x] 2.2 Add repository coverage for Drizzle-backed reads so SQL behavior matches in-memory behavior
- [x] **Phase 3 — Verification and delivery**
  - [x] 3.1 Run targeted server tests, finalize the plan, and prepare the commit/push

## Overview

Verified checkpoint submissions can exist at game start before the player has generated any revenue. Those rows are useful for persistence and verification continuity, but they should not appear in ranked leaderboard read responses. The backend should therefore omit any run whose `cumulativeRevenue` is `0` regardless of the requested leaderboard metric or verification visibility.

## Changelog

- 2026-07-27 — Created plan 052 for filtering zero-revenue runs out of leaderboard reads.
- 2026-07-27 — Completed repository filtering plus targeted route and Drizzle regression coverage for zero-revenue leaderboard rows.
