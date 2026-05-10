---
name: play-cli-game
description: Use when playing or strategizing the Datacenter Tycoon CLI game — building datacenters, placing/moving/removing racks, inspecting contracts, accepting contracts onto specific datacenters, pausing/resuming time, checking cash, or querying game state via `dct`.
version: 0.3.2
---

# Skill: Play Datacenter Tycoon over the CLI

Use this skill when the user wants to **play the game through `dct`**, automate play through the CLI, or reason about the best next move from terminal-visible game state.

This guide is intentionally focused on **what the CLI actually supports today**.

---

## 1. Mental model

This skill assumes **non-interactive CLI play only** using one-shot commands like `dct status`, `dct dc build ...`, `dct racks add ...`, and `dct ls contracts`.

Under the hood, `dct` talks to a local daemon that owns the game state and advances time.

Important practical consequences:

- If no daemon is running, `dct` will auto-start one.
- Auto-start prints a notice to **stderr**.
- Time may keep advancing unless you **pause** it.
- For careful play, it is often best to:
  1. `dct pause`
  2. inspect contracts / catalog / datacenters
  3. do your build actions
  4. `dct resume` or `dct tick N`

---

## 2. The exact top-level CLI commands today

Run `dct --help` for the current global help.

Current top-level commands:

```bash
dct daemon
dct status
dct new
dct load
dct save
dct quit
dct contract
dct ls
dct dc
dct racks
dct query
dct tick
dct pause
dct resume
dct speed
```

### Global flags supported today

```bash
--json
--socket <path>
--save <path>
--no-daemon
--quiet
-h
--help
```

Useful notes:

- `--json` is ideal for LLM/tool-driven play.
- `--quiet` suppresses normal success text.
- `--no-daemon` makes commands fail instead of auto-starting the daemon.
- `--save` and `--socket` are very useful when you want to isolate a test run.

---

## 3. `ls` subcommands that exist today

The supported subcommands today are:

```bash
dct ls saves
dct ls contracts
dct ls datacenters
dct ls dcs              # alias for datacenters
dct ls racks <dcId>
dct ls catalog
```

Notes:

- Use `dct ls datacenters` or `dct ls dcs`, **not** `dct ls dc`
- Use `dct ls contracts` for listing; bare `dct contract` is not the listing command anymore
- `dct ls catalog` prints **both** rack and datacenter specs together, including datacenter layout as `rows × cols (slots)`
- There is no separate `dct ls market` / `dct ls active` command today

---

## 4. Core commands by task

### 4.1 Start / stop / save a game

```bash
# start a fresh game (destructive)
dct new --yes [--seed <number>]

# load a save file into the active state
dct load <path>

# force-save current state; optionally export a copy
dct save [export-path]

# shut down the daemon cleanly
dct quit
```

### 4.2 Check overall status and cash

```bash
dct status
dct status --json
```

`dct status` is the fastest way to check:

- current tick
- current cash
- datacenter count
- rack count
- active contract count
- market contract count
- paused state
- speed

This is your main **cash check** command.

### 4.3 Pause / resume / advance time

```bash
dct pause
dct resume
dct tick
dct tick <N>
dct speed <ticksPerSecond>
```

Recommended usage:

- Use `dct pause` before planning or issuing multiple build commands
- Use `dct resume` when you want the simulation to run normally
- Use `dct tick N` if you want **manual, controlled advancement** while otherwise staying paused
- `dct speed 0` also effectively pauses, but `pause` / `resume` are clearer

### 4.4 Inspect/list contracts

```bash
dct ls contracts
dct ls contracts --json
```

This shows:

- market contracts
- active contracts
- each contract's id
- payment per month
- term
- urgency
- tier
- expiry tick (for market offers)
- requirements
- penalty
- assigned datacenter for active contracts
- status labels:
  - `active` — live, capacity committed, SLA checks passing
  - `breached` — live, capacity committed, SLA checks currently failing
  - `cancelled` — **historical**, player cancelled; capacity already released
  - `expired` — **historical**, term ended naturally; capacity already released
- `dct ls contracts` splits accepted contracts into **Active** (live: active + breached) and **History** (expired + cancelled) sections; only live contracts count toward `active=N` in `dct status`
- `dct contract details <id>` works for both live and historical contracts; historical ones are labeled `HISTORICAL — no longer live, capacity already released`
- `GameState.activeContracts` is the full accepted-contract **history** (live + historical combined); never assume its `.length` equals live contract count

### 4.5 Contract-focused subcommands

```bash
dct contract accept <contractId> <dcId>
dct contract cancel <contractId>
dct contract details <contractId>
dct contract details <contractId> --json
```

Notes:

- `dct contract` by itself is **not** the list command
- use `dct ls contracts` when you want the whole market + active list
- `dct contract details <contractId>` is the focused way to inspect one contract plus recent SLA outcome history
- `dct contract accept <contractId> <dcId>` now fails fast if that datacenter does not currently have enough available capacity after accounting for already-assigned active contracts
- when it fails, `--json` includes a machine-readable `insufficient_capacity` error with `required`, `available`, and `dcId` fields

