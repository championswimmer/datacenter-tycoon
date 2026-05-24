# Playtest Results 12 - Hard Mode 200+ Tick Run Attempt

**Date:** 2026-05-24  
**Mode:** Hard  
**Interface:** CLI (`dct`) with isolated `--save` / `--socket` files  
**Goal:** Run beyond 200 ticks while increasing cash and revenue  
**Result:** **FAILED** — one run was advanced past 200 ticks, but neither strategy could sustain positive cashflow.

---

## Summary

I ran two hard-mode CLI playtest attempts focused on keeping revenue above opex long enough to pass tick 200. Both openings produced short early revenue gains, but hard-mode contract churn and operating costs overtook the business before tick 40.

The longer recorded run reached **tick 225**, but it was deeply bankrupt by then: **-$15,634,565 cash**, **$0 active revenue**, and **$78,713/mo idle opex**. The main failure mode was not initial build affordability; it was the inability to replace expired early contracts with contracts that fit the existing non-GPU hardware before fixed datacenter opex drained cash.

---

## Attempt A: Warehouse Consolidation

**Seed:** 3607  
**Opening:** 1 warehouse in `us_west`, 17 total racks after early additions  
**Initial accepted revenue:** $108,600/mo  
**Final observed tick:** 38  
**Final cash:** -$135,351  
**Total revenue:** $3,653,000  
**Total opex:** -$3,527,151  
**Total capex:** -$2,642,500

### Timeline

| Tick | Cash | Monthly Revenue | Monthly Opex | Notes |
|------|------:|----------------:|-------------:|-------|
| 0 | $275,000 | $108,600 | n/a | Warehouse + starter rack pack; cash buffer too thin. |
| 5 | $230,402 | $108,600 | -$90,020 | Added $137,500 of racks for a short high-paying replacement. |
| 10 | $199,209 | $112,100 | -$93,204 | Still positive, but low cash buffer. |
| 20 | $312,162 | $115,200 | -$93,976 | Best stable point. |
| 30 | $18,344 | $83,200 | -$91,819 | Contract revenue cliff. |
| 34 | -$29,682 | $0 | -$92,530 | Penalty/revenue gap pushed cash negative. |
| 38 | -$135,351 | $129,900 | -$95,292 | Revenue recovered, but too late to avoid bankruptcy spiral. |

### Finding

The warehouse strategy can create high starting revenue, but the **$90k+/mo opex floor** leaves almost no margin unless revenue stays above roughly $120k/mo continuously. The first replacement gap erased the cash buffer before the market produced a good fitting set of contracts.

---

## Attempt B: Garage Grid to 200+ Ticks

**Seed:** 9758  
**Opening:** 4 garages in `us_west`, 19 racks, one tailored contract per garage  
**Initial accepted revenue:** $89,400/mo  
**Final tick:** 225  
**Final cash:** -$15,634,565  
**Final active revenue:** $0/mo  
**Total revenue:** $1,295,600  
**Total opex:** -$17,733,965  
**Total capex:** -$1,670,000

### Timeline

| Tick | Cash | Monthly Revenue | Monthly Opex | Notes |
|------|------:|----------------:|-------------:|-------|
| 0 | $830,000 | $89,400 | n/a | Four-garage opening retained a much better cash buffer. |
| 5 | $875,810 | $89,400 | -$80,238 | Cash increased briefly. |
| 10 | $833,354 | $45,400 | -$79,441 | First revenue cliff after short contracts expired. |
| 15 | $608,523 | $24,500 | -$79,208 | Only one replacement fit the existing fleet. |
| 20 | $335,446 | $24,600 | -$79,215 | Still alive, but strongly cash-negative. |
| 25 | -$12,406 | $24,600 | -$79,215 | Bankrupt before tick 30. |
| 31 | -$364,196 | $0 | -$78,713 | No active contracts remained. |
| 225 | -$15,634,565 | $0 | -$78,713 | Advanced past 200 ticks only to observe idle-burn behavior. |

### Finding

The garage grid had a safer opening than the warehouse and briefly increased cash from **$830k to $875.8k**, but it failed to replace expired contracts. By tick 10, revenue had nearly halved while opex stayed near $80k/mo. Once revenue dropped below opex, the four garages became an unrecoverable fixed-cost burden.

---

## Key Observations

1. **Hard mode punishes short-term contracts severely.** Even profitable openings collapsed when 6-9 month contracts expired before enough replacement contracts fit existing hardware.
2. **The market outgrew starter non-GPU builds quickly.** By the time early contracts ended, many visible offers required GPU capacity, larger RAM footprints, or region affinities that did not match the built region.
3. **Idle datacenter opex is the primary killer.** The 4-garage run paid about **$78.7k/mo** even with $0 revenue after contracts expired.
4. **Warehouse opening is too cash-thin.** It can reach higher revenue, but the initial capex leaves too little room for replacement racks, maintenance, or bad market rolls.
5. **Garage opening is safer but stalls.** It preserves cash better, but individual garages are too specialized; once their matching contracts expire, replacement fit becomes unreliable.

---

## Recommendations

- Add a way to reduce or retire idle datacenter fixed opex, or make idle infrastructure mothballing explicit.
- Surface market-fit warnings before a contract portfolio expires, especially when no visible replacement fits existing hardware.
- Consider smoothing hard-mode contract progression so non-GPU replacements remain available longer.
- For future playtests, try an opening that reaches GPU capability earlier, but only if a seed provides enough long-term revenue to keep at least a $700k cash buffer after capex.

---

## Conclusion

I could advance a hard-mode run past 200 ticks, but I could not do so while increasing cash and revenue. The best early result was the 4-garage opening, which increased cash by **$45,810** in the first 5 ticks, but it became bankrupt at tick 25 due to revenue churn and fixed opex. The current hard-mode economy appears to require either very favorable market sequencing or a stronger midgame bridge into GPU-capable contracts.
