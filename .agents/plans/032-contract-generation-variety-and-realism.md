---
name: Contract Generation Variety and Realism
description: Improve contract generation by introducing real-world enterprise/hyperscale workload profiles, varied durations, and realistic nomenclature.
status: completed
created: 2026-05-10
updated: 2026-05-10
---

## Progress

- [x] **Phase 1 — Expanded Workload Profiles and Naming**
  - [x] 1.1 Update workload themes in `generator.ts` to reflect modern real-world segments (e.g., AI Training, AI Inference, HPC, Enterprise OLTP, Cold Storage, CDN, Video Transcoding).
  - [x] 1.2 Implement a larger, more realistic dictionary of company names and project codenames for generative contract naming.
  - [x] 1.3 Adjust resource weights (vCPU, RAM, Storage, GPU) per theme to accurately reflect the resource bottlenecks of each workload.
- [x] **Phase 2 — Variable Contract Durations and Urgency**
  - [x] 2.1 Refactor contract duration from a fixed value (e.g., 6 ticks) to a randomized range based on workload type (short burst jobs vs. long-term multi-year enterprise commitments).
  - [x] 2.2 Rebalance payout scaling to account for variable durations (long-term contracts offer lower per-tick revenue but higher stability).
- [x] **Phase 3 — Integration and Market Refresh**
  - [x] 3.1 Update the market generation logic to spawn an appropriate mix of short-term and long-term contracts.
  - [x] 3.2 Ensure tests pass and the contract market correctly surfaces the new variations and names.

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
- Replace existing generic themes with specific industry equivalents: `ai_training`, `ai_inference`, `hpc_simulation`, `enterprise_db`, `cold_storage`, `cdn_edge`, `video_render`.
- Assign realistic resource weights to each (e.g., `ai_training` = 90% GPU, `cold_storage` = 95% Storage, 5% CPU).
- Acceptance: Themes are updated, and type checks pass.

### Step 1.2 — Expand generative nomenclature

- File: `packages/game-logic/src/contracts/generator.ts`
- Add realistic corporate prefixes (e.g., "Apex", "Global", "Quantum") and project suffixes (e.g., "Data Lake", "LLM Cluster", "Failover Array").
- Update the name generation logic to use these arrays.
- Acceptance: Generated names look like "Quantum LLM Cluster" rather than generic names.

## Phase 2 — Variable Contract Durations and Urgency

**Goal**: Move away from fixed-duration contracts to a system with short bursts and long commitments.

### Step 2.1 — Implement variable duration generation

- File: `packages/game-logic/src/contracts/generator.ts`
- Update `generateContract` to randomize duration based on the selected theme's `durationRange` instead of a hardcoded 6 ticks.
- Acceptance: Calling `generateContract` yields contracts with varying `duration` properties.

### Step 2.2 — Rebalance payout formulas

- File: `packages/game-logic/src/contracts/generator.ts`
- Adjust the pricing logic. Longer duration contracts should apply a "bulk discount" to the per-tick revenue, making them safer but slightly less profitable per-tick than short-term rush jobs.
- Acceptance: Financial output of generator tests reflects the discount curve.

## Phase 3 — Integration and Market Refresh

**Goal**: Ensure the rest of the game logic and test suite respects the new generator rules.

### Step 3.1 — Update tests

- File: `packages/game-logic/src/contracts/contracts.test.ts`
- Fix any tests that hardcode expectations about contract names, exact durations (like expecting exactly 6 ticks), or specific theme IDs.
- Acceptance: `npm run test -w @datacenter-tycoon/game-logic` passes completely.

## References

- [AGENTS.md](../AGENTS.md)
- Game Balance Tuning Skill

## Changelog

- 2026-05-10 — created.
