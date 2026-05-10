# Playtest Results 04

**Date:** 2026-05-10  
**Seed:** 77  
**Duration:** 100 ticks  
**Starting Cash:** $2,500,000  
**Final Cash:** -$198,046 (BANKRUPT)  
**Goal:** End with cash > $2,500,000 — **FAILED**

---

## Summary

This was a painful run. Despite generating $4.33M in total revenue over 100 ticks, opex of $4.2M and penalties of $372k produced a net operational loss of -$243k, and capex spending of ~$1.955M made the final result deeply negative. The run went bankrupt at tick 100.

---

## Financial Summary

| Metric | Value |
|--------|-------|
| Starting cash | $2,500,000 |
| Final cash | **-$198,046** |
| Total revenue generated | $4,330,700 |
| Total opex paid | -$4,201,446 |
| Total penalties paid | -$372,300 |
| Net from operations | -$243,046 |
| Estimated capex spent | ~$1,955,000 |
| Reliability score (end) | **40 / 100** |

---

## Cash Timeline

| Tick | Cash | Key Event |
|------|------|-----------|
| 0 | $2,500,000 | Start |
| 0 | $1,975,000 | DC1 garage + 4 racks (C1, M1, 2×S1) |
| 5 | $1,966,461 | Slightly cash-negative (-$1,708/mo net) |
| 5 | $1,766,461 | Added S2 rack ($200k) |
| 10 | $1,871,072 | Positive cashflow period |
| 10 | $1,676,072 | Added S1 + C1 + M1 to DC1 |
| 20 | $1,926,511 | Good growth period |
| 30 | $1,826,710 | Penalties hit: -$35,900/mo × 2 ticks |
| 40 | $1,723,150 | Continued drain |
| 40 | $1,038,151 | Built DC2 garage + 6 racks ($685k) |
| 50 | $783,317 | Revenue collapsed, opex $50k/mo |
| 50 | $213,317 | Decom'd DC1 racks, reinstalled M2×2+C1+S2 ($570k) |
| 55 | $232,991 | Near zero |
| 56 | $91,814 | Danger zone |
| 61 | $325,765 | Brief recovery |
| 66 | $14,256 | Near bankruptcy |
| 71 | $392,262 | Recovery with 3 active contracts |
| 81 | $218,465 | Draining again |
| 86 | $292,973 | Stabilized briefly |
| 100 | **-$198,046** | **BANKRUPT** |

---

## What Went Wrong

### 1. The "Ghost Allocation" Problem (Critical Bug / Design Issue)

The biggest killer: **expired contracts continue holding capacity allocations**. When a contract with status `expired` (naturally completed) finishes, its vCPU, RAM, and storage allocations remain locked against the datacenter's capacity for new contract acceptance.

**Evidence:**
- DC1 total capacity: 456 vCPU / 6272 GB RAM / 2772 TB  
- DC1 available (tick 40): 296 vCPU / 1408 GB RAM / 1556 TB  
- Difference: 160 vCPU / 4864 GB RAM / 1216 TB held by expired contracts  
- DC1 effectively had **24% of compute** and **22% of storage** locked out

This made it **impossible to accept new contracts** even with ample physical hardware, and eventually forced an expensive decom+reinstall cycle that burned $570k at a critical low-cash moment.

**Attempted workarounds:**
- `dct contract cancel` on expired contracts → fails: "Cannot be cancelled from status: expired"
- Decommissioning all racks and reinstalling → freed the allocations but cost $570k

### 2. Opex Scaling vs Revenue Instability

Opex scaled linearly with rack count and was **relentless** — charged every tick regardless of whether contracts were active:

| Period | Opex/tick | Revenue/tick | Net |
|--------|-----------|--------------|-----|
| Ticks 0–5 | $21,808 | $20,100 | -$1,708 |
| Ticks 6–17 | $25,939 | $50,600 | +$24,661 |
| Ticks 45–55 | $50,239 | $40,000–$0 | -$10k–$50k |
| Ticks 87–100 | $50,073 | $0–$4,200 | -$46k/tick |

The final 8 ticks (92–100) had essentially zero revenue but full opex — a burn rate of $50k/tick × 8 = $400k drained.

### 3. Contract Term Misalignment

Contracts consistently expired between tick checks, leaving gaps with **zero revenue but full opex**. The root cause was stacking many short-term contracts (6–12 months) that expired simultaneously, creating revenue cliffs.

Example sequence:
- Ticks 28–29: penalties $35,900/mo (contracts failing)
- Ticks 37–39: revenue $29,700/mo (single contract)
- Ticks 45–48: revenue $40,000/mo then $0

### 4. GPU Market Saturation (Late Game)

