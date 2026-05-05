---
name: play-cli-game
description: Use when playing or strategizing the Datacenter Tycoon CLI game — building datacenters, adding/removing racks, accepting contracts, advancing time, optimizing cashflow, or querying game state via CLI commands (dct). Triggers include phrases like "play the game", "start a new game", "build a datacenter", "accept a contract", "advance time", "check my status", or "how should I optimize".
version: 0.1.0
---

# Skill: Play the Datacenter Tycoon CLI Game

## Description

Teaches an LLM how to play the **Datacenter Tycoon** CLI game effectively. Use this skill whenever the user asks you to play the game, make strategic decisions, optimize their empire, or interact with the CLI/TUI.

---

## 1. Game Overview

Datacenter Tycoon is a tycoon-style simulation game played in the terminal. You build and operate data centers around the world, fill them with server racks, and fulfill customer contracts to generate revenue. The game runs as a background daemon with a terminal UI (TUI) and a command-line interface (CLI).

**Core loop:**
1. Build datacenters in regions
2. Fill them with racks (compute, memory, storage, GPU)
3. Accept contracts from the market
4. Earn monthly revenue while paying operating costs
5. Expand and optimize for maximum cashflow and total balance

**Time model:** One tick = one month. Contracts have terms measured in months. Opex is calculated monthly. Rack failures and repairs are tracked in days (30 days = 1 tick).

---

## 2. Key Metrics & What They Mean

| Metric | Meaning |
|--------|---------|
| **Cash** | Your liquid balance. Used for capex (building DCs, buying racks). If this goes negative, you cannot make purchases. |
| **Tick** | Current game time in months. |
| **vCPU** | Compute capacity. Used by most contracts. |
| **RAM (GB)** | Memory capacity. Heavy requirement for memory/database contracts. |
| **Storage (TB)** | Disk capacity. Heavy requirement for storage contracts. |
| **GPU FLOPS** | GPU compute. Required for AI training and rendering contracts. |
| **Power (kW)** | Each rack draws power. Datacenters have a power capacity limit. |
| **Cooling (BTU/hr)** | Racks generate heat. Must stay within datacenter cooling capacity. |
| **Bandwidth (Gbps)** | Network capacity per datacenter. Sum of rack bandwidths must fit. |
| **Slots** | Physical rack positions in a datacenter (`rows × positionsPerRow`). |

---

## 3. Game Dynamics & Tradeoffs

### 3.1 Regions (Where to Build)

Regions have **finite** power and staff pools. Once a region's resources are consumed, you cannot build more datacenters there.

| Region | Power $/kWh | Staff Wage | Tax Rate | Power Pool | Staff Pool |
|--------|-------------|------------|----------|------------|------------|
| Silicon Valley | $0.22 | $9,500 | 21% | 5,000 | 500 |
| Iowa | $0.06 | $4,200 | 8% | 8,000 | 300 |
| Iceland | $0.04 | $5,800 | 15% | 3,000 | 120 |
| Frankfurt | $0.18 | $6,200 | 28% | 6,000 | 400 |
| Singapore | $0.16 | $5,500 | 17% | 4,000 | 350 |
| Mumbai | $0.09 | $2,800 | 25% | 4,500 | 600 |
| São Paulo | $0.13 | $3,500 | 34% | 3,500 | 450 |
| Sydney | $0.19 | $7,200 | 30% | 2,500 | 200 |
| Dubai | $0.08 | $4,800 | 9% | 5,500 | 280 |
| Seoul | $0.11 | $5,200 | 22% | 4,000 | 380 |

**Tradeoffs:**
- **Cheap power** (Iceland, Iowa) lowers opex but may have limited staff pools.
- **Low taxes** (Iowa 8%, Dubai 9%) keep more profit but power may not be the cheapest.
- **Cheap staff** (Mumbai $2,800) reduces opex but high taxes (25%) eat profits.
- **High staff pools** (Mumbai 600, Iowa 8,000 power) allow massive expansion.
- **Early game**: Iowa and Dubai are excellent — low power cost + low tax + decent capacity.
- **Late game**: You may need multiple regions. Plan ahead because regions exhaust.

### 3.2 Datacenter Sizes

| Spec | Rows × Positions | Power | Cooling | Bandwidth | Capex | Staff |
|------|------------------|-------|---------|-----------|-------|-------|
| `garage` | 2 × 4 = 8 slots | 60 kW | 96,000 BTU/h | 80 Gbps | $250,000 | 2 |
| `warehouse` | 4 × 10 = 40 slots | 320 kW | 400,000 BTU/h | 400 Gbps | $1,400,000 | 8 |
| `hyperscale` | 8 × 25 = 200 slots | 2,500 kW | 8.5M BTU/h | 5,000 Gbps | $18,000,000 | 45 |

