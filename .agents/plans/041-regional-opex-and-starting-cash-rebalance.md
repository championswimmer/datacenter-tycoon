---
name: Regional OpEx and Starting Cash Rebalance
description: Increase starting cash and derive regional power/wage OpEx from research-backed multipliers.
status: started
created: 2026-05-24
updated: 2026-05-24
owner: game-logic
---

## Progress

- [x] **Phase 1 — Research-backed balance model**
  - [x] 1.1 Add regional OpEx multiplier constants and references
  - [x] 1.2 Derive region catalog power and wage values from multipliers
  - [x] 1.3 Add unit tests for effective regional OpEx values
- [x] **Phase 2 — Starting cash runway**
  - [x] 2.1 Increase Easy and Hard starting cash
  - [x] 2.2 Update new-game and difficulty tests
  - [x] 2.3 Bump balance version and document the rebalance
- [x] **Phase 3 — OpEx impact validation**
  - [x] 3.1 Extend unit-economics audit coverage for regional OpEx
  - [x] 3.2 Add scenario validation for early-game cash runway
  - [x] 3.3 Tune target values if validation shows broken payback or runway
- [ ] **Phase 4 — Player-facing surfacing**
  - [x] 4.1 Surface regional power and wage differences in CLI region/map views
  - [x] 4.2 Surface regional power and wage differences in web region/map views
  - [ ] 4.3 Run package and boundary checks

## Overview / Motivation

Current starting cash still feels too tight, especially after recent rack and contract economy rebalances. At the same time, region selection should matter more: a datacenter in Dublin, Frankfurt, Tokyo, Singapore, São Paulo, or Dubai should have meaningfully different monthly OpEx from a datacenter in Ashburn or Boardman. This plan introduces explicit research-backed regional electricity and wage multipliers, derives the catalog's effective `powerCostPerKwh` and `staffWage` from those multipliers, and raises Easy/Hard starting cash so players can survive early setup and the first few monthly ticks.

The player-facing design goal is simple: **power costs should track real regional energy-price differences, while technician wages should follow the requested gameplay identity where the USA is the most expensive labor market, Europe is mid/high, Asia is cheaper than Europe, and Brazil/Dubai are cheaper still**. The exact numbers are balance inputs, not a simulation of payroll law or utility tariffs.

## Architecture

```mermaid
flowchart LR
    Sources[Research sources\nEIA/BLS/Eurostat/KPMG/DataX/etc.] --> Profiles[REGIONAL_OPEX_PROFILES]
    Profiles --> Helpers[regional OpEx helpers]
    Helpers --> Catalog[REGION_CATALOG]
    Catalog --> MapGen[generateMap(seed)\n± deterministic variation]
    MapGen --> State[GameState.map.regions]
    State --> Opex[tickOpex / unit-economics audits]
    Difficulty[DIFFICULTY_CONFIG] --> NewGame[newGame()]
    NewGame --> State
```

Key decisions:

- Keep `Region` state JSON-serializable and backward-compatible: persisted regions continue to store effective `powerCostPerKwh` and monthly `staffWage` numbers.
- Make multipliers the source of truth in `packages/game-logic/src/balance/regional-opex.ts`; `packages/game-logic/src/catalog/regions.ts` should derive effective catalog values from these profiles rather than hard-coding unrelated wage/power numbers.
- Preserve deterministic map generation: `generateMap(seed)` can continue to apply its existing ±10% power and ±5% wage seed variation to the derived catalog values.
- Use power multipliers close to published commercial/industrial electricity differences; use a product-adjusted wage table that satisfies the requested gameplay rule that USA technicians are most expensive.
- Do not alter tax rates, total regional power pools, or total regional staff pools in this plan unless Phase 3 validation proves the new OpEx numbers make a region unusable.

Illustrative constants:

