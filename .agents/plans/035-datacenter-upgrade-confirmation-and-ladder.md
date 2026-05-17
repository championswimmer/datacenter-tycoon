---
name: Datacenter Upgrade Confirmation and Ladder UI
description: Show canonical datacenter upgrade ladders in the web UI and require an explicit cost confirmation before spending capex on upgrades.
status: started
created: 2026-05-17
updated: 2026-05-17
owner: game-logic, web
---

## Progress

- [x] **Phase 1 — Canonical upgrade ladder summaries**
  - [x] 1.1 Extend the game-logic datacenter upgrade query with ladder-node status metadata for every track node
  - [x] 1.2 Add regression tests for default, partially upgraded, and maxed upgrade tracks
- [x] **Phase 2 — Web ladder visualization**
  - [x] 2.1 Render the upgrade ladder in `UpgradePanel` so each track shows completed, current, next, and locked nodes
  - [x] 2.2 Add/update web tests and styles for the ladder presentation across desktop and narrow layouts
- [x] **Phase 3 — Upgrade confirmation flow**
  - [x] 3.1 Add a confirmation modal that previews capex, upkeep delta, and resulting cash before dispatching `UpgradeDatacenter`
  - [x] 3.2 Wire upgrade buttons to open the modal, require explicit confirmation, and block unaffordable upgrades in the UI
  - [x] 3.3 Add interaction coverage for confirm, cancel, and insufficient-funds upgrade states
- [ ] **Phase 4 — Verification and plan wrap-up**
  - [ ] 4.1 Run targeted game-logic/web tests plus typecheck for the touched packages
  - [ ] 4.2 Mark the plan complete and capture any follow-up notes if more upgrade UX work remains

## Overview

Datacenter upgrades currently execute immediately when the player clicks an upgrade button, which makes it too easy to spend a large amount of money without seeing the capex cost first. The web UI also only shows the current node and the immediate next step, so players cannot easily understand the full upgrade ladder for cooling, networking, or onsite generation.

This plan adds a canonical ladder summary in `game-logic`, then uses that summary in the web UI to visualize track progression and to drive a confirmation modal that previews the spend before the reducer runs. The goal is to make upgrade decisions legible, intentional, and consistent with the existing query-boundary architecture.

## Architecture

```mermaid
flowchart LR
    Catalog[Upgrade catalog / track definitions]
    Query[summarizeDatacenterUpgradeViewFromState]
    Selector[Web selectors]
    Panel[UpgradePanel ladder UI]
    Modal[Upgrade confirmation modal]
    Dispatch[UpgradeDatacenter action]
    Reducer[game-logic reduce()]

    Catalog --> Query
    Query --> Selector
    Selector --> Panel
    Panel --> Modal
    Modal --> Dispatch
    Dispatch --> Reducer
```

Key decisions:
- The **ladder state stays canonical in `game-logic`** so the web UI does not reconstruct node ordering or upgrade reachability from raw catalog data.
- The web package keeps **confirmation modal visibility as UI-local state**, but the modal content should come from canonical upgrade summary data plus the player cash selector.
- Upgrades remain **sequential**. The ladder should explicitly show completed nodes, the current node, the immediate next purchasable node, and future locked nodes.
- The confirmation flow should prevent accidental spending by requiring an explicit second click before dispatching the reducer action.

Illustrative ladder shape:

```ts
export interface DatacenterUpgradeTrackLadderNodeView extends DatacenterUpgradeNodeView {
  index: number;
  status: "completed" | "current" | "available" | "locked";
}
```

## Phase 1 — Canonical upgrade ladder summaries

**Goal**: expose enough read-only upgrade metadata for the web UI to render an accurate ladder without duplicating catalog logic.

### Step 1.1 — Extend the datacenter upgrade query view

- Files: `packages/game-logic/src/query/datacenters.ts`, `packages/game-logic/src/index.ts` if needed
- Add a per-node ladder view for every upgrade track node, including stable status metadata derived from the datacenter’s current progress.
- Preserve the existing current/next/max affordances so current consumers keep working while the ladder ships.
- Acceptance: `summarizeDatacenterUpgradeViewFromState()` returns ordered nodes for each track with canonical statuses for current, completed, immediate-next, and locked entries.

