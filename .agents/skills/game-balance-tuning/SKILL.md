---
name: game-balance-tuning
description: Use when adjusting numeric game balance — rack costs, contract payouts, opex rates, capacity yields, or contract difficulty curves. Triggers include phrases like "rebalance", "tune costs", "adjust pricing", "contracts feel too easy/hard", or "the economy is broken".
version: 0.1.0
---

# Game Balance Tuning

## Overview
Guidance for safely changing numeric game-balance constants in Datacenter Tycoon without breaking determinism, save compatibility, or test fixtures.

## When to Use
- Changing rack/server costs (capex) or running costs (opex).
- Adjusting contract revenue, penalties, or duration.
- Tweaking capacity yields per rack type (compute, memory, storage, gpu).
- Modifying difficulty curves or unlock thresholds.

## Instructions

1. **Locate constants**: All tunable numbers should live in `packages/game-logic/src/balance/` (create if missing) — never inline magic numbers in simulation code.
2. **Keep determinism**: Balance changes must not introduce wall-clock time, `Math.random()`, or non-serializable values.
3. **Bump a version**: When changing balance constants in a way that affects existing saves or replays, bump `BALANCE_VERSION` exported from `game-logic` and note the change in a `CHANGELOG.md`.
4. **Update tests**: Balance-sensitive tests (e.g. "fulfilling contract X yields Y revenue") must be updated in the same commit. Run `npm run test -w @datacenter-tycoon/game-logic`.
5. **Document rationale**: In the PR/commit message, explain *why* the change was made (player feedback, math derivation, target session length, etc.).
6. **Sanity-check ranges**: Costs and revenues should stay in sensible orders of magnitude relative to each other — opex per tick should be << contract revenue per tick for a fulfilled contract; otherwise the game becomes unwinnable.

## Anti-Patterns
- ❌ Hardcoding new numbers inside `sim/tick.ts`.
- ❌ Changing constants without updating tests.
- ❌ Using floating-point money — prefer integer cents/credits.
