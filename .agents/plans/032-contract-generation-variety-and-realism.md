---
name: Contract Generation Variety and Realism
description: Improve contract generation by introducing real-world enterprise/hyperscale workload profiles, varied durations, and realistic nomenclature.
status: started
created: 2026-05-10
updated: 2026-05-10
---

## Progress

- [x] **Phase 1 — Expanded Workload Profiles and Naming**
  - [x] 1.1 Update workload themes in `generator.ts` to reflect modern real-world segments and rebalance resource weights.
  - [x] 1.2 Implement a larger, more realistic dictionary of company names and project codenames for generative contract naming.
- [ ] **Phase 2 — Variable Contract Durations and Urgency**
  - [x] 2.1 Refactor generated contract terms to use workload-specific duration ranges instead of a single default offer profile.
  - [ ] 2.2 Rebalance payout scaling to account for variable durations so long-term contracts trade peak monthly yield for stability.
- [ ] **Phase 3 — Integration and Market Refresh**
  - [ ] 3.1 Update market generation/tests so the refreshed offer pool surfaces a deliberate mix of short-term and long-term contracts with the new naming variety.

## Overview

Currently, contracts are generated with limited variety, relying on 6 basic themes and a fixed duration of 6 ticks. This plan aims to dramatically improve the immersion and strategic depth of the game by modeling real-world data center workloads (like Generative AI Training vs Inference, Cold Storage, and HPC). Contracts will feature realistic company names, accurate resource ratios (e.g. storage-heavy vs compute-heavy), and variable durations that force the player to balance quick cash grabs against long-term stable recurring revenue.

## Architecture

No new architectural layers are required. We will modify the configuration arrays and generation functions within `packages/game-logic/src/contracts/generator.ts`.

Key conceptual changes:
- `generator.ts` will hold expanded `WORKLOAD_THEMES` defining minimum/maximum tick durations and distinct resource profile weights.
- The `generateContract` function will calculate payout not just by raw capacity but also modulated by duration (volume discounts for long-term SLAs).

```ts
// Example illustrative changes to theme definition
interface WorkloadTheme {
  id: string;
  name: string;
  weights: { vCpu: number; memoryGb: number; storageGb: number; gpuFlops: number };
  durationRange: [number, number]; // [minTicks, maxTicks]
  prefixes: string[];
  suffixes: string[];
}
```

## Phase 1 — Expanded Workload Profiles and Naming

**Goal**: Make the types of contracts that appear fundamentally more varied and aligned with real-world datacenter demands.

### Step 1.1 — Update workload themes and resource weights

- File: `packages/game-logic/src/contracts/generator.ts`
- Replace the generic workload themes with modern datacenter demand segments such as `ai_training`, `ai_inference`, `hpc_simulation`, `enterprise_db`, `cold_storage`, `cdn_edge`, and `video_render`.
- Rebalance resource weights so each theme clearly emphasizes its real bottleneck (for example, GPU-heavy training versus storage-dominant archive work).
- Acceptance: `npm run typecheck -w @datacenter-tycoon/game-logic` passes and generated contracts use the new theme vocabulary.

### Step 1.2 — Expand generative nomenclature

- File: `packages/game-logic/src/contracts/generator.ts`, `packages/game-logic/src/contracts/contracts.test.ts`
- Add realistic corporate prefixes plus project codenames and delivery nouns (for example, "Quantum Atlas LLM Cluster").
- Update name generation to build varied enterprise-sounding contract titles instead of reusing the theme label as the public name.
- Acceptance: tests prove generated names draw from the expanded dictionary and remain deterministic.

## Phase 2 — Variable Contract Durations and Urgency

**Goal**: Move away from one-size-fits-all offers to a system with short bursts and long commitments.

### Step 2.1 — Implement workload-specific duration ranges

- File: `packages/game-logic/src/contracts/generator.ts`, `packages/game-logic/src/contracts/contracts.test.ts`
- Add per-theme duration metadata and use it to derive `termMonths`, while preserving deterministic urgency rolls and offer-expiry behavior.
- Ensure short-lived workloads (for example, render jobs) stay brief while enterprise database or archive work can stretch into long commitments.
- Acceptance: seeded generator tests show varied term lengths and keep low-difficulty GPU gating intact.

### Step 2.2 — Rebalance payout formulas for longer terms

- File: `packages/game-logic/src/contracts/generator.ts`, `packages/game-logic/src/contracts/contracts.test.ts`, `packages/game-logic/src/economy/constants.ts`, `packages/game-logic/src/catalog/catalog.test.ts`, `CHANGELOG.md`
- Adjust pricing so long-duration contracts earn a lower monthly rate than comparable short-term work while still remaining attractive in total value.
- Bump balance metadata/documentation for the new economic curve.
- Acceptance: tests capture the new duration discount and `npm run test -w @datacenter-tycoon/game-logic` passes.

## Phase 3 — Integration and Market Refresh

**Goal**: Ensure the contract market actually surfaces the new variety instead of leaving it to chance.

### Step 3.1 — Shape refreshed offer pools and lock in regression coverage

- File: `packages/game-logic/src/contracts/generator.ts`, `packages/game-logic/src/contracts/market.ts`, `packages/game-logic/src/contracts/contracts.test.ts`, `.agents/plans/032-contract-generation-variety-and-realism.md`
- Add a deterministic market-mix helper so refreshes intentionally include a blend of shorter and longer commitments across the available offer slots.
- Update/add tests that cover varied names, duration bands, and stable market refresh behavior.
- Acceptance: `npm run test -w @datacenter-tycoon/game-logic` passes and market samples consistently expose both short- and long-term offers.

## References

- [AGENTS.md](../AGENTS.md)
- Game Balance Tuning Skill

## Changelog

- 2026-05-10 — created.
- 2026-05-10 — corrected the progress checklist and step breakdown before implementation; the original draft had been pre-marked complete without matching code changes.