```ts
export const BASE_REGION_OPEX = {
  powerCostPerKwh: 0.08,
  staffWagePerMonth: 6_500,
} as const;

export const REGIONAL_OPEX_PROFILES = {
  us_east: { powerMultiplier: 1.0, wageMultiplier: 1.0 },
  us_west: { powerMultiplier: 0.8, wageMultiplier: 0.95 },
  eu_west: { powerMultiplier: 2.25, wageMultiplier: 0.9 },
  eu_central: { powerMultiplier: 2.13, wageMultiplier: 0.92 },
  ap_northeast: { powerMultiplier: 2.0, wageMultiplier: 0.78 },
  ap_southeast: { powerMultiplier: 2.25, wageMultiplier: 0.8 },
  sa_east: { powerMultiplier: 1.63, wageMultiplier: 0.35 },
  me_central: { powerMultiplier: 1.13, wageMultiplier: 0.65 },
} as const;
```

Initial proposed effective values:

| Region | City | Power multiplier | Effective power ($/kWh) | Wage multiplier | Effective staff wage / month |
|---|---:|---:|---:|---:|---:|
| `us_east` | Ashburn | 1.00 | 0.08 | 1.00 | 6,500 |
| `us_west` | Boardman | 0.80 | 0.06-0.07 | 0.95 | 6,175 |
| `eu_west` | Dublin | 2.25 | 0.18 | 0.90 | 5,850 |
| `eu_central` | Frankfurt | 2.13 | 0.17 | 0.92 | 5,980 |
| `ap_northeast` | Tokyo | 2.00 | 0.16 | 0.78 | 5,070 |
| `ap_southeast` | Singapore | 2.25 | 0.18 | 0.80 | 5,200 |
| `sa_east` | São Paulo | 1.63 | 0.13 | 0.35 | 2,275 |
| `me_central` | Dubai | 1.13 | 0.09 | 0.65 | 4,225 |

Power values are intentionally close to the research table. Wage values are intentionally game-adjusted so USA is the premium labor market and Asia is cheaper than Europe, while still preserving lower-wage Brazil/Dubai differentiation.

## Phase 1 — Research-backed balance model

**Goal**: introduce a single, testable source of truth for regional electricity and wage multipliers without changing save-state shape.

### Step 1.1 — Add regional OpEx multiplier constants and references

- File: `packages/game-logic/src/balance/regional-opex.ts`
- Add `BASE_REGION_OPEX` with `powerCostPerKwh: 0.08` and `staffWagePerMonth: 6_500`.
- Add `REGIONAL_OPEX_PROFILES` keyed by existing region IDs with `powerMultiplier`, `wageMultiplier`, and concise `sourceNote` / `gameplayNote` strings.
- Add pure helpers such as `powerCostForRegionProfile(profile)` and `staffWageForRegionProfile(profile)` that round to game-friendly values.
- Export the module from `packages/game-logic/src/balance/index.ts`.
- Acceptance: `npm run typecheck -w @datacenter-tycoon/game-logic` passes; no runtime behavior changes outside imports yet.

### Step 1.2 — Derive region catalog power and wage values from multipliers

- File: `packages/game-logic/src/catalog/regions.ts`
- Replace hard-coded `powerCostPerKwh` and `staffWage` numbers with derived values from the new regional OpEx helpers.
- Keep all existing region IDs, names, city metadata, tax rates, coordinates, `totalPowerAvailable`, and `totalStaffAvailable` unchanged.
- Keep `CONTRACT_REGION_AFFINITY_REGION_IDS`, `regionMatchesContractAffinity`, and `regionIdsForContractAffinity` behavior unchanged.
- Acceptance: `generateMap(seed)` still returns 8 regions and remains deterministic for the same seed.

### Step 1.3 — Add unit tests for effective regional OpEx values

- Files:
  - `packages/game-logic/src/balance/regional-opex.test.ts`
  - `packages/game-logic/src/sim/mapgen.test.ts`
