# Playtest Results - May 24, 2026 (Hard Mode 200+ Tick Endurance)

## Overview
This playtest session focused on **hard mode endurance**: attempting to run for 200+ ticks while maintaining or increasing cash and revenue. Multiple seeds and strategies were tested to find a sustainable long-term approach.

## Test Parameters
- **Difficulty**: Hard ($2.5M starting cash, failure curve [0,2,4,8,16,32]%)
- **Goal**: 200+ ticks with increasing cash and revenue
- **Region**: us_west (cheapest power at $0.05/kWh, staff $5,800)
- **DC Type**: Garage (lowest fixed costs)

## Key Economic Constants (Hard Mode, us_west)

| Cost Category | Monthly Amount |
|---|---:|
| Staff (2 base) | $11,600 |
| Bandwidth (80 Gbps × $85) | $6,800 |
| Power + Cooling (6 racks) | ~$4,000 |
| **Total Fixed Opex per Garage** | **~$22,400** |
| Amortized rack replacement (every 20 ticks) | ~$19,000 |
| **Effective Total Cost per DC** | **~$41,400** |

## Strategies Tested

### Strategy 1: Spread-Thin (Seed 100) — FAILED at T10
- 4 garages across us_west and eu_west, 4 contracts
- Opex far exceeded revenue; cash dropped $797k → $460k in 10 ticks
- **Lesson**: Too many DCs with 1 contract each = guaranteed bankruptcy

### Strategy 2: Long-Term Contracts (Seed 200) — MARGINAL
- 5 garages, 5 contracts ($104k/mo revenue)
- Margins only +$1.1k/tick — not sustainable with rack aging
- **Lesson**: Even stacking contracts, margins are razor-thin

### Strategy 3: Multi-Contract Stacking (Seed 42) — FAILED at T56
- 2 garages with 2 contracts each
- Peak: +$34.7k/tick with 4 contracts on 2 DCs
- Racks aged to 43-50 months (8-16% failure), contracts cancelled
- **Lesson**: Without rack replacement, any strategy fails by T50-60

### Strategy 4: Rack Replacement Awareness (Seed 300) — FAILED at T90
- 2 DCs, proactive replacement at T60 and T62
- Replacement cost $780k total wiped out cash reserves
- Could not recover due to contract gaps during replacement windows
- **Lesson**: Replacement cost ($380k/DC) is enormous; needs careful timing

### Strategy 5: Cold Storage Anchor (Seed 500) — PARTIAL SUCCESS to T100
- 1 DC with heavy storage (C1×3 + S1×3 + S0)
- Cold storage contracts are failure-resilient (only 16 vCPU needed)
- Peak cash: $2,264,594 at T41
- Without replacement: active racks → 0 by T70 (32% failure rate)
- **Lesson**: Cold storage buys time but doesn't solve aging

### Strategy 6: Automated Proactive Replacement (Seed 777) — BEST RUN, 200+ Ticks ✓

**Configuration:**
- 1 garage in us_west
- Rack loadout: C1×3 + S1×2 + S0 (storage-heavy for cold storage contracts)
- Rack replacement every 20 ticks (when no active contracts and cash > $500k)
- Contract acceptance: longest-term first, prefer cold_storage > cdn_edge

**Full Cash Trajectory:**

| Tick | Cash | Active Contracts | Event |
|---:|---:|---:|---|
| 0 | $1,870,000 | 0 | DC built + racks placed |
| 6 | $1,742,621 | 1 | Accepted cold_storage $25.8k×15mo |
| 12 | $1,765,793 | 2 | Accepted cdn_edge $21.3k×10mo |
| 20 | $1,953,184 | 2 | — |
| 22 | $1,976,223 | 0 | Rack replacement #1 |
| 32 | $1,383,925 | 1 | Accepted cdn_edge $58.8k×3mo |
| 35 | $1,487,158 | 2 | Accepted cdn_edge $41.2k×11mo |
| 40 | $1,577,372 | 1 | — |
| 46 | $1,685,628 | 0 | Rack replacement #2 |
| 46 | $1,305,628 | 1 | Accepted cdn_edge $44.7k×9mo |
| 55 | $1,496,673 | 2 | Accepted cdn_edge $36.6k×7mo |
| 60 | $1,565,673 | 1 | — |
| 66 | $1,508,354 | 0 | Rack replacement #3 |
| 70 | $1,043,435 | 1 | Accepted cdn_edge $40.9k×8mo |
| 80 | $1,143,086 | 0 | — |
| 86 | $1,142,384 | 0 | Rack replacement #4 |
| 86 | $762,384 | 1 | Accepted cdn_edge $42.1k×10mo |
| 97 | $929,952 | 2 | Accepted cold_storage $28.7k×21mo |
| 100 | $949,311 | 1 | — |
| 118 | $1,023,287 | 0 | Rack replacement #5 |
| 118 | $643,287 | 1 | Accepted cdn_edge $46.5k×9mo |
| 120 | $689,231 | 1 | — |
| 127 | $850,034 | 2 | Accepted cdn_edge $45.1k×7mo |
| 134 | $870,836 | 2 | Accepted cdn_edge $24.6k×17mo |
| 140 | $854,576 | 1 | — |
| 151 | $883,617 | 0 | Rack replacement #6 |
| 157 | $376,238 | 1 | Accepted cold_storage $32.4k×18mo |
| 160 | $406,026 | 1 | — |
| 175 | $461,138 | 2 | Accepted cold_storage $35k×23mo |
| 180 | $470,725 | 1 | — |
| 183 | $351,741 | 2 | Accepted cdn_edge $66.8k×4mo |
| 187 | $518,862 | 0 | Rack replacement #7 |
| 187 | $138,862 | 1 | Accepted cold_storage $23.3k×36mo |
| 200 | $157,466 | 1 | — |

