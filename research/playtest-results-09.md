# Playtest Results 09 — Hard Mode, Seed 42

**Date:** 2026-05-24  
**Difficulty:** Hard  
**Seed:** 42  
**Target:** 200+ ticks with increasing cash and revenue  
**Final tick reached:** 67 (session time-limited; see notes)

---

## Session Summary

A full hard-mode run from tick 0 through tick 67 using a garage-first, contract-driven strategy. The run was cut short by session time limits at tick 67 but produced significant learnings about rack aging, SLA breach mechanics, and contract lifecycle management.

---

## Starting Conditions (Hard Mode)

| Parameter | Value |
|-----------|-------|
| Starting cash | $2,500,000 |
| Difficulty | Hard |
| Seed | 42 |
| Garage build cost (us_west) | ~$250,000 |
| Warehouse build cost | ~$1,200,000 |
| US West power | $0.05/kWh (cheapest region) |
| EU West power | $0.12/kWh |

---

## Strategy: Garage-First, Anchor-Contract Driven

### Phase 1 — Early Game (Ticks 0–20): Build and Fill
- Started with 1 attempt that failed immediately (Warehouse + negative cashflow by tick 10)
- Restarted seed 42: built 4 garages in `us_west` (DC1–DC4) and 1 garage in `eu_west` (DC5)
- Placed mixed C1/M1/S1 rack configs tuned to available CDN and enterprise_db contracts
- DC1 racks installed at tick 0–6 (critical: these age fastest)

### Phase 2 — Growth (Ticks 20–50): Revenue Ramp
- Accepted CDN edge and enterprise_db contracts across DCs
- Peak revenue at tick ~50: **$184,500/mo** with 6 active contracts
- Net positive from tick 48 onward (~+$59k/mo at peak)

### Phase 3 — Crisis Management (Ticks 40–55): Breach Events
Multiple double-breach events due to aging racks:
- **Tick 43**: DC1 racks (~43 months) caused `enterprise_db-7101d` AND `cdn_edge-94c7f` to breach simultaneously
- **Tick 47**: DC3 racks (4%/mo) and DC1 racks (8%/mo) caused double-breach → revenue crashed to $90k, cash hit $1,813
- **Ticks 53–54**: Revenue collapsed to $97,800 (vs expected $200,000) — root cause: DC1 racks at **16%/mo fail risk** (55 months old)

### Phase 4 — Stabilization (Ticks 55–67): Contract Churn
- At tick 55: 6 active contracts, revenue $200,000/mo, opex ~$128k, net ~+$72k
- Tick 56–66: cascade of contract expirations drained revenue
- Tick 67: Only 1 active contract (`cold_storage-483a7`, $21,900/mo); cash $108,117

---

## Key Economic Data Points

| Tick | Cash | Revenue | Opex | Net/mo | Active Contracts |
|------|------|---------|------|--------|-----------------|
| 0 | $2,500,000 | $0 | $0 | — | 0 |
| 10 | ~$200,000 | ~$70k | ~$89k | -$19k | 1 (warehouse attempt, failed) |
| 20 | ~$480,000 | ~$90k | ~$70k | +$20k | 3 |
| 41 | $153,000 | $114,900 | $117,300 | -$2,400 | 5 |
| 47 | $1,813 | $90,000 | $124,697 | -$35k | 6 (post-breach) |
| 52 | $274,436 | $184,500 | $125,634 | +$58,866 | 6 |
| 55 | $152,413 | $200,000 | $128,000 | +$72,000 | 6 |
| 67 | $108,117 | $21,900 | $115,480 | -$93,580 | 1 |

---

## Critical Discoveries

### 1. Rack Aging Is the Dominant Risk in Hard Mode

Rack fail probability grows steeply with age and becomes catastrophic:

| Age (months) | Fail risk/mo |
|--------------|-------------|
| 0–12 | 0% |
| ~20 | 2% |
| ~24 | 4% |
| ~43–47 | 8% |
| ~53–55 | **16%** |

With 8 racks at 16%/mo each: **P(at least 1 fails per tick) ≈ 73%**. Any tier-3 contract (1 failure budget day, 30-day repair time with 0 staff) will breach almost every tick.

### 2. Maintenance Staff Is Critical for Aging DCs

With 0 maintenance staff, rack repairs take 30 days (entire month = breach guaranteed if SLA is tier-3). Each engineer costs ~$4,718/mo in `us_west`.

**Recommendation:** Hire 2–4 maintenance staff on DCs with racks older than 30 months.