**Tradeoffs:**
- `garage`: Cheap entry, fast to fill, but limited scale. Good for early cashflow.
- `warehouse`: Mid-game workhorse. Better cost-per-slot than garage.
- `hyperscale`: Massive capex. Only build when you have steady revenue and need scale. Liquid cooling required for tier-3 racks.

**Important:** Air-cooled datacenters (`garage`, `warehouse`) **cannot host tier-3 racks**. Only `hyperscale` (liquid cooling) can.

### 3.3 Rack Types & Tiers

There are 4 rack kinds, each with 3 tiers. Higher tiers = more capacity but exponentially higher power draw, heat, capex, and maintenance.

**Compute Racks (C1–C3):** High vCPU, moderate RAM/storage. Good general-purpose.
**Memory Racks (M1–M3):** Extreme RAM. Essential for memory-heavy contracts.
**Storage Racks (S1–S3):** Extreme storage. Essential for storage contracts.
**GPU Racks (G1–G3):** Extreme GPU FLOPS. Very expensive. Only buy when you have GPU contracts.

**Key tradeoff:** A datacenter's capacity is the **sum of all healthy racks**. But contracts demand **all four resources simultaneously**. A datacenter with only compute racks cannot fulfill a contract that also needs RAM, storage, or GPU. You must **mix rack types** within a datacenter to match contract requirements.

### 3.4 Contracts

Contracts are generated procedurally with themes:
- **AI Model Training**: Heavy GPU + RAM
- **Realtime Analytics**: Heavy RAM + vCPU
- **Edge Compute Burst**: Heavy vCPU
- **Small Data Storage Startup**: Heavy storage
- **Rendering Farm**: Heavy GPU + vCPU
- **In-Memory Database Migration**: Heavy RAM + storage

**Contract properties:**
- `monthlyPayment`: Revenue per tick while fulfilled.
- `penaltyPerMonth`: Charged per tick while breached.
- `termMonths`: How long the contract lasts.
- `urgency`: `standard` (normal), `rush` (1.4× payment, 2-tick offer window, short term), `anchor` (0.75× payment, long term, low penalty).
- `tier`: 1, 2, or 3 — roughly maps to difficulty/resource requirements.

**Critical CONTRACT RULE:**
When a contract is assigned to a datacenter, the datacenter must provide enough **total capacity** to cover **ALL active contracts assigned to it combined**. If the sum of demands exceeds supply, **every contract on that datacenter is breached** and pays penalties. This means:
- You cannot blindly stack contracts on one datacenter.
- You must calculate total demand vs. total supply per datacenter.
- Removing a rack or a rack failing can trigger mass breach.

**Contract lifecycle:**
1. `offered` → appears in market, expires after a few ticks
2. `active` → you accepted it, revenue flows
3. `breached` → one tick of insufficient capacity; penalty charged
4. `cancelled` → breached for 2 consecutive ticks, or you manually cancel
5. `completed` → term ended while active

### 3.5 Opex Breakdown (Monthly Costs)

For each datacenter, every tick:
- **Power** = `totalPowerDrawKw × 730 hours × region.powerCostPerKwh`
- **Cooling** = `power × 0.30` (30% overhead)
- **Bandwidth** = `datacenter.bandwidthGbps × $85`
- **Staff** = `(datacenter.staffCount + maintenanceStaff) × region.staffWage`
- **Maintenance** = sum of all racks' `monthlyMaintenance`
- **Tax** = `max(0, revenue − opex) × region.taxRate`

**Tradeoffs:**
- More racks = more revenue potential but higher power, cooling, and maintenance.
- Maintenance staff (0–8 per datacenter) speeds up rack repairs but adds to staff wages.
- Tier-3 racks draw massive power. In expensive regions (Silicon Valley, Sydney), power costs dominate.

### 3.6 Rack Failures & Maintenance

Racks age in months (ticks since installation). Failure chance increases linearly from 0% (new) to 50% (36 months). A failed rack enters `repairing` state and contributes **zero capacity**.

- Base repair time: ~90 days (3 ticks)
- Each maintenance staff member speeds repairs by 25% (max 8 staff = 3× speed)
- A repairing rack can cause contract breaches if it was critical to meeting demand.

**Tradeoff:** Hiring maintenance staff reduces downtime (preventing breach penalties) but increases monthly staff wages. For small garages, 0 staff may be fine. For large warehouses/hyperscales with many aging racks, 2–4 staff is often worth it.

---

## 4. Optimization Goals

Your primary objective is to **maximize cashflow and total balance** over time.

