# Playtest Results — Session 01

**Date**: 2026-05-09  
**Agent**: Claude (AI coding assistant)  
**Seed**: 42  
**Duration**: ~6 ticks (months) of in-game time  
**Final cash**: ~$623k (started at $2.5M)  
**Playstyle**: Aggressive contract stacking, 3-DC build-out

---

## 1. Session Summary

Played a full CLI session using `dct` from a fresh `--seed 42` game. Built three garage datacenters, accepted 10 contracts across 6 ticks, and managed cash from $2.5M down to ~$623k. By tick 6, revenue had dropped significantly as early contracts expired, and the session was approaching a cash-flow squeeze before being stopped.

---

## 2. What Went Well

### 2.1 Core loop is legible
The basic loop — `pause → inspect contracts → build DC → add racks → accept contracts → tick` — works cleanly over CLI. Commands are intuitive and composable. The skill guide's recommended play loop maps well to reality.

### 2.2 Catalog and contract data are rich
`dct ls catalog` and `dct ls contracts` surface all the information needed for planning: rack costs, power draw, DC power budgets, contract requirements, payment rates, penalties, and expiry ticks. An experienced player (or agent) can build a full capacity model from CLI output alone.

### 2.3 Snapshot JSON is a powerful escape hatch
`dct query '{"kind":"snapshot"}' --json` gave access to full game state including ledger history, which was essential for debugging revenue anomalies. The ledger's per-tick revenue/opex breakdown is excellent for post-hoc analysis.

### 2.4 DC capacity pooling makes rack planning tractable
The game pools capacity per DC rather than per-rack. A DC with 4×C1 + 1×M1 + 3×S1 simply sums to one aggregate vCPU/RAM/Storage budget that all accepted contracts draw from. This is easy to reason about and plan around.

### 2.5 Region selection has real meaning
`us_west` at $0.05/kWh vs `eu_central` at $0.18/kWh is a meaningful early-game choice. The skill guide correctly calls this out. Choosing us_west noticeably reduced opex compared to the more expensive regions.

---

## 3. What Was Hard / Friction Points

### 3.1 🐛 `dct ls contracts` shows "DC: unassigned" for assigned contracts
**Critical display bug.** Every contract accepted with a valid DC ID still shows `DC: unassigned` in the `dct ls contracts` output. This caused significant confusion — it was unclear whether contracts were actually fulfilled or were being penalised due to missing DC assignment.

The snapshot JSON (`activeContracts[].assignedDcId`) showed the correct assignment, so the backend is correct. The display layer is wrong.

**Impact**: An early player could think their contract acceptance failed and retry or panic-cancel. Very misleading for first-time play.

### 3.2 Contract expiry caused a surprise revenue cliff
Several 5–7 month contracts accepted early all expired around tick 5–6, causing monthly revenue to drop from ~$144k to ~$77k in a single tick. There is no in-game warning that a wave of contract expirations is approaching.

**Impact**: Cash-flow went from comfortably positive to barely positive in one step. A less-prepared player would go cash-negative and eventually go bankrupt.

**What would help**: A "contracts expiring in the next N ticks" summary in `dct status`, or warnings in `dct ls contracts` for contracts with ≤2 ticks remaining.

### 3.3 No per-DC capacity utilisation view
The only way to know how much capacity a DC has left after existing contracts is to manually subtract: (sum of all active contract requirements) from (sum of all rack capacities). There is no `dct dc-capacity <dcId>` or similar command.

**Impact**: Risky to accept a new contract without doing this maths by hand. Easy to accidentally over-commit or under-commit a DC.

**What would help**: `dct ls datacenters` (or a new `dct dc-capacity`) could show:
```
DC dc-8e560e87 — Garage (us_west)
  Installed:   632 vCPU  | 4,864 GB RAM  | 1,584 TB
  Committed:   416 vCPU  | 2,752 GB RAM  | 1,080 TB
  Available:   216 vCPU  | 2,112 GB RAM  |   504 TB
```

