---
name: Cooling Headroom & Rack Failure Curve Rebalance
description: Increase datacenter cooling headroom and replace the linear rack-failure curve with a year-anchored supra-linear progression.
status: started
created: 2026-05-08
updated: 2026-05-08
owner: game-logic
---

## Progress

- [x] **Phase 1 — Balance targets and constants**
  - [x] 1.1 Define the new rack-failure curve anchors and tunable exponent in `packages/game-logic/src/balance/maintenance.ts`
  - [x] 1.2 Capture cooling rebalance expectations in catalog/capacity tests before or alongside catalog edits
- [x] **Phase 2 — Datacenter cooling rebalance**
  - [x] 2.1 Raise `coolingCapacityBtuPerHr` across the starter datacenter blueprints in `packages/game-logic/src/catalog/datacenters.ts`
  - [x] 2.2 Update catalog and placement tests to lock in the new cooling headroom
- [ ] **Phase 3 — Supra-linear rack failure progression**
  - [ ] 3.1 Replace the linear `rackFailureChance()` formula in `packages/game-logic/src/sim/maintenance.ts`
  - [ ] 3.2 Extend maintenance tests to verify year-1, year-6, clamp, and acceleration behavior
  - [ ] 3.3 Confirm the monthly tick still uses the new curve deterministically without changing repair semantics
- [ ] **Phase 4 — Versioning and docs**
  - [ ] 4.1 Bump `BALANCE_VERSION` and update any balance-sensitive assertions and changelog entries
  - [ ] 4.2 Update README/player-facing documentation to describe the new cooling headroom and failure progression

## Overview

This plan rebalances two related pressure points in the core simulation: datacenter cooling runs out too quickly for normal expansion, and rack failures ramp too harshly too early because the current age curve is linear and tops out by year 3. The target outcome is a slightly more forgiving cooling budget across all datacenter blueprints plus a more realistic reliability curve that reaches `2%` at year 1, `60%` at year 6, and accelerates later in a rack’s life instead of rising evenly every month.

The work stays inside `game-logic` balance and simulation modules so the rules remain deterministic, serializable, and shared by every frontend. Because these changes affect replays, saves, exported constants, and documented player expectations, the plan also includes versioning, regression coverage, and doc updates.

## Architecture

```mermaid
flowchart LR
    Catalog[Datacenter catalog]\n(coolingCapacityBtuPerHr) --> Placement[canPlaceRack / resource budget checks]
    Balance[maintenance balance constants]\n(year-1 anchor, year-6 cap, curve exponent) --> FailureCurve[rackFailureChance(ageMonths)]
    FailureCurve --> Tick[monthly tick failure roll]
    Tick --> RackHealth[rack repairing / healthy states]
    Placement --> PlayerExperience[build-out headroom]
    RackHealth --> PlayerExperience
```

Key decisions:

- Cooling remains a **blueprint-level** property on `DatacenterSpec`; this is a pure rebalance, not a new subsystem.
- Failure progression remains a **derived pure function of rack age** so tick behavior stays deterministic and testable.
- The new curve should be **anchor-based** rather than magic-number-only: year 1 must evaluate to `2%`, year 6 must evaluate to `60%`, and intermediate growth should be monotonic and supra-linear.
- Repair timing and staffing should stay unchanged in this pass unless tests show the new failure curve makes repairs disproportionately punishing.

```ts
export const RACK_FAILURE_YEAR_ONE_CHANCE = 0.02;
export const RACK_FAILURE_MAX_CHANCE = 0.6;
export const RACK_FAILURE_MAX_AGE_MONTHS = 72;
export const RACK_FAILURE_CURVE_EXPONENT = 1.5; // exact value to validate in tests

export function rackFailureChance(ageMonths: number): number {
  // preserve clamp behavior; hit 2% at 12 months and 60% at 72 months
}
```

## Phase 1 — Balance targets and constants

**Goal**: define explicit numeric targets for both rebalances before changing runtime behavior.

### Step 1.1 — Define failure-curve anchors and tunables

- File: `packages/game-logic/src/balance/maintenance.ts`
- Replace the current “linear to 50% by 36 months” assumptions with explicit balance constants for:
  - year-1 failure chance (`2%`)
  - max failure chance (`60%`)
  - max age horizon (`72` months / year 6)
  - a supra-linear curve control such as an exponent
- Keep all tunable numbers in the balance module so simulation code does not gain new inline magic numbers.
- Acceptance: maintenance balance exports are sufficient to describe the new curve without hardcoded literals in `sim/maintenance.ts`.

### Step 1.2 — Capture cooling rebalance expectations in tests

- File: `packages/game-logic/src/catalog/catalog.test.ts`, optionally `packages/game-logic/src/entities/capacity.test.ts`
- Add or refine assertions that describe the intended result of the cooling pass: each starter datacenter should have more thermal headroom than before, while air-cooled sites must still reject tier-3 racks on cooling-type grounds.
- Prefer assertions about meaningful ranges/headroom over brittle copy-pastes of every raw number unless exact numbers are the chosen design.
- Acceptance: tests clearly fail if cooling capacities regress back to the current too-tight values.

