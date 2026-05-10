# Playtest Results 02

**Date:** 2026-05-10  
**Seed:** 99  
**Duration:** 60 ticks  
**Starting Cash:** $2,500,000  
**Final Cash:** $536,336  

---

## Summary of Play

### Financial Performance
| Metric | Value |
|--------|-------|
| Starting cash | $2,500,000 |
| Final cash | $536,336 |
| Net loss | -$1,963,664 |
| Total revenue earned | $2,498,900 |
| Total opex paid | -$2,609,764 |
| Total penalties paid | -$177,800 |
| Net from operations | -$288,664 |
| Estimated capex spent | ~$1,675,000 |
| Reliability score (end) | 71/100 |

### Cash Timeline
| Tick | Cash | Event |
|------|------|-------|
| 0 | $2,500,000 | Start |
| 0 | $1,815,000 | After building garage DC1 + 6 racks |
| 0 | $1,655,000 | After accepting first 3 contracts |
| 10 | $1,795,077 | After 10 ticks (positive cashflow) |
| 20 | $1,835,410 | After building DC2 + 8 more racks |
| 20 | $1,005,410 | After DC2 build ($830k capex) |
| 30 | $1,044,188 | Slow growth (+$39k) |
| 40 | $1,298,136 | Good growth (+$254k) |
| 50 | $1,056,594 | Cash dip (-$242k) as contracts expired |
| 60 | $536,336 | Final — opex outpaced revenue |

---

## Build Strategy

### Datacenter 1: Garage in us_west (built tick 0)
- **Cost:** $250,000
- **Layout:** 2×4 = 8 slots, 60kW capacity
- **Racks installed:** 1×C1, 1×M1, 6×S1
  - Total: 320 vCPU, 4096 GB RAM, 3000 TB storage
  - Capex: $50k + $65k + 6×$80k = $595k
- **Total DC1 investment:** ~$845,000

### Datacenter 2: Garage in us_west (built tick 20)
- **Cost:** $250,000
- **Layout:** 2×4 = 8 slots
- **Racks installed:** 3×S1, 1×C1, 2×M1, 2×S1 (=5×S1 + 1×C1 + 2×M1)
  - Total: 344 vCPU, 5888 GB RAM, 2556 TB storage
  - Capex: 5×$80k + $50k + 2×$65k = $580k
- **Total DC2 investment:** ~$830,000

**Total capex:** ~$1,675,000

---

## Contract Portfolio

### Contracts Accepted (All 11)
| Contract Name | Revenue/mo | Term | Status at End |
|---|---|---|---|
| Small Data Storage Startup (×5) | $27,800 | 6mo | Expired |
| Small Data Storage Startup | $23,400 | 10mo | Expired |
| Small Data Storage Startup | $40,000 | various | Expired |
| Small Data Storage Startup | $25,000 | 8mo | Expired |
| Small Data Storage Startup | $20,000 | 10mo | Expired |
| Edge Compute Burst (×2) | $20,900, $17,600 | 14mo, 8mo | Expired |
| Small Data Storage Startup | $42,400 | 10mo | Expired |
| In-Memory Database Migration | $30,700 | 10mo | Expired |
| Small Data Storage Startup | $47,500 | 10mo | Expired |
| Small Data Storage Startup | $52,500 | 11mo | Expired |

All 11 contracts were in "expired" status at end of game — meaning they were fulfilled and naturally completed their term.

---

## Key Observations

### 1. Opex was the biggest drag
- Opex (~$52k/mo) exceeded revenue in many ticks as contracts expired and weren't immediately replaced
- With 16 racks across 2 garages, maintenance costs were substantial ($500-$800/rack/mo)
- The game requires nearly constant contract coverage to stay cash-positive

### 2. "Expired" status ≠ broken
- All contracts showed "expired" status but revenue was still being counted — `expired` appears to mean the contract *term ended naturally* (fulfilled), NOT that it failed
- Contracts may continue paying revenue even after shown as "expired" (this is confusing UX/data)
- Penalties ($177,800 total) suggest some SLA breaches did occur, likely from rack failures on aging hardware

### 3. GPU contracts dominated the market but were unserviceable
- By tick 30+, the market was overwhelmingly GPU contracts: Rendering Farms, AI Training Jobs
- These needed GPU=950-1600 FLOPS — none of my racks had GPU capability
- This left few non-GPU contracts available mid-to-late game, starving revenue

### 4. Storage-heavy strategy worked early but hit a wall
- 11× S1 storage racks served well for initial contracts ($27k-$52k/mo each)
- But storage slots were exhausted by tick 20, limiting further contract acceptance
- DC1 ended with only 500TB available and DC2 with 260TB — both storage-constrained

### 5. Capex was too aggressive relative to income
- Spent ~$1.675M on capex (two garages + 16 racks) leaving little buffer
- When opex ~$52k/mo and revenue ~$40k/mo (as contracts expired), cash drained fast
- A better strategy would be to stagger DC2 construction, or build fewer racks initially

### 6. 1 tick ≈ 1 month (confirmed by contract terms matching ticks)
- A 6-month contract accepted at tick 0 expired around tick 6 — confirmed tick=month

### 7. Warehouse was out of reach
- At $1.4M capex plus rack costs, a warehouse would have needed $2M+ and was never affordable given the cash position post-DC1

---

## Recommendations for Future Playthroughs

### Strategy Improvements
1. **Keep at least $500k cash reserve** after capex — avoid going under $1M mid-game
2. **Don't fill all rack slots at once** — leave room to adapt to incoming contracts
3. **Mix in a C1 and M1 from the start** — many contracts need RAM or compute diversity, not just storage
4. **Watch contract term lengths** — prefer 10-14 month terms over 6-month terms for stability
5. **Avoid accepting contracts near their expiry tick** — they expire before generating meaningful revenue

### Balance/Bug Observations
1. **"Expired" status is confusing** — `expired` should mean "naturally completed" not "failed/breached". Consider renaming to `completed` or `fulfilled`
2. **GPU market saturation** — by mid-game 80%+ of market contracts needed GPU. Non-GPU players are squeezed out. Consider better market distribution
3. **Reliability score degradation** (71 at end, dropping) — unclear what caused breaches since rack age/failure mechanics aren't visible to player
4. **Opex scaling** — at $52k/month opex for 16 racks, it's hard to stay profitable unless all racks are serving active contracts. Empty rack slots are pure loss
5. **Storage bottleneck in garages** — 6 S1 racks (3000TB) fill up fast with just 2-3 storage contracts. The garage tier caps storage capacity quickly

### Ideal Opening (revised)
1. Build garage in `us_west` ($250k)
2. Add only 4 racks initially: 1×C1, 1×M1, 2×S1 (~$275k)
3. Accept 1-2 contracts that fit
4. Wait 10 ticks — check new market, accept more if favorable
5. Add remaining 4 racks only after identifying which contracts to serve
6. Target contracts with 10+ month terms to maximize revenue per capex dollar