By tick 60+, the market was overwhelmingly GPU contracts: Rendering Farms ($67-75k/mo) and AI Training Jobs ($76-81k/mo). These required GPU=1300-1600 FLOPS. Without any GPU racks, these lucrative contracts were inaccessible and the non-GPU market was thin (3–4 contracts at a time, often requiring more capacity than available).

### 5. DC2 Build Timing and Cost

Building DC2 at tick 40 for $685k was forced by DC1's ghost-allocation problem. But this came at the worst moment:
- DC2 built: $685k capex
- Then DC1 racks decom/reinstall: $570k capex  
- Total outflow in 5 ticks: $1.255M when cash was $1.7M
- Left only $213k cash — one bad tick away from bankruptcy

### 6. Rack Aging and Reliability

Racks installed at tick 0 were 40+ ticks old by midgame. Reliability score deteriorated from 100 → 40 over 100 ticks. Penalties ($372k total) accumulated from SLA breaches caused by hardware failures on aging racks. The skill description mentions racks have "increasing tendency to fail" — this was very real but not directly observable in the CLI (no per-rack health metrics visible).

**Observation:** The `dct ls racks` command shows installation tick but no health/failure rate. Players are flying blind on rack aging.

---

## Key Lessons for Future Playthroughs

### Lesson 1: Ghost Allocations Must Be Managed
The most critical operational issue. Either:
- Accept this as a design constraint and plan aggressively to decom/reinstall racks before allocations pile up
- Or: leave 30–40% capacity headroom at all times to absorb ghost allocations

### Lesson 2: Keep Opex Below Revenue at ALL Times
Never let the rack+DC count outpace contract revenue. Rule of thumb:
- Target: revenue ≥ 2× opex (50% margin)
- Never build racks without a specific contract ready to accept

### Lesson 3: Favor Long-Term Contracts (10–15 months)
Short-term contracts (4–7 months) expire quickly, leaving revenue gaps. Always prefer:
- 10+ month terms over 6-month terms for the same monthly rate
- Anchor urgency over standard urgency (longer visibility window)

### Lesson 4: Keep Cash Buffer ≥ $500k
- Never go below $500k cash
- The game can go from $300k → negative in 5–6 ticks if contracts expire simultaneously

### Lesson 5: Plan for GPU Contracts Early
By tick 50–60, the market is dominated by GPU contracts worth $50–80k/mo. Not having even one G1 rack ($800k) means being locked out of the highest-revenue tier in the second half of the game.

### Lesson 6: Decom Old Racks Proactively
Racks installed at tick 0 should be decom'd and reinstalled by tick 30–40. This:
- Resets failure rates (prevents SLA penalties)
- Clears ghost allocations
- Costs nothing for decom (only reinstall capex)
- Should be planned when cash is strong ($400k+ available after reinstall)

### Lesson 7: One DC, Fully Utilized > Two Half-Utilized DCs
Two garages with ghost allocations blocking them = terrible. Better to:
- Have 1 garage maxed on revenue
- Only build DC2 when DC1 is genuinely near physical capacity (not just allocation-constrained)

---

## What an Optimal Strategy Might Look Like

Based on this experience, a winning 100-tick strategy should:

1. **Ticks 0–10:** Build garage + 4 racks minimum. Accept 1–2 long-term contracts. Hold $1.5M+ cash.
2. **Ticks 10–20:** Add 1–2 more racks to serve a 2nd contract. Stay above $1M cash.
3. **Ticks 20–30:** Decom + reinstall tick-0 racks to prevent aging. Accept fresh long-term contracts.
4. **Ticks 30–50:** Build DC2 only when cash is $1.5M+ and DC1 is physically full. Target GPU rack (G1) if cash allows.
5. **Ticks 50–70:** Focus on GPU contracts if G1 rack installed — these pay $50–80k/mo vs $30–40k for storage.
6. **Ticks 70–100:** Wind down capex. Accept only long-term contracts. Keep revenue > 2× opex.

---

## Game Design Observations

1. **Ghost allocation bug:** Expired contracts locking capacity is the #1 gameplay blocker. Needs a clear UI indicator and/or auto-release after some ticks.
2. **No rack health visibility:** Players can't see per-rack failure rates. Should show age and health percentage in `dct ls racks`.
3. **Market GPU saturation:** After tick 50, GPU contracts dominate. Non-GPU players are systematically excluded from high-value contracts.
4. **Reliability score (40/100):** Degraded severely. Penalties of $372k could have been prevented with rack decom/reinstall earlier. Reliability should be shown more prominently.
5. **Opex calculation opacity:** Players can't easily see the breakdown of opex (power cost × region, staff, maintenance per rack). A `dct opex breakdown` command would help players optimize.
6. **Contract capacity check accuracy:** The `dct contract accept` capacity check does account for expired contracts — but incorrectly (expired contracts should release capacity). This causes a catch-22 where players can't accept new contracts AND can't cancel expired ones.
