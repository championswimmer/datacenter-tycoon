# Playtest Results - May 24, 2026 (Rack / Contract Rebalance Follow-up)

## Overview
This focused validation pass checked whether the rack-capex and contract-unit-economics rebalance actually improves early play instead of only moving spreadsheet numbers around. The session combined deterministic scenario comparisons from `packages/game-logic/src/balance/scenario-validation.ts` with one hands-on CLI run using the rebalanced catalogs and contract pricing.

## Scenario Comparison Highlights

### 1. Starter garage mixed fleet is healthier
Scenario: `garage` in `sa_east` with `C1 + M1 + S1` and a representative mixed workload.

- **Capex**: $445,000 → **$427,000**
- **Active monthly margin**: $3,682.93 → **$3,822.93**
- **Payback**: 120.828 months → **111.694 months**
- **Cash after one idle month**: $2,039,343.91 → **$2,054,983.91**

Takeaway: the mixed starter path is still tight, but it is no longer moving in the wrong direction. Lower sticker cost plus better compute/RAM pricing gives the first serious garage build a little more room to breathe.

### 2. Storage-heavy warehouse builds are less upfront-lethal, but no longer the obvious ROI exploit
Scenario: `warehouse` in `sa_east` with eight `S1` racks and a storage-heavy contract mix.

- **Capex**: $2,040,000 → **$1,896,000**
- **Cash after one idle month**: $392,090.43 → **$517,210.43**
- **Active monthly margin**: $41,921.73 → **$21,641.73**
- **Payback**: 48.662 months → **87.609 months**

Takeaway: the warehouse path is still dangerous early, but the rebalance fixes the worst feel issue: storage is cheaper to buy than memory at the same tier without becoming the dominant best-return lane.

### 3. Compute + memory contract lanes benefit the most
Scenario: `garage` in `us_west` with `C1 + C1 + M1 + M1` serving OLTP / edge style demand.

- **Active monthly margin**: $6,119.78 → **$10,519.78**
- **Payback**: 78.434 months → **45.628 months**

Takeaway: this is the clearest proof that the contract pricing changes landed in the intended place. vCPU/RAM-heavy fleets got the biggest lift, which reduces the old “storage is the only lane with decent unit economics” problem.

## Focused CLI Playtest

Environment:
- Difficulty: `hard`
- Seed: `4040`
- Region: `sa_east`
- Build: one `garage` with `C1`, `M1`, `S1`
- Tooling: `dct` one-shot commands with `--json`

### Steps
1. Created a new paused game.
2. Built `rebalance-garage` in `sa_east`.
3. Installed `C1`, `M1`, and `S1`.
4. Listed contracts and selected the only fitting market offer:
   - **Vertex Industries Vector Regional Delivery Grid**
   - Requirements: `144 vCPU / 960 GB RAM / 520 TB`
   - Payment: **$31,500/mo**
   - Penalty: `$20,600/mo`
   - Urgency: `rush`
5. Accepted the contract and advanced one month.

### Observed outcome
- **Cash before accepting / ticking**: $2,055,000
- **Cash after one tick**: **$2,064,561.12**
- **Net monthly cash delta**: **+$9,561.12**
- Contract stayed **active** after the tick and remained assigned to the garage.
- The garage still had explicit headroom discipline:
  - Available capacity before assignment: `200 vCPU / 2816 GB RAM / 536 TB`
  - Only one fitting contract appeared from the opening market, so early-game growth still requires deliberate choices rather than auto-pilot acceptance.

## Conclusions

### What improved
- Mixed starter fleets now feel more believable and slightly less cash-starved.
- Compute + memory builds finally get the biggest economics lift, which was the design goal of the pricing pass.
- Storage is cheaper than memory on sticker price at the same tier, fixing the original “this feels backwards” problem.

### What still appears true
- The **warehouse trap** still exists as a strategic warning sign, especially if the player overbuilds too early.
- Storage-heavy warehouse strategies are no longer the fastest-payback answer.
- Garages remain the preferred controlled-growth path in the early game.

## Recommendation
The rebalance is good enough to ship. The next balance watchpoint should be whether early warehouses still punish too sharply once players learn the new pricing, but that should be a separate pass from the storage-vs-memory unit-economics fix.
