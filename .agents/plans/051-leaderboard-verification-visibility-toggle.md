---
name: Leaderboard Verification Visibility Toggle
description: Let leaderboard reads opt into verified-only or all runs, and expose a frontend toggle that defaults to all for now.
status: completed
created: 2026-07-26
updated: 2026-07-26
---

## Progress

- [x] **Phase 1 — API query support for verification visibility**
  - [x] 1.1 Add a typed leaderboard visibility query mode and wire it through service and repository reads
  - [x] 1.2 Add backend tests for verified-only vs all leaderboard responses
- [x] **Phase 2 — Frontend leaderboard toggle**
  - [x] 2.1 Extend the web leaderboard client and app state to request verification visibility explicitly
  - [x] 2.2 Add a dialog toggle that defaults to all and covers loading/error/cache behavior in tests
- [x] **Phase 3 — Verification and delivery**
  - [x] 3.1 Run targeted server and web tests, update the plan status, and prepare the branch for a PR

## Overview

The verified-run rollout currently hides legacy and local-unverified leaderboard rows from the default ranked leaderboard. For rollout and debugging, we now want the API to support either the existing verified-only view or a combined all-runs view, while the web start-screen leaderboard defaults to the broader all-runs mode for now. This change should preserve the existing verified filtering path, keep the transport and repository layers thin and typed, and avoid duplicating leaderboard query logic between server and web.

## Architecture

```mermaid
flowchart LR
    WebToggle[Leaderboard visibility toggle] --> AppState[App leaderboard query state]
    AppState --> Client[web online/leaderboard client]
    Client --> Route[/GET /leaderboard?metric&period&limit&visibility/]
    Route --> Service[queryLeaderboardEntries]
    Service --> Repo[listRuns(query)]
    Repo --> Verified[verified-only filter]
    Repo --> All[all rows filter]
```

Key decisions:
- Add a single query field (visibility) rather than a second endpoint so metric/limit behavior stays shared.
- Keep `verified` as the backend default for compatibility, but have the web caller explicitly request `all`.
- Preserve deterministic ordering regardless of visibility; `all` should simply widen the candidate set.

```ts
interface LeaderboardQuery {
  metric: LeaderboardQueryMetric;
  period: "all-time";
  limit: number;
  visibility: "verified" | "all";
}
```

## Phase 1 — API query support for verification visibility

**Goal**: let the backend serve either verified-only rows or all rows without adding a parallel leaderboard route.

### Step 1.1 — Add typed leaderboard visibility query support

- Files: `packages/server/src/leaderboard/queries.ts`, `packages/server/src/leaderboard/repository.ts`, `packages/server/src/leaderboard/service.ts`, `packages/server/src/routes/leaderboard.ts`, related types if needed.
- Parse a new `visibility` query param with allowed values `verified` and `all`, defaulting to `verified` when omitted.
- Thread the parsed visibility through repository reads so in-memory and Drizzle implementations can either keep the verified-only filter or return both verified/unverified runs.
- Include the selected visibility in the route response payload so clients can validate/cache it safely.
- Acceptance: `GET /leaderboard` supports `visibility=verified|all`; omitting the field still behaves like verified-only.

### Step 1.2 — Add backend coverage for verified-only vs all responses

- Files: `packages/server/src/routes/leaderboard.test.ts`, `packages/server/src/leaderboard/drizzle-repository.test.ts`, plus any focused query tests if helpful.
- Cover both visibility modes using a mixed dataset containing verified and unverified rows.
- Assert that verified-only remains the default and that `visibility=all` returns both categories in deterministic rank order.
- Acceptance: targeted server tests prove the new query shape and mixed-result behavior.

## Phase 2 — Frontend leaderboard toggle

**Goal**: expose the new backend option in the start-screen leaderboard dialog without changing gameplay or submission flows.

### Step 2.1 — Extend the web leaderboard client and app state

- Files: `packages/web/src/online/leaderboard.ts`, `packages/web/src/App.tsx`, any touched types.
- Add a typed visibility option to leaderboard fetches and responses, defaulting the web start-screen dialog to `all`.
- Cache leaderboard results/errors/loading state by both metric and visibility so switching the new toggle does not cross-contaminate data.
- Acceptance: frontend can request `visibility=all` explicitly and keeps result state isolated per query combination.

### Step 2.2 — Add the leaderboard dialog toggle and tests

- Files: `packages/web/src/ui/start/LeaderboardDialog.tsx`, `packages/web/src/ui/start/StartScreen.tsx`, `packages/web/src/online/leaderboard.test.ts`, `packages/web/src/App.test.tsx`.
- Add a small toggle (for example, Verified / All) to the dialog controls and wire it into the existing modal state.
- Keep the initial selection on `all` for now, and ensure retry/loading/empty states reference the active visibility correctly.
- Acceptance: web tests prove the dialog opens in all-runs mode, can switch back to verified-only, and fetches/caches each combination correctly.

## Phase 3 — Verification and delivery

**Goal**: finish the change cleanly and leave an auditable plan trail.

### Step 3.1 — Run targeted checks and finalize the plan

- Files: `.agents/plans/051-leaderboard-verification-visibility-toggle.md` plus any docs only if behavior needs lightweight mention.
- Run the relevant server and web test commands for the touched files/packages.
- Update this plan’s checklist/status/updated date to reflect completed work.
- Prepare the branch for a PR with a concise summary of the API and frontend behavior change.
- Acceptance: targeted tests pass and the branch is ready to push/open as a pull request.

## References

- [Plan 050 — Verified Leaderboard Replay Chain](./050-verified-leaderboard-replay-chain.md)
- [packages/server/src/routes/leaderboard.ts](../../packages/server/src/routes/leaderboard.ts)
- [packages/server/src/leaderboard/repository.ts](../../packages/server/src/leaderboard/repository.ts)
- [packages/web/src/online/leaderboard.ts](../../packages/web/src/online/leaderboard.ts)
- [packages/web/src/ui/start/LeaderboardDialog.tsx](../../packages/web/src/ui/start/LeaderboardDialog.tsx)

## Changelog

- 2026-07-26 — Created plan 051 for leaderboard verification visibility toggles across server and web.
- 2026-07-26 — Completed API visibility filtering, frontend toggle defaulting to all, and targeted verification/typecheck runs.