### Short-term strategy (ticks 0–10):
1. Start with $2,500,000.
2. Build a `garage` in a cheap region (Iowa, Dubai, Iceland).
3. Fill it with tier-1 racks that match early market contracts.
4. Accept 1–2 small contracts you can definitely fulfill.
5. Ensure your datacenter's total capacity covers all assigned contracts.

### Mid-term strategy (ticks 10–30):
1. Reinvest revenue into more racks or a `warehouse`.
2. Diversify rack types so you can accept varied contracts.
3. Monitor rack ages. Replace or add maintenance staff before failures spike.
4. Watch contract market difficulty — it scales with ticks.

### Long-term strategy (ticks 30+):
1. Build `hyperscale` campuses in low-tax, cheap-power regions.
2. Use tier-3 racks for density.
3. Maintain a buffer of unused capacity per datacenter to absorb rack failures.
4. Anchor contracts provide stable long-term revenue; rush contracts provide quick cash injections.

### Key pitfalls to avoid:
- **Overcommitting**: Accepting contracts that push your total demand to 100% of supply. One rack failure = mass breach.
- **Wrong region**: Building in Silicon Valley or Sydney early — high power + high tax drains cash.
- **Single rack type datacenters**: You need mixed types to fulfill most contracts.
- **Ignoring opex**: A rack's monthly maintenance + power + cooling can exceed its share of contract revenue.
- **Capex bankruptcy**: Spending all cash on a hyperscale leaves no money for racks or breathing room.

---

## 5. CLI Commands Reference

All commands are run via `dct <command> [args] [flags]`. The daemon auto-starts if not running.

### 5.1 Game Lifecycle

```bash
# Create a new game (DESTRUCTIVE — overwrites save)
dct new --yes [--seed <number>]

# Load a savefile
dct load <path>

# Force-save current state
dct save [export-path]

# Print game summary
dct status [--json]

# List available save files
dct ls saves

# Shutdown daemon (saves automatically)
dct quit
```

### 5.2 Time Control

```bash
# Advance one tick (one month)
dct tick

# Advance N ticks
dct tick <N>

# Pause/resume auto-ticking daemon
dct pause
dct resume

# Set auto-tick speed (ticks per second)
dct speed <ticksPerSecond>
```

### 5.3 Building & Managing Datacenters

```bash
# Build a datacenter
dct build-dc <specId> [--id <dcId>] [--region <regionId>]
# Example: dct build-dc garage --id dc-1 --region iowa

# Available specs: garage, warehouse, hyperscale
# If --region omitted, defaults to first region (silicon_valley)
# If --id omitted, auto-generates an ID
```

**Constraints checked:**
- Region must have enough remaining power and staff for the datacenter.
- You must have enough cash for capex.

### 5.4 Adding & Removing Racks

```bash
# Add a rack to a datacenter
dct add-rack <dcId> <row> <position> <rackSpecId> [--id <placementId>]
# Example: dct add-rack dc-1 0 0 C1 --id rp-1

# Remove a rack
dct remove-rack <dcId> <placementId>
# Example: dct remove-rack dc-1 rp-1
```

**Placement constraints checked:**
- Row and position must be within datacenter bounds.
- Slot must not already be occupied.
- Total power draw must not exceed datacenter power capacity.
- Total heat must not exceed cooling capacity.
- Total bandwidth must not exceed datacenter bandwidth.
- Tier-3 racks can only go in liquid-cooled datacenters (`hyperscale`).

**Rack specs:**
- Compute: `C1`, `C2`, `C3`
- Memory: `M1`, `M2`, `M3`
- Storage: `S1`, `S2`, `S3`
- GPU: `G1`, `G2`, `G3`

### 5.5 Contracts

```bash
# Accept a market contract and assign it to a datacenter
dct accept-contract <contractId> <dcId>
# Example: dct accept-contract contract-ai-model-training-a1b2c dc-1

# Cancel an active contract
dct cancel-contract <contractId>
```

**Important:** When accepting, the game does NOT validate whether the datacenter can fulfill the contract. You must check capacity yourself. If total demand exceeds supply, all contracts on that datacenter breach.

### 5.6 Global Flags

| Flag | Effect |
|------|--------|
| `--json` | Output results as JSON |
| `--quiet` | Suppress non-JSON output |
| `--socket <path>` | Use custom daemon socket |
| `--save <path>` | Use custom save file |
| `--no-daemon` | Don't auto-spawn daemon |
| `-h`, `--help` | Show help |

---

## 6. TUI (Terminal UI) Guide

Running `dct` with no arguments launches the interactive TUI.

### Navigation

