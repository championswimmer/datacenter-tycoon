# Playtest Results — Session 02

**Date**: 2026-05-10  
**Agent**: Claude (AI coding assistant)  
**Seed**: 7  
**Duration**: 13 ticks (months) of in-game time  
**Final cash**: ~$1.072M  
**Playstyle**: Careful early expansion, two-garage setup, contract-reactive play

---

## 1. Session Summary

I installed and built the latest local CLI, then played a longer paused/resume CLI session with `dct`. The opening was deliberately conservative: I paused time, inspected the market, built a second garage datacenter in `us_west`, added a balanced mix of racks, and accepted a few contracts as they became available. By tick 13, the game was still healthy and I had kept a cash buffer above $1M while running 2 datacenters and 4 active contracts.

The session felt stable and recoverable. I did not overbuild aggressively, and I reacted to the market as it changed instead of trying to over-optimize every move.

---

## 2. What Went Well

### 2.1 The CLI play loop is straightforward
The `pause → inspect → build → add racks → accept contract → tick` loop works naturally. It is easy to pause the simulation, make a batch of changes, and then resume without losing control of the state.

### 2.2 `--json` and snapshot output are very useful
`dct status --json`, `dct ls contracts --json`, `dct ls datacenters --json`, and especially `dct query '{"kind":"snapshot"}' --json` gave enough information to reason about the game without guessing. The snapshot made it easy to confirm cashflow, capacity, and contract assignment.

### 2.3 Early region choice mattered
Building in `us_west` felt like the right move. Cheap power and reasonable taxes made it a good early region for a garage build. `us_east` was also viable, but `us_west` seemed more forgiving for opex.

### 2.4 Rack and contract data are readable enough to play
The catalog and contract list exposed the key numbers needed to keep playing without deep math. I could make reasonable decisions quickly instead of overthinking every contract.

### 2.5 The game tolerates partial expansion well
A second garage did not instantly put me into danger. That is a good sign: it means gradual build-out is possible, and players are not forced into huge all-in investments immediately.

---

## 3. What Was Hard / Friction Points

### 3.1 Contract fit still requires care
One GPU-heavy contract could not be accepted on my current datacenter because it required GPU capacity that I did not have. That failure was correct, but it reinforced that acceptance still depends on manual capacity awareness.

**Impact**: You can still waste time probing contracts that obviously do not fit the current fleet.

### 3.2 Opex is visible, but still feels like a moving target
By tick 13 I was down from the starting cash, but not dangerously so. That said, the monthly opex is still something you mostly experience through the ledger rather than through a strong pre-commitment forecast.

**Impact**: The game is playable, but it is easy to underestimate how much a second DC costs over time.

### 3.3 Some contract waves can tempt overexpansion
As new offers appeared, especially storage and in-memory contracts, it was tempting to build more infrastructure right away. The challenge is resisting that urge and keeping the build pace slow enough to avoid cash burn.

**Impact**: This is good tension, but it can push inexperienced players into overbuilding.

### 3.4 Hardware failures are easy to miss if you are only watching contracts
One rack in `dc-1` had a failure history in the snapshot. It did not immediately break the session, but it is a reminder that hardware health matters and should be checked alongside contract lists.

**Impact**: If a player focuses only on market offers, they may miss degradation or capacity loss in an existing DC.

---

## 4. Game Balance Observations

### 4.1 Small storage contracts remain attractive
The storage startup contracts are still easy to pursue with a modest garage build. They seem like good early-game anchor work as long as you do not overcommit to them.

### 4.2 In-memory contracts are a good mid-range target
They need more RAM than basic compute work, but they are still feasible with the right garage mix. They feel like a sensible step up from the simplest storage deals.

### 4.3 GPU work is still a separate class of problem
GPU requirements are clearly a late-game or specialized path. That is fine, but the market can surface them early enough that they serve more as noise than as viable targets.

### 4.4 Two garages felt sustainable
At this stage, 2 garage DCs with 9 racks total felt manageable. Cash was still positive and the business was not spiraling. That suggests the early balance is reasonably forgiving if the player is patient.

---

## 5. CLI UX Observations

| Command | Works? | Notes |
|---|---|---|
| `dct pause / resume` | ✅ | Reliable and important for planning |
| `dct status --json` | ✅ | Best quick health check |
| `dct ls contracts --json` | ✅ | Good for market scanning |
| `dct ls datacenters --json` | ✅ | Clear DC inventory view |
| `dct query '{"kind":"snapshot"}' --json` | ✅ | Best deep state dump |
| `dct dc build garage --region us_west` | ✅ | Clean early-game build action |
| `dct racks add ...` | ✅ | Straightforward placement flow |
| `dct contract accept <id> <dcId>` | ✅ | Correctly rejects insufficient capacity |

---

## 6. How Well Did I Play?

**Grade: B**

### What I got right
- Paused before making infrastructure decisions
- Chose `us_west` for the second garage
- Kept the build gradual instead of overbuilding too fast
- Maintained a healthy cash buffer above $1M by tick 13
- Reacted to contracts as they appeared rather than forcing risky expansions

### What I could improve
- I still spent some time probing contracts that were obviously not a fit, especially GPU-heavy work
- I could have been even more deliberate about rack expansion relative to actual contract demand
- I should keep watching the ledger more closely so opex never becomes a surprise

---

## 7. Overall Takeaway

This playtest felt like a good demonstration of the current CLI loop. The game is easy to pause, inspect, and play in short controlled bursts. The economy also seems to support a cautious style: if you expand slowly and avoid chasing every shiny contract, you can stay solvent for a long time.

The best practical strategy so far is still:

1. pause
2. inspect the market and your cash
3. build only when a contract or obvious opportunity justifies it
4. avoid GPU commitments until the fleet is ready
5. keep a cash buffer and do not overbuild

The session was fun, readable, and stable, and the local latest CLI build worked without issues.