### 4.6 Build datacenters

```bash
dct dc build <specId> [--region <regionId>] [--id <dcId>]
```

Example:

```bash
dct dc build garage --region us_west
```

Supported datacenter spec IDs today:

- `garage`
- `warehouse`
- `hyperscale`
- `hyperscale`

### 4.7 Add / remove / move racks

```bash
dct racks add <dcId> <row> <position> <rackSpecId> [--id <placementId>]
dct racks decom <dcId> <placementId>
dct racks move <dcId> <placementId> <targetDcId> <row> <position>
```

Supported rack spec IDs today:

- Compute: `C1`, `C2`, `C3`
- Memory: `M1`, `M2`, `M3`
- Storage: `S1`, `S2`, `S3`
- GPU: `G1`, `G2`, `G3`

Examples:

```bash
dct racks add dc-ab12cd34 0 0 C1
dct racks add dc-ab12cd34 0 1 M1
dct racks add dc-ab12cd34 0 2 S1

dct racks decom dc-ab12cd34 rp-1234abcd

dct racks move dc-ab12cd34 rp-1234abcd dc-ef56gh78 0 0
```

Before placing racks, use `dct ls catalog` and `dct ls datacenters` to confirm the valid `rows` / `cols` layout and placement bounds for the target datacenter.

### 4.8 Accept / cancel contracts

```bash
dct contract accept <contractId> <dcId>
dct contract cancel <contractId>
```

Example:

```bash
dct contract accept contract-edge-compute-burst-f2e06 dc-ab12cd34
```

### 4.9 Advanced/raw inspection

```bash
dct query '<json>'
dct query --params '<json>'
```

Useful raw queries:

```bash
# full snapshot
dct query '{"kind":"snapshot"}' --json

# status view
dct query '{"kind":"status"}' --json

# datacenters
dct query '{"kind":"list","target":"datacenters"}' --json

# racks for one DC
dct query '{"kind":"list","target":"racks","dcId":"dc-123"}' --json

# rack catalog
dct query '{"kind":"catalog","target":"racks"}' --json
```

For agentic play, `snapshot --json` is the richest single command because it includes:

- player cash
- contracts
- datacenters
- ledger
- map/regions

---

## 5. Current region IDs for `dc build --region`

There is no dedicated human-friendly `dct regions` command today, so use these current region IDs:

| Region ID | Name | City | Power | Tax | Quick note |
|---|---|---|---:|---:|---|
| `us_east` | US East | Ashburn | 0.07 | 6% | strong early-game all-rounder |
| `us_west` | US West | Boardman | 0.05 | 7% | cheapest power; excellent early choice |
| `eu_west` | EU West | Dublin | 0.12 | 12.5% | balanced but not the cheapest |
| `eu_central` | EU Central | Frankfurt | 0.18 | 28% | expensive; usually tougher early |
| `ap_northeast` | AP Northeast | Tokyo | 0.15 | 22% | mid/high cost |
| `ap_southeast` | AP Southeast | Singapore | 0.16 | 17% | workable but not cheap |
| `sa_east` | SA East | São Paulo | 0.13 | 34% | very high tax |
| `me_central` | ME Central | Dubai | 0.08 | 9% | another strong early option |

For exact machine-readable region data, use:

```bash
dct query '{"kind":"snapshot"}' --json
```

and inspect `data.map.regions`.

---

## 6. Best practical play loop for a human or LLM

A reliable CLI play loop is:

### Step 1: freeze time

```bash
dct pause
```

Even if you just created a new game, pausing explicitly is the safest workflow before planning.

### Step 2: inspect the market and your budget

```bash
dct status
dct ls contracts
dct ls catalog
```

What to look for:

- current cash
- contract requirements you can afford to serve
- rack specs that match those contracts
- whether GPU is actually needed yet

### Step 3: build a datacenter in a sensible region

Example early-game move:

```bash
dct dc build garage --region us_west
```

Then list datacenters to capture the generated ID:

```bash
dct ls datacenters
```

### Step 4: add racks that match a specific contract

Example balanced starter build:

```bash
dct racks add <dcId> 0 0 C1
dct racks add <dcId> 0 1 M1
dct racks add <dcId> 0 2 S1
```

If the contract is compute-heavy, bias toward more `C1`/`C2`.
If it is storage-heavy, add `S1`/`S2`.
Only buy GPU racks when the contract really needs GPU.

### Step 5: confirm what is installed

```bash
dct ls racks <dcId>
dct status
```

### Step 6: accept a contract onto that specific datacenter

```bash
dct contract accept <contractId> <dcId>
```

### Step 7: let time move again

Either resume real-time ticking:

```bash
dct resume
```

Or advance manually:

```bash
dct tick 1
dct tick 3
```

### Step 8: keep checking cash and contract state

```bash
dct status
dct ls contracts
```