- Assert the base effective catalog values match the target table before seed variation.
- Assert the gameplay wage ordering: `us_east` >= `us_west` > EU regions > AP regions > `me_central` > `sa_east` where practical after rounding.
- Assert the power ordering: US West is cheaper than US East; EU West/Singapore are expensive; São Paulo and Dubai sit in the middle; all values stay positive after map variation.
- Acceptance: `npm run test -w @datacenter-tycoon/game-logic -- regional-opex mapgen` passes or the package-equivalent targeted test command passes.

## Phase 2 — Starting cash runway

**Goal**: give both difficulties enough cash to build a first facility, place useful racks, absorb early OpEx, and take early contracts without making capex irrelevant.

### Step 2.1 — Increase Easy and Hard starting cash

- Files:
  - `packages/game-logic/src/balance/difficulty.ts`
  - `packages/game-logic/src/economy/constants.ts`
- Increase Hard starting cash from `2_500_000` to a target around `4_000_000`.
- Increase Easy starting cash from `5_000_000` to a target around `8_000_000`.
- Align `STARTING_CASH` with the Hard/default starting cash if it is still used as the baseline fallback.
- Acceptance: `newGame({ difficulty: "hard" })` and `newGame({ difficulty: "easy" })` initialize cash at the new values.

### Step 2.2 — Update new-game and difficulty tests

- Files:
  - `packages/game-logic/src/balance/difficulty.test.ts` if present, otherwise add focused assertions near existing difficulty tests.
  - `packages/game-logic/src/state/newGame.test.ts` or the existing new-game test file.
- Update expected Easy/Hard starting cash values.
- Add a regression assertion that Hard remains below Easy, and both are above the old values.
- Acceptance: `npm run test -w @datacenter-tycoon/game-logic -- difficulty newGame` passes or the package-equivalent targeted test command passes.

### Step 2.3 — Bump balance version and document the rebalance

- Files:
  - `packages/game-logic/src/economy/constants.ts`
  - Any existing balance changelog/release-note file if present.
- Bump `BALANCE_VERSION` from `7` to `8`.
- Add a short note explaining that version 8 changes starting cash and regional OpEx baselines.
- Acceptance: tests that assert balance version or snapshot metadata are updated; no stale references to version 7 remain except historical plan/docs references.

## Phase 3 — OpEx impact validation

**Goal**: prove the new region costs produce interesting tradeoffs without destroying early-game profitability or making one region always optimal.

### Step 3.1 — Extend unit-economics audit coverage for regional OpEx

- File: `packages/game-logic/src/balance/unit-economics.ts`
- Ensure the audit output can clearly identify the cheapest and most expensive facility-slot baseline by region after the multiplier change.
- Add, if useful, a small `RegionalOpexAuditSnapshot` that records per-region power, staff, and baseline garage/warehouse monthly OpEx.
- Keep the audit pure and deterministic.
- Acceptance: an automated test can compare regional opex ordering without duplicating business logic in web/CLI code.

### Step 3.2 — Add scenario validation for early-game cash runway

- Files:
  - `packages/game-logic/src/balance/scenario-validation.ts`
  - Related `*.test.ts` file under `packages/game-logic/src/balance/`
- Add scenarios for a minimal early-game build in at least `us_east`, `us_west`, `eu_west`, `ap_southeast`, `sa_east`, and `me_central`.
- Validate expected runway after facility capex, a starter rack mix, and 3-6 months of OpEx.
- Include Easy and Hard cash values in the validation so the starting-cash bump is tested against the new regional OpEx table.
- Acceptance: Hard remains survivable for a reasonable starter build; Easy has a visibly larger safety buffer; high-power-cost regions are harder but not immediate traps.

### Step 3.3 — Tune target values if validation shows broken payback or runway

- Files:
  - `packages/game-logic/src/balance/regional-opex.ts`
  - `packages/game-logic/src/balance/difficulty.ts`
  - Tests touched in Steps 1.3 and 3.2