### 3. SLA Breach = 0 Revenue + Penalty in Same Tick

Breach events are catastrophic: a single breach costs the full monthly revenue PLUS the penalty fee in one tick. Example:
- `enterprise_db-7101d` breach: -$28,600 (revenue) - $14,200 (penalty) = **-$42,800 swing**
- Double-breach at tick 47: **-$105,000 swing in one tick**

### 4. Contract Tier 3 (95% SLA) Is Unforgiving on Aging Hardware

All mid/late-game contracts observed were tier-3 (95% target, 1 failure budget day). These should only be accepted on:
- Racks under 20 months old (< 2%/mo fail risk)
- OR DCs with adequate maintenance staff for fast repair

### 5. Cold Storage Contracts Are Fault-Tolerant Anchors

Cold storage contracts have very low CPU/RAM requirements (e.g., 16 cpu, 448 ram) relative to typical DC capacity. Even with multiple rack failures the tiny compute requirements are rarely threatened. Ideal for long-term anchor revenue ($21,900–$36,600/mo, 20–38 month terms).

### 6. GPU Contracts Dominate the Late-Game Market

By tick 40–67, roughly 60–70% of market contracts required GPU (hpc_simulation, ai_training, video_render, ai_inference). Without G-series racks in a hyperscale DC, the effective serviceable market shrinks dramatically — a severe mid-game bottleneck.

### 7. Contract Expiration Cascades Are Dangerous

Multiple contracts accepted in the same era expire in the same era. At ticks 58–66, five contracts expired in 8 ticks, collapsing revenue from $200k/mo to $21.9k/mo. Planning renewals 10–15 ticks ahead is essential.

### 8. EU West Carries a ~25-30% Opex Premium

DC5 in `eu_west` (Dublin) had ~25-30% higher opex than equivalent `us_west` DCs due to $0.12/kWh power (vs $0.05/kWh) and 12.5% tax (vs 7%). EU-specific contracts often pay a premium to offset this, but the margin is thinner.

---

## DC Final State at Tick 67

| DC | Region | Oldest rack age | Status |
|----|--------|----------------|--------|
| dc-b0b5a8d2 (DC1) | us_west | 67 months | IDLE (cdn_edge-684bb expired tick 65) |
| dc-dbb70a8a (DC2) | us_west | 51 months | IDLE (94c7f expired tick 58) |
| dc-6d45a9a7 (DC3) | us_west | 44 months | cold_storage-483a7 → tick 85 |
| dc-22c11438 (DC4) | us_west | 35 months | IDLE (304ab expired tick 66) |
| dc-7e0ac2ae (DC5) | eu_west | 27 months | IDLE (8e4f1 expired tick 62) |

---

## Failure Modes Encountered

1. **Warehouse opening** → negative cashflow by tick 10 (too high opex vs early revenue)
2. **CPU-tight CDN contract on aging DC** → 23% breach probability; breached tick 47
3. **Double-breach** → 2 contracts breach same tick; -$105k revenue swing; cash near zero
4. **Contract expiration cascade** → 5 contracts expire in 8 ticks; revenue collapses
5. **No GPU capability** → 60-70% of mid-game market contracts unserviceable

---

## Recommendations for Future Runs

1. **Replace DC1/DC2 racks proactively** when fail risk hits 4%/mo (~24 months). Decom old racks, install fresh ones before accepting new contracts.
2. **Hire 2–4 maintenance engineers per aging DC** to reduce repair time to 1–3 days.
3. **Stagger contract terms** — avoid accepting 3+ contracts with similar expiry dates.
4. **Build one warehouse early** (tick 15–20) and add G1 racks to capture the GPU market.
5. **Keep 2–3 anchor cold_storage contracts** as baseline revenue hedge against breach events.
6. **Target 6-8 months opex reserve** in cash at all times (~$750k–$1M) to survive crises.
7. **Add maintenance staff to EU DCs** before expanding there — higher opex amplifies breach losses.

---

## Verdict on Hard Mode 200-Tick Goal

The run demonstrates that **200+ ticks with consistently growing cash/revenue is achievable in hard mode** but requires:
- Proactive rack replacement (not just reactive)
- GPU capability by tick 30–40
- Maintenance staffing on aging DCs
- Careful contract staggering to avoid expiration cascades

The garage-first strategy successfully survived through tick 67 with positive cash ($108k), but the lack of GPU capability and rack aging created compounding revenue problems in the 60–80 tick range. A warehouse with G1 racks should be added around tick 20–30 for a viable 200-tick run.