If you want the most detail about cashflow events, use the full snapshot JSON.

---

## 7. Cash-management guidance

The game has two different money rhythms:

### Immediate cash changes

These hit your cash right away:

- building a datacenter
- adding a rack
- moving a rack (move cost)

### Tick-based cash changes

These happen when time advances:

- contract revenue
- opex
- penalties
- ledger updates

So a good operating habit is:

```bash
# before spending
dct status

# after building / buying racks
dct status

# after some time passes
dct status
```

For a deeper look at money events, run:

```bash
dct query '{"kind":"snapshot"}' --json
```

and inspect `data.ledger`.

---

## 8. Contract acceptance guardrails

This is the most important gameplay rule for CLI play:

### The CLI **does** validate contract fit before acceptance

`dct contract accept <contractId> <dcId>` now checks that the datacenter currently has enough available capacity to take the contract **right now** after accounting for already-assigned **live** (active + breached) contracts on that same datacenter. Historical (expired + cancelled) contracts are excluded from this check because their capacity has already been released.

If the contract does not fit, the command fails immediately instead of silently overcommitting the datacenter.

### What to verify before accepting

- Does the datacenter have enough currently healthy vCPU?
- enough RAM?
- enough storage?
- enough GPU?
- enough headroom after subtracting already-active contracts on that same datacenter?

If one datacenter is serving multiple contracts, think in terms of:

- **total assigned demand** on that DC
- **total currently available supply** on that DC

Do **not** stack contracts tightly to 100% capacity.

### What the failure looks like

- text mode: a human-readable insufficient-capacity error naming the target datacenter and the required vs available resources
- `--json`: a machine-readable error with `code: "insufficient_capacity"`, plus `required`, `available`, and `dcId`

---

## 9. Current placement/build constraints worth remembering

When placing racks, the game enforces:

- row/position must be valid
- target slot must be empty
- datacenter power limit must not be exceeded
- cooling limit must not be exceeded
- bandwidth limit must not be exceeded
- tier-3 racks require liquid cooling, so practically `hyperscale`

Practical implications:

- `garage` is the easiest early-game entry point
- `warehouse` is your main mid-game scaler
- `hyperscale` is for later, especially tier-3 density

---

## 10. Recommended opening sequence

A simple, robust CLI opening:

```bash
# 1. start fresh
dct new --yes --seed 42

# 2. freeze time while planning
dct pause

# 3. inspect money, offers, and available hardware
dct status
dct ls contracts
dct ls catalog

# 4. build an early DC in a strong region
dct dc build garage --region us_west

# 5. capture the generated DC id
dct ls datacenters

# 6. add a small balanced rack mix
dct racks add <dcId> 0 0 C1
dct racks add <dcId> 0 1 M1
dct racks add <dcId> 0 2 S1

# 7. verify installation and remaining cash
dct ls racks <dcId>
dct status

# 8. accept one contract that clearly fits
dct contract accept <contractId> <dcId>

# 9. let time pass in a controlled way
dct tick 1
dct status
dct ls contracts

# 10. if things look good, resume normal ticking
dct resume
```

---

## 11. High-value strategy guidance

- Prefer `us_west`, `us_east`, or `me_central` for early builds.
- Start with a `garage` unless you already know you need `warehouse` scale.
- Buy racks to fit **actual visible contracts**, not theoretical future demand.
- Avoid GPU racks until a GPU contract justifies them.
- Keep a cash buffer after capex; do not spend down to near-zero.
- Pause before doing a burst of build/accept actions.
- After every big decision, re-run:

```bash
dct status
dct ls contracts
```

---

## 12. Important CLI footguns / caveats

### 12.1 Prefer auto-generated IDs unless you really need custom ones

`dct dc build` and `dct racks add` both support `--id`, but the CLI also uses hidden game-targeting path logic internally.

Safest advice for normal play:

- let the CLI auto-generate datacenter and rack placement IDs
- then read those IDs back via `dct ls datacenters` / `dct ls racks <dcId>`

If you are scripting heavily, prefer explicit `--save` / `--socket` isolation.

### 12.2 Use `dct ls contracts` for the full list

Prefer:

```bash
dct ls contracts
dct ls contracts --json
```

Use `dct contract details <contractId>` when you want one contract and its recent SLA trail.

### 12.3 Full snapshot is the best agent-facing state dump

For an LLM agent, this is usually the most useful command:

```bash
dct query '{"kind":"snapshot"}' --json
```

---

## 13. What to do when helping a user play

When acting as the player's copilot:

1. ask for or obtain current state via `dct status --json` and preferably snapshot JSON
2. pause the game if they are about to plan or build
3. inspect contracts
4. compare visible contract requirements against rack catalog and cash
5. recommend a specific DC region + rack mix
6. name the exact commands to run next
7. after execution, re-check cash and contract state

If you need a minimal safe command bundle, use:

```bash
dct pause
dct status
dct ls contracts
dct ls catalog
dct ls datacenters
```

That is usually enough to plan the next move.