- If Phase 3 shows unrealistic outcomes, adjust only the smallest necessary constants: wage multipliers, power multipliers, or starting cash.
- Prefer changing multipliers over altering region resource pools or tax rates.
- Document any deviations from the initial proposed table in a short comment and in this plan's `## Changelog` before implementation continues.
- Acceptance: unit-economics target bands still pass; scenario validation supports the intended Easy/Hard runway; no region is obviously dominant solely due to OpEx.

## Phase 4 — Player-facing surfacing

**Goal**: make the new regional OpEx differences visible before the player commits to building in a region.

### Step 4.1 — Surface regional power and wage differences in CLI region/map views

- Files: inspect `packages/cli/src/**` region/map commands before editing.
- Show effective `powerCostPerKwh` and `staffWage` in any region detail or map summary command.
- If a compact label is useful, show normalized multipliers such as `Power 2.25x / Labor 0.80x` using a helper exported from `game-logic` rather than duplicating formulas in CLI code.
- Acceptance: CLI output makes the tradeoff legible and `npm run typecheck -w @datacenter-tycoon/cli` passes.

### Step 4.2 — Surface regional power and wage differences in web region/map views

- Files: inspect `packages/web/src/**` region/map components before editing.
- Add the same effective values or normalized labels to the region/build-location UI.
- Keep all gameplay interpretation in `game-logic`; web should only format values returned by state/query helpers.
- Acceptance: web typecheck passes and a player can see power/labor costs before choosing a build region.

### Step 4.3 — Run package and boundary checks

- Files: no code changes expected except test snapshots if they are generated.
- Run:
  - `npm run test -w @datacenter-tycoon/game-logic`
  - `npm run typecheck`
  - `npm run audit:query-boundary` if CLI/web region UI was changed alongside shared query helpers.
- Acceptance: all commands pass; plan progress is updated; implementation commits are made step-by-step per the planning workflow.

## References

- [Root AGENTS.md](../../AGENTS.md) — game-logic is the source of truth; keep state deterministic and serializable.
- [Game-logic AGENTS.md](../../packages/game-logic/AGENTS.md) — pure TypeScript, deterministic rules, no platform APIs.
- [Game balance tuning skill](../skills/game-balance-tuning/SKILL.md) — balance constants live under `packages/game-logic/src/balance/`; bump balance version and update tests.
- [040 Rack Capex and Contract Unit Economics Rebalance](./archive/040-rack-capex-and-contract-unit-economics-rebalance.md) — recent balance-audit template and versioning precedent.
- [033 Game Difficulty Modes](./archive/033-game-difficulty-modes.md) — current Easy/Hard difficulty model.
- [014 Regional Map and Location Economy](./archive/014-regional-map-and-location-economy.md) — original region and regional OpEx architecture.
- KPMG, [Global data centre cost benchmarks](https://kpmg.com/sg/en/insights/strategy-and-growth/global-data-centre-cost-benchmarks.html) — OpEx varies materially by geography and labor is a primary structural driver.
- Eurostat, [Electricity price statistics](https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Electricity_price_statistics) — 2024 non-household EU electricity-price reference points, including high Ireland/Germany costs.
- US BLS, [Computer Support Specialists Occupational Outlook Handbook](https://www.bls.gov/ooh/computer-and-information-technology/computer-support-specialists.htm) — 2024 US support-specialist wage baseline.
- DataX Connect, [Europe Data Centre Salary Survey 2024](https://dataxconnect.com/wp-content/uploads/2024/09/REPORT-Europe-Data-Centre-Salary-Survey-2024-4-compressed.pdf) — data-center salary context for European markets.
- Choose Energy, [Electricity Rates by State](https://www.chooseenergy.com/electricity-rates-by-state/) — EIA-backed US electricity cost variation context.

## Changelog

- 2026-05-24 — created plan with researched regional OpEx multipliers, proposed Easy/Hard starting-cash targets, validation work, and player-facing surfacing steps.
- 2026-05-24 — Phase 3 validation passed without further multiplier or starting-cash retuning; early-game runway checks now use a profitable C1/C1/M1/M1 starter garage profile across target regions.