### Step 1.2 — Add game-logic regression tests for ladder summaries

- Files: `packages/game-logic/src/query/datacenters.test.ts`
- Cover default garage datacenters, partially upgraded tracks, and maxed tracks.
- Assert node ordering and statuses so the web UI can trust the canonical summary.
- Acceptance: `npm run test -w @datacenter-tycoon/game-logic -- src/query/datacenters.test.ts` passes.

## Phase 2 — Web ladder visualization

**Goal**: make the full upgrade path visible inside the datacenter resources screen.

### Step 2.1 — Render ladder states in `UpgradePanel`

- Files: `packages/web/src/ui/stats/UpgradePanel.tsx`
- Show each track’s ordered ladder nodes with clear completed/current/next/locked treatment and concise labels for node count and current reach.
- Keep the existing infrastructure summary cards and high-level fabric/upkeep badges.
- Acceptance: the resources view shows the full ladder for cooling, network, and onsite generation using only selector data.

### Step 2.2 — Add styles and rendering coverage

- Files: `packages/web/src/ui/stats/UpgradePanel.module.css`, `packages/web/src/ui/stats/PowerView.test.tsx` or a dedicated `UpgradePanel.test.tsx`
- Add responsive ladder styling that fits the existing neon control-center theme.
- Verify the ladder shows track progress correctly for default and upgraded datacenters.
- Acceptance: `npm run test -w @datacenter-tycoon/web -- src/ui/stats/PowerView.test.tsx` (or equivalent targeted web test) passes.

## Phase 3 — Upgrade confirmation flow

**Goal**: require an explicit confirmation step before capex is spent on a datacenter upgrade.

### Step 3.1 — Add an upgrade confirmation modal

- Files: `packages/web/src/ui/stats/UpgradePanel.tsx`, new modal/style file(s) under `packages/web/src/ui/stats/`
- Introduce a dialog that previews the selected track, current node, target node, capex spend, upkeep delta, and post-purchase cash.
- Reuse the project’s existing modal accessibility pattern (`role="dialog"`, escape/backdrop close, focus handoff).
- Acceptance: clicking an upgrade button opens a modal instead of dispatching immediately.

### Step 3.2 — Confirm explicitly and block unaffordable upgrades

- Files: `packages/web/src/ui/stats/UpgradePanel.tsx`
- Dispatch `UpgradeDatacenter` only from the modal’s confirm action.
- Disable the upgrade CTA when the player cannot afford the capex and explain the shortfall in the modal/button copy.
- Acceptance: cancelling leaves state unchanged; confirming applies the upgrade once; unaffordable upgrades cannot be confirmed.

### Step 3.3 — Add web interaction regression coverage

- Files: `packages/web/src/ui/stats/PowerView.test.tsx` or a dedicated `UpgradePanel.test.tsx`
- Add tests for opening the modal, cancelling, confirming, and seeing insufficient-funds messaging.
- Acceptance: targeted web tests cover the full confirmation flow and prevent regressions back to one-click spending.

## Phase 4 — Verification and plan wrap-up

**Goal**: verify the touched packages and leave the plan in a resumable completed state.

### Step 4.1 — Run targeted verification

- Files: n/a
- Run the relevant `game-logic` and `web` tests plus package typechecks for touched code.
- Acceptance: the targeted commands pass and any failures are resolved before closing the work.

### Step 4.2 — Mark the plan complete

- Files: `.agents/plans/035-datacenter-upgrade-confirmation-and-ladder.md`
- Tick all completed boxes, set `status: completed`, and capture follow-up notes if any additional upgrade UX ideas are intentionally deferred.
- Acceptance: the plan file accurately reflects the shipped implementation and is ready for a future agent to audit.

## References

- [Root AGENTS.md](../../AGENTS.md)
- [game-logic AGENTS.md](../../packages/game-logic/AGENTS.md)
- [web AGENTS.md](../../packages/web/AGENTS.md)
- `packages/game-logic/src/query/datacenters.ts`
- `packages/web/src/ui/stats/UpgradePanel.tsx`
- `packages/web/src/ui/stats/PowerView.tsx`

## Changelog

- 2026-05-17 — created.
