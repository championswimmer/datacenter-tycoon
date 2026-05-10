# Playtest Results - May 10, 2026 (Round 2)

## Overview
This second round of playtesting focused on testing scaling strategies (Garage Grid vs. Warehouse) and optimizing early-game profitability.

## Findings

### 1. Scaling Strategy: Garage Grid vs. Warehouse
- **The "Warehouse Trap"**: Building a Warehouse ($1.4M) early in the game (before tick 30) is almost always a losing move. The jump from 2 to 8 staff members ($12k to $48k in base wages) plus higher cooling/power overhead requires at least $120k/mo in revenue just to break even.
- **Garage Grid**: Building multiple Garages is more cost-effective for T1 and some T2 contracts. Each Garage adds only 2 staff members, allowing for a more granular increase in opex.
- **Cooling Bottleneck**: The primary limitation of the Garage is the 120,000 BTU/hr cooling capacity. This effectively limits a Garage to ~2 GPU racks (G1) if other racks are present. T3 racks (which require liquid cooling) are impossible in a Garage.

### 2. Operational Costs
- **Move Cost**: Moving a rack between datacenters costs only $5,000. This is significantly cheaper than decomming and rebuying ($50k-$800k). Consolidation is a viable strategy when revenue drops.
- **Staff Wages**: Regional staff wages (e.g., $6,079 in `us_west`) are the most significant part of the early-game opex.

### 3. Reliability & Maintenance
- **Failure Scaling**: Around tick 60, failure risks for initial racks climb to 10-15%. Without maintenance staff, a single failure can lead to a string of breached contracts and rapid bankruptcy.
- **Staffing**: 1 maintenance engineer per Garage is sufficient for the first 80 ticks.

### 4. Market & Contracts
- **Tier 2/3 Contracts**: These contracts offer significantly higher revenue ($50k-$100k) but require hardware density that quickly hits the Garage's heat limit.
- **Churn**: Short-term "Rush" contracts (1-2 months) are excellent for quick cash but require high player attentiveness. Failing to replace them immediately leads to idle capacity costing money.

## Conclusion
To succeed in Datacenter Tycoon, the player must:
1. Stay in a single Garage until they have $2M+ cash and $80k+ revenue.
2. Use the `racks move` command to optimize placement as hardware ages or contracts change.
3. Prioritize cooling management over power management in the early game.
4. Scale to a Warehouse only when Tier 3 liquid-cooled hardware is required for high-margin contracts.

Despite several failed runs in this session due to aggressive scaling and operational errors, the core loop is robust and punishes inefficiency.