### 3.4 Garage rack layout is 2×4, not 1×8 — not documented
The garage has 8 rack slots, but they are arranged as **2 rows × 4 positions**. This is not stated anywhere in `dct ls catalog` or the help text. The CLI silently fails with `out_of_bounds` when you try to place a 5th rack in row 0.

**Impact**: First-time players will get confusing errors. I spent several failed `dct add-rack` commands discovering the 2×4 layout.

**What would help**: `dct ls catalog` should include the row/column layout (e.g. `rows: 2, cols: 4`) for each DC type.

### 3.5 Contract status naming is inconsistent
After contracts ran their full term, some showed `status: "completed"` and others showed `status: "cancelled"`. Based on observation:
- Contracts that completed their full N-month term with no issues → `completed`
- Contracts that appeared to terminate early (possibly SLA breach?) → `cancelled`

However, I also saw a freshly accepted 12-month contract show `status: "cancelled"` after only 2 ticks, which was never explained. This could be an auto-cancellation due to SLA breach (if the DC assignment wasn't registered in time), but it wasn't clear.

**Impact**: No way to distinguish "expired normally" from "terminated due to breach" from `dct ls contracts` alone.

**What would help**: Separate statuses like `expired`, `breached`, `cancelled-by-player` instead of the single `cancelled`.

### 3.6 Opex is opaque until you run a tick
Before the first tick, there's no way to estimate what opex will be. You know rack maintenance costs from the catalog, but there are also power costs, staff wages, and DC overhead that are only visible in the ledger AFTER a tick.

In practice, monthly opex (~$53k/mo for 2 DCs and 15 racks) was significantly higher than the sum of rack maintenance costs alone, suggesting substantial power/staff overheads.

**Impact**: Hard to know if a build is profitable until after you've spent the capex and run a tick. A player building to tight margins could accidentally be cash-flow negative without knowing it.

**What would help**: A `dct estimate-opex` command, or a pre-build cost projection in `dct status`.

### 3.7 Market contract expiry ticks are hard to track across paused ticks
Market contract offers have "expires tick N" labels. When you pause and plan for several actions, it's easy to lose track of which tick you're currently on and accidentally let urgent offers expire before accepting them.

One "rush" contract (expires tick 2) was visible at tick 0 but I consciously passed on it due to difficulty verifying it would fit within remaining capacity fast enough.

---

## 4. Game Balance Observations

### 4.1 Early storage contracts are the best value
The "Small Data Storage Startup" contracts required only vCPU=16, RAM=512 GB, Storage=890 TB. This can be served with just **2× S1 racks** ($160k), making them extremely cheap to fulfill for their $25,500/mo payout. Storage contracts feel underpriced relative to their rack cost.

### 4.2 In-memory DB contracts are RAM-hungry but manageable
These contracts (vCPU=64–80, RAM=2,500–2,800 GB) require M1 racks. At $65k each and 2 per contract, they're reasonable but RAM is always the bottleneck. The C1 rack's RAM (512 GB) doesn't go far for these.

### 4.3 Edge compute contracts create a CPU/RAM tension
Edge burst contracts (vCPU=176–240, RAM=1,088–1,344 GB) need lots of C1 racks for vCPU but not much RAM. Pairing with In-Memory DB contracts in the same DC is efficient since M1's extra RAM fills the gap.

### 4.4 Opex feels high relative to revenue at small scale
With 3 garages and 18 racks, opex was ~$77k/mo vs. ~$144k/mo gross revenue — a 53% overhead ratio. This narrows the profit margin considerably. At larger scale (warehouse/hyperscale) this ratio should improve, but early game feels tight.

### 4.5 GPU contracts are not viable early
GPU rack (G1) cost was not checked in detail, but Rendering Farm contracts requiring 600–800 GPU units appeared on the market and were obviously unaffordable at the $600k–$2.5M capex range they would likely require. The market offers GPU contracts far earlier than a player can reasonably fulfill them.

---

## 5. CLI UX Observations

| Command | Works? | Notes |
|---|---|---|
| `dct new --yes --seed N` | ✅ | Clean new-game start |
| `dct pause / resume` | ✅ | Works reliably |
| `dct tick N` | ✅ | Controlled time advancement is great |
| `dct status` | ✅ | Best quick-look command |
| `dct ls contracts` | ⚠️ | "DC: unassigned" bug on assigned contracts |
| `dct ls datacenters` | ✅ | Shows IDs and slot usage |
| `dct ls racks <dcId>` | ✅ | Good rack inventory view |
| `dct ls catalog` | ✅ | Full spec data, but no row/col layout |
| `dct build-dc` | ✅ | Immediate and clean |
| `dct add-rack <dc> <row> <pos>` | ⚠️ | Silent `out_of_bounds` if row/pos invalid |
| `dct contracts accept <id> <dcId>` | ✅ | Works; backend assigns correctly |
| `dct contracts details <id>` | ✅ | Best single-contract inspection |
| `dct query '{"kind":"snapshot"}'` | ✅ | Full game state; essential for debugging |

---

## 6. Agent-Specific Observations

Playing as an LLM agent over one-shot CLI commands revealed some specific challenges:

- **No transactional batching**: Each `dct add-rack` is a separate command and a separate round-trip. Adding 8 racks requires 8 commands. A `--from-file` or batch rack-placement would help agents significantly.
- **JSON field names differ from CLI display names**: `paymentPerMonth` (in CLI display) vs `monthlyPayment` (in snapshot JSON). Inconsistent naming means agent code must handle both.
- **`--json` flag is inconsistently available**: Some commands (like `dct add-rack`) don't support `--json`, making output parsing fragile.
- **Contract capacity planning requires agent-side arithmetic**: There's no "does this contract fit on this DC?" dry-run command. Agents must track and sum capacity manually, which is error-prone.
- **Revenue anomalies are hard to debug**: When revenue dropped unexpectedly, diagnosing the cause required multi-step JSON parsing of the snapshot ledger. This level of debugging is impractical for a human player.

---

## 7. How Well Did I Play?

**Grade: C+**

### What I got right
- Correctly identified `us_west` as the best region for early cost efficiency
- Built a good initial DC1 rack mix (4×C1 + 1×M1 + 3×S1) that maximised slot usage
- Accepted 10 contracts across 3 DCs efficiently, hitting ~$144k/mo peak revenue
- Used snapshot JSON to debug revenue anomalies when `dct ls contracts` was misleading

### What I got wrong
- **Did not plan for contract expiry waves**: Accepted many contracts with similar durations (all starting at tick 0), which created a cliff at tick 5–6 when they all expired simultaneously. Should have staggered contract terms or built replacement capacity earlier.
- **Over-built too fast**: Spent down from $2.5M to $610k in the first 4 ticks. With the contract expiry cliff, this left ~$623k at tick 6 with barely positive cash flow. The margin for error was too slim.
- **Did not validate the 12-month edge burst contract**: The `contract-edge-compute-burst-758fe` (12mo, $11,600/mo) accepted at tick 4 showed as `cancelled` by tick 6 after only 2 ticks. I never diagnosed why — possible SLA breach or capacity race condition on DC1.
- **Did not notice the expiry countdown**: The skill guide warns to watch contract expiry, but I had no dashboard showing "these 4 contracts expire in 1 tick." A human player would have faced the same surprise.

---

## 8. Suggested Improvements (Priority Order)

1. **Fix `dct ls contracts` DC assignment display** — this is a critical confusion vector for new players
2. **Add contract expiry warnings** — show "⚠ expiring in N ticks" in `dct ls contracts` and `dct status`
3. **Add per-DC capacity utilisation view** — committed vs. available per resource type
4. **Document garage/warehouse row×col layout** in `dct ls catalog`
5. **Distinguish contract end states**: `expired` vs `breached` vs `cancelled-by-player`
6. **Show estimated opex before committing** — pre-tick opex preview when adding racks or DCs
7. **Add a "does this contract fit?" dry-run** — e.g. `dct contracts check <contractId> <dcId>`
8. **Rate-limit or delay early GPU contracts** — they appear in the market before players can realistically fulfill them, creating noise
