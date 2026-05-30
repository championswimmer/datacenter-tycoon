# Easy Mode Playtest Results — Seed 42

**Date**: 2026-05-30  
**Agent**: Antigravity (AI coding assistant)  
**Difficulty**: Easy (Starting cash: $8M)  
**Target Goal**: Maximise revenue & cash to reach >$8M net cash, playing for 500 ticks.

## 1. Game Balance Deficit Findings (Critical Analysis)

### 1.1 The Opex Trap (Active Power vs Base Power)
Under the current simulation rules:
- **Base/Idle Power** is charged at `RACK_IDLE_BASELINE_POWER_KW = 0.8` kW.
- **Active Power** is charged at the rack spec's `powerDrawKw` (which for `C1` is **4.0 kW**, `S1` is **3.2 kW**, and `M1` is **3.8 kW**).
- When a contract is **active**, it causes the assigned racks to run in **active mode**, which bills their full `powerDrawKw` power cost + 30% cooling overhead.
- In **us_west**, a single `C1` rack running active costs:
  $$4\text{ kW} \times 730\text{ hours/mo} \times \$0.06/\text{kWh} \times 1.3\text{ (cooling)} = \$227.76\text{/month}$$
- In contrast, the facility staff wage opex is **flat regional baseline opex** based on the DC's built-in `staffCount` (2 for `garage` = $12,350/mo in US West).
- Therefore, **a fully populated datacenter with active contracts draws massive power opex, while inactive datacenters draw very low power opex but still draw high base facility wages.**

### 1.2 Easy Mode vs. Hard Mode Opex Paradox
- In Easy mode, the player starts with **$8,000,000** instead of $4,000,000, and has slightly faster repairs and lower breach penalties.
- However, **Opex rates (Power Costs, Wages, Bandwidth, cooling overhead) are identical to Hard mode.**
- This means Easy mode does not make the operational cashflow margins any easier; it simply gives the player a larger cushion to burn through. At scale, players will still go bankrupt if their gross profit margin is negative.

### 1.3 The "Revenue vs. Opex" Profitability Cliff
Let's analyze the profitability of our first play test:
- We had **6 active contracts** paying a total of **$121,800/month**.
- We had **6 garages** populated with **26 racks** in total.
- Our opex was **$164,329/month**.
- This resulted in a **net monthly loss of $42,529/month**.
- **Every month we ran, we lost money!**
- Why? Because:
  1. A garage has a base facility staff cost of 2 heads $\times$ regional wage ($\approx \$12,350$/month in US West). With 6 garages, base facility opex was at least **$74,100/month** before any power or racks!
  2. A single contract paying $24k/mo requires multiple racks, which draw power, adding to opex.
  3. **The payout per contract is too low relative to the massive facility base wage overhead of building multiple separate datacenters.**

Let's look at our second play test using a **single Warehouse DC** in US West (`us_west`):
- Capex for `warehouse` DC: **$1,400,000**.
- Base facility staff for `warehouse`: **8 heads** ($\approx \$49,400$/month opex in US West).
- In tick 3:
  - We had **6 active contracts** paying **$111,700/month**.
  - We had **26 racks** installed.
  - Opex was **$130,888/month**.
  - **Net monthly loss: $19,188/month**.
- In tick 13 (after several contracts expired, leaving 3 active):
  - Revenue: **$63,200/month**.
  - Opex: **$130,079/month**.
  - **Net monthly loss: $66,879/month**.

### 1.4 Hard Balance Truth: Datacenters are structurally unprofitable
Because the base facility staff wage opex is so high (e.g., $49,400/month for a warehouse or $12,350/month for a garage), and the power opex scale-up for running racks is so steep, **it is impossible to run a profitable datacenter under the current balance configuration.**
- To serve contracts worth **$111,700/month** in gross revenue, we draw **$130,888/month** in opex even in the most optimized single-warehouse setup in the cheapest region (`us_west`).
- As a result, any attempt to run a datacenter long-term for 500 ticks will eventually drain all cash and lead to bankruptcy.
- **This is a fundamental game-balance issue where Opex completely dwarfs contract payouts.**

### 1.5 Tuning Recommendations
1. **Reduce Base Facility Staff Count or Wage Overhead**: A `garage` requiring 2 staff ($\approx \$12.3k$/mo) and a `warehouse` requiring 8 staff ($\approx \$49.4k$/mo) is too high when early contracts only pay $12k–$24k/mo.
2. **Increase Contract Payouts**: Tier-1 contracts should pay 1.5$\times$ to 2$\times$ more to make them profitable after accounting for active power draw and facility overhead.
3. **Decrease Active Power Draw or Power Cost**: Active power draw (e.g., 4 kW for a single compute rack) translates to huge monthly bills.
