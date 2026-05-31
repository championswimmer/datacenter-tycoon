---
name: Start Screen Leaderboard Metric Tabs
description: Expand the start-screen leaderboard dialog with metric tabs so players can switch between money, revenue, servers, and capacity rankings before starting a run.
status: completed
created: 2026-05-31
updated: 2026-05-31
owner: web
---

## Progress

- [x] **Phase 1 — Metric-aware leaderboard state and client plumbing**
  - [x] 1.1 Add a shared metric-tab model and typed query defaults for the start-screen leaderboard
  - [x] 1.2 Update app state to fetch and cache leaderboard results by metric, including retries
- [x] **Phase 2 — Dialog tab UI and rendering**
  - [x] 2.1 Add a tab strip to the leaderboard dialog for money, revenue, servers, and capacity metrics
  - [x] 2.2 Update leaderboard dialog rendering to use the active metric and keep loading/error/empty states clear during tab switches
  - [x] 2.3 Add responsive styles for the tab strip and active-state presentation
- [x] **Phase 3 — Regression coverage and plan completion**
  - [x] 3.1 Add focused web tests for metric-specific queries and tab switching
  - [x] 3.2 Run targeted validation and mark the plan completed

## Overview

The start-screen leaderboard dialog currently shows only the cash leaderboard. Players should be able to switch between multiple leaderboard metrics without leaving the dialog so they can compare money, revenue, server count, and capacity-focused rankings before starting a run. This change stays within the existing frontend/server contract by varying the existing `GET /leaderboard` metric query and caching results per metric to avoid unnecessary repeat requests.

## Architecture

```mermaid
flowchart LR
    Tabs[Metric tabs in dialog] --> AppState[App leaderboard UI state]
    AppState --> Cache[(Results by metric)]
    AppState --> QueryClient[fetchLeaderboard(metric)]
    QueryClient --> Server[/GET /leaderboard?metric=.../]
    Cache --> Dialog[LeaderboardDialog rows]
```

Key decisions:
- Reuse the current `GET /leaderboard` endpoint; switching tabs only changes the `metric` query param.
- Keep the tab model in the web layer as presentational UI state; gameplay logic remains untouched.
- Cache fetched results by metric inside `App.tsx` so reopening a visited tab is instant.
- Show the previous metric result only for the active metric; each tab owns its own loading/error lifecycle so the dialog stays predictable.

Illustrative model:

```ts
const START_SCREEN_LEADERBOARD_TABS = [
  { metric: "money", label: "Cash" },
  { metric: "cumulativeRevenue", label: "Revenue" },
  { metric: "totalServers", label: "Servers" },
  { metric: "totalCapacity", label: "Capacity" },
] as const;
```

## Phase 1 — Metric-aware leaderboard state and client plumbing

**Goal**: make the app controller capable of loading different leaderboard metrics on demand.

### Step 1.1 — Add the shared metric-tab model

- Files: `packages/web/src/online/leaderboard.ts`, `packages/web/src/ui/start/LeaderboardDialog.tsx`
- Add exported tab metadata/constants for the start-screen leaderboard metrics and labels.
- Keep `fetchLeaderboard` typed against the existing metric union.
- Acceptance: the dialog and app can both import the same metric definitions without duplicating labels.

### Step 1.2 — Update app state for metric-based loading

- File: `packages/web/src/App.tsx`
- Track the active leaderboard metric plus cached results/errors per metric.
- Fetch the selected metric when opening the dialog or switching to an unfetched tab.
- Keep retry behavior scoped to the active metric.
- Acceptance: changing the active metric issues a query for that metric and preserves already-fetched results.

## Phase 2 — Dialog tab UI and rendering

**Goal**: add a compact, usable metric switcher inside the existing leaderboard modal.

### Step 2.1 — Add the metric tab strip

- File: `packages/web/src/ui/start/LeaderboardDialog.tsx`
- Render buttons/tabs for cash, revenue, servers, and capacity metrics.
- Highlight the active tab and expose accessible pressed/selected state.
- Acceptance: users can switch tabs with pointer or keyboard and the active tab is obvious.

### Step 2.2 — Update dialog rendering for active metric state

- File: `packages/web/src/ui/start/LeaderboardDialog.tsx`
- Use the active tab metadata for headings and formatting.
- Keep loading, error, empty, and populated states scoped to the selected metric.
- Acceptance: tab switching updates the dialog body and never shows the wrong metric label/value pairing.

### Step 2.3 — Add tab strip styling

- File: `packages/web/src/ui/start/LeaderboardDialog.module.css`
- Add responsive styling for the tab row, overflow behavior, and active/inactive states.
- Preserve minimum touch-target sizing and the existing modal visual language.
- Acceptance: the tab row remains usable on mobile and desktop.

## Phase 3 — Regression coverage and plan completion

**Goal**: lock in the new behavior and complete the plan cleanly.

### Step 3.1 — Add metric-tab tests

- Files: `packages/web/src/online/leaderboard.test.ts`, `packages/web/src/App.test.tsx`
- Add tests for explicit metric queries and for switching tabs in the dialog.
- Confirm cached metrics do not refetch when revisited during the same app session.
- Acceptance: targeted web tests prove the start-screen leaderboard can switch metrics safely.

### Step 3.2 — Validate and finalize

- Files: `.agents/plans/048-start-screen-leaderboard-metric-tabs.md`
- Run relevant web test/build/typecheck commands and update the checklist/status/changelog.
- Acceptance: the plan is marked completed with validation notes.

## References

- `AGENTS.md`
- `packages/web/AGENTS.md`
- `.agents/plans/047-start-screen-leaderboard-dialog.md`
- `packages/web/src/App.tsx`
- `packages/web/src/ui/start/LeaderboardDialog.tsx`
- `packages/server/src/leaderboard/queries.ts`

## Changelog

- 2026-05-31 — created.
- 2026-05-31 — completed implementation with metric tabs, per-metric cache/loading state, and regression coverage for tab switching.