## Phase 2 — Datacenter cooling rebalance

**Goal**: make normal growth less cooling-constrained across garage, warehouse, and hyperscale blueprints.

### Step 2.1 — Raise starter datacenter cooling capacities

- File: `packages/game-logic/src/catalog/datacenters.ts`
- Increase `coolingCapacityBtuPerHr` for `garage`, `warehouse`, and `hyperscale` by modest amounts so players can place a few more typical racks before cooling becomes the limiting resource.
- Preserve the existing datacenter identities: garage remains constrained, warehouse remains mid-game, hyperscale remains strongest, and liquid cooling still matters for high-tier hardware.
- Do not change power, bandwidth, slots, or cooling type in this step unless a targeted adjustment is needed to keep the catalog internally coherent.
- Acceptance: the updated catalog provides visibly more cooling headroom across all three blueprint tiers without invalidating existing placement rules.

### Step 2.2 — Lock the new headroom into regression tests

- File: `packages/game-logic/src/catalog/catalog.test.ts`, `packages/game-logic/src/entities/capacity.test.ts`
- Update catalog tests for any exact cooling values or ratios that are expected to change.
- Add at least one placement-level test showing a datacenter build that used to be cooling-blocked now succeeds, while a clearly over-budget placement still fails with `insufficient_cooling`.
- Acceptance: `npm run test -w @datacenter-tycoon/game-logic` proves the rebalance changed real placement outcomes, not just catalog constants.

## Phase 3 — Supra-linear rack failure progression

**Goal**: make early-life racks more reliable and late-life racks decline more sharply.

### Step 3.1 — Replace the linear failure formula

- File: `packages/game-logic/src/sim/maintenance.ts`
- Rework `rackFailureChance(ageMonths)` so it:
  - stays clamped and deterministic
  - reaches `2%` at `12` months
  - reaches `60%` at `72` months
  - grows supra-linearly between those anchors rather than linearly
- Use a simple pure mathematical curve (for example, normalized exponent growth after the year-1 anchor) that is easy to reason about and test.
- Acceptance: the helper code expresses the two anchor points directly and contains no randomness or stateful behavior.

### Step 3.2 — Extend maintenance tests for anchors and acceleration

- File: `packages/game-logic/src/sim/maintenance.test.ts`
- Replace the current linear-curve assertions with tests for:
  - zero/near-zero early age behavior as designed
  - exact or tolerance-based `2%` at year 1
  - exact or tolerance-based `60%` at year 6
  - clamp behavior beyond year 6
  - supra-linear growth (for example, later-year deltas are larger than earlier-year deltas)
- Keep the existing repair-speed and repair-completion tests unless the balance change requires more coverage.
- Acceptance: tests fail if the curve regresses back to linear or misses either anchor.

### Step 3.3 — Verify deterministic tick integration

- File: `packages/game-logic/src/sim/tick.ts`, `packages/game-logic/src/sim/tick.test.ts` if needed
- Confirm the monthly failure roll still consumes the same helper in a stable seeded order and that changing the curve does not alter repair-state semantics.
- Add or update one tick-level test if helper-level coverage alone is insufficient to prove the curve is wired through live simulation.
- Acceptance: identical seed + action history still yields deterministic outcomes under the new balance rules.

## Phase 4 — Versioning and docs

**Goal**: make the rebalance visible to saves, tests, and player-facing documentation.

### Step 4.1 — Bump balance version and update release notes

- File: `packages/game-logic/src/economy/constants.ts`, `packages/game-logic/src/catalog/catalog.test.ts`, `CHANGELOG.md`
- Increment `BALANCE_VERSION` because this changes simulation balance for ongoing saves/replays.
- Update any tests that assert the old version number.
- Add a changelog note summarizing the cooling buff and slower-early / harsher-late failure curve.
- Acceptance: balance-version assertions pass and the change is recorded for future migration or release work.

### Step 4.2 — Update README and player-facing wording

- File: `packages/game-logic/README.md`, plus any UI/help text that mentions the old `50% over 36 months` linear model if encountered during implementation
- Rewrite maintenance docs to describe the new year-1/year-6 curve and the fact that aging now accelerates later in a rack’s life.
- Update cooling-related docs/examples if they rely on now-outdated blueprint numbers.
- Acceptance: no maintained documentation still describes the old linear `0 → 50% over 36 months` behavior.

## References

- [Root AGENTS.md](../../AGENTS.md)
- [game-logic AGENTS.md](../../packages/game-logic/AGENTS.md)
- [015-rack-aging-failures-and-maintenance.md](./015-rack-aging-failures-and-maintenance.md)
- [021-reliability-score-and-contract-slas.md](./021-reliability-score-and-contract-slas.md)
- [game-balance-tuning skill](../skills/game-balance-tuning/SKILL.md)
- [planning skill](../skills/planning/SKILL.md)

## Changelog

- 2026-05-08 — created.