**Result**: Survived 200+ ticks but cash **declined** from $1,870,000 → $157,466 (−91.6%).

## Analysis

### Why Sustained Cash Growth Is Not Achievable in Hard Mode

The fundamental problem is that **effective monthly costs exceed achievable revenue per garage**:

1. **Fixed opex**: ~$22,400/mo (unavoidable once DC is built)
2. **Amortized rack replacement**: ~$19,000/mo ($380k every 20 ticks)
3. **Total effective cost**: ~$41,400/mo per DC
4. **Average contract revenue**: $35,000-$45,000/mo (typical CDN/cold storage)
5. **Net margin**: −$6,400 to +$3,600/mo

The math simply doesn't work for sustained growth. Even with perfect contract acceptance, the rack replacement cycle ensures net-negative cash flow over long horizons.

### The Rack Replacement Death Spiral

```
Tick 0-20:   Revenue accumulates, cash grows slightly
Tick 20-22:  Must replace racks ($380k hit) — need contract-free window
Tick 22-30:  No revenue while finding new contracts  
Tick 30-46:  Revenue resumes, partially recovers replacement cost
Tick 46:     Next replacement cycle begins...
```

Each cycle:
- Costs $380k in rack replacement
- Loses 4-8 ticks of revenue waiting for contract-free window + new acceptance
- Net recovery per cycle: only $200-300k in revenue
- **Each cycle bleeds $80-180k net**

### The Failure Curve Is the Core Balance Issue

Hard mode's failure curve `[0, 2, 4, 8, 16, 32]%` makes racks economically unviable past 24 months:

| Age (months) | Failure %/mo | Probability all 6 racks survive | Expected breaches/mo |
|---:|---:|---:|---:|
| 12 | 2% | 88.6% | 0.12 |
| 24 | 4% | 78.3% | 0.24 |
| 36 | 8% | 60.6% | 0.48 |
| 48 | 16% | 33.2% | 0.96 |
| 60 | 32% | 9.9% | 1.92 |

At 24+ months, breaches become frequent enough to trigger contract cancellation penalties, making it MANDATORY to replace racks every 20-24 ticks.

## Conclusions

### 1. Hard mode 200+ tick survival IS possible
With proactive rack replacement every 20 ticks and cold-storage-focused contracts, a player can survive 200+ ticks. Seed 777 demonstrated this.

### 2. Sustained cash GROWTH is NOT achievable with current balance
The amortized cost of mandatory rack replacement ($19k/mo) combined with fixed opex ($22.4k/mo) exceeds what a single garage can earn. Cash will always trend downward over 200+ ticks.

### 3. Revenue oscillates, never compounds
Revenue is contract-bound with fixed terms. There's no compounding mechanism — you can't invest profits to earn more. Each contract cycle starts from scratch.

## Balance Recommendations

To make 200+ tick sustained growth achievable in hard mode:

1. **Reduce rack replacement cost** — Currently $380k/cycle for a garage is too punishing. Consider a 30-50% cost reduction for "refurbished" rack replacements.

2. **Soften the failure curve** — Change from `[0,2,4,8,16,32]` to `[0,1,2,4,8,16]` so racks last 30-36 months economically instead of 20-24.

3. **Add partial rack repair** — Allow repairing individual racks ($50-100k) instead of full decommission+replace ($100k per rack). This would let players maintain capacity while under contract.

4. **Introduce contract renewal bonuses** — Completing a contract should offer a renewal at slightly better terms, rewarding long-term reliability.

5. **Reduce bandwidth cost** — At $85/Gbps/mo ($6,800/mo for a garage), bandwidth is the second-largest fixed cost and offers no player agency. Reducing to $50-60/Gbps would improve margins by $2-3k/mo.

## Session Summary

| Metric | Value |
|---|---|
| Seeds tested | 42, 100, 200, 300, 500, 777 |
| Longest run | 200+ ticks (seed 777) |
| Best strategy | 1 garage, cold storage focus, replace every 20 ticks |
| Peak cash achieved | $2,264,594 (seed 500, T41) |
| Cash at T200 | $157,466 (seed 777) |
| Sustainable growth? | **No** — not with current hard mode balance |
| Survival possible? | **Yes** — with disciplined rack replacement |