| Key | Action |
|-----|--------|
| `1` | Dashboard tab |
| `2` | Datacenters tab |
| `3` | Contracts tab |
| `4` | Catalog tab |
| `:` | Open command palette (type any CLI command) |
| `?` | Toggle help overlay |
| `q` | Quit TUI |

### Datacenters Tab (`2`)
- `↑` / `↓` — select datacenter
- `n` — open palette with `build-dc `
- `r` — open palette with `add-rack <selectedDc> `
- `x` — open palette with `remove-rack <selectedDc> `

### Contracts Tab (`3`)
- `a` — open palette with `accept-contract `
- `c` — open palette with `cancel-contract `

### Command Palette (`:`)
- Type any CLI command (without the `dct` prefix)
- `Tab` — autocomplete
- `↑` / `↓` — browse command history
- `Enter` — execute
- `Esc` — cancel

---

## 7. Querying Game State

Use these query patterns to understand your position before making decisions:

```bash
# Full game state (JSON)
dct status --json

# In the TUI, the Dashboard tab shows:
# - Current cash
# - Number of datacenters
# - Active and market contract counts
# - Recent ledger entries (revenue, opex, penalties, capex)

# The Datacenters tab shows:
# - Each datacenter's ID, name, rack count
# - Selected datacenter's power/cooling/bandwidth limits
# - Rack grid visualization

# The Contracts tab shows:
# - All market contracts with ID, name, payment, term, status
# - All active contracts with assigned datacenter

# The Catalog tab shows:
# - All datacenter specs with dimensions and capex
# - All rack specs with kind, tier, resources, and capex
```

---

## 8. Decision Checklist

Before executing any major action, verify:

**Building a datacenter:**
- [ ] Do I have enough cash for capex + some racks?
- [ ] Does the region have enough remaining power and staff?
- [ ] Is the region's power cost and tax rate favorable?

**Adding a rack:**
- [ ] Does the datacenter have a free slot at that row/position?
- [ ] Will total power draw stay under the datacenter limit?
- [ ] Will total heat stay under cooling capacity?
- [ ] Will total bandwidth stay under the limit?
- [ ] Is the rack tier compatible with cooling type?
- [ ] Do I have enough cash for the rack capex?

**Accepting a contract:**
- [ ] What are the contract's requirements (vCPU, RAM, storage, GPU)?
- [ ] What is the total demand of ALL active contracts on the target datacenter?
- [ ] What is the total healthy capacity of the target datacenter?
- [ ] Is there a healthy buffer (e.g., 10–20%) above total demand?
- [ ] Will the contract's monthly payment exceed its share of opex?
- [ ] How many ticks remain before the offer expires?

**Removing a rack:**
- [ ] Will the remaining healthy capacity still cover all assigned contracts?
- [ ] Is there a better rack to replace it with?

---

## 9. Example Opening Moves

```bash
# 1. Start a new game
dct new --yes --seed 42

# 2. Check status
dct status

# 3. Build a garage in Iowa (cheap power, low tax)
dct build-dc garage --id dc-1 --region iowa

# 4. Add a compute rack
dct add-rack dc-1 0 0 C1 --id rp-c1

# 5. Add a memory rack
dct add-rack dc-1 0 1 M1 --id rp-m1

# 6. Check contracts in TUI or advance a tick to see market
dct tick

# 7. Accept a contract that matches your capacity
dct accept-contract contract-edge-compute-burst-12345 dc-1

# 8. Advance time and watch cashflow
dct tick 3

# 9. Check status to see revenue vs opex
dct status
```

---

## 10. Advanced Tips

- **Capacity planning:** Keep a spreadsheet or mental model of each datacenter's `healthy capacity` vs `total assigned demand`. Recalculate after every rack addition, removal, or failure.
- **Contract math:** A contract is profitable if `monthlyPayment > (share of opex + rack depreciation)`. Since opex is shared across all racks in a datacenter, more contracts = better amortization of fixed costs (staff, bandwidth).
- **Rack replacement:** Old racks (30+ months) have high failure chance. Consider proactively removing them before they fail, especially if you have tight margins.
- **Tax optimization:** If a datacenter is unprofitable (opex > revenue), it pays zero tax on that datacenter. Sometimes it's better to cancel a bad contract than to keep it.
- **Market timing:** Contract difficulty scales with ticks. Early contracts are small and easy. Later contracts are larger and more lucrative. Don't expand too slowly or you'll miss the scaling curve.
- **Rush contracts:** These have a 2-tick offer window. If you see one that fits your capacity, act fast — the 1.4× multiplier is excellent.
- **Anchor contracts:** Lower payment but very long term and low penalty. Good for stable baseline revenue to cover fixed opex.
