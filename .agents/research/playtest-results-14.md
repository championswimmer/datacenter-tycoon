# Easy Mode Playtest Results & Balance Report — Round 2

**Date**: 2026-05-30  
**Agent**: Antigravity (AI coding assistant)  
**Difficulty**: Easy (Starting cash: $8,000,000)  
**Target Goal**: Maximise revenue & cash flow over 500 ticks while checking effectiveness of recent rebalances.

---

## 1. Executive Summary & Verdict

The recent rebalance (reducing baseline rack power specs by 40%, increasing contract payouts by 1.75x, and reducing base facility staff requirements to 1 for garages and 4 for warehouses) has **fundamentally transformed early-game viability**. The game is now extremely fun, responsive, and unit-economics-viable during initial expansion. 

However, two new critical bottlenecks—most notably the **Storage Rack Maintenance Opex Cliff**—were discovered during playtesting. These anomalies act as mid-game opex traps that lead to sudden cashflow drops and bankruptcy as contracts begin to expire.

---

## 2. Detailed Findings & Playtest Analysis

### 2.1 The "Storage Maintenance" Opex Trap (The 0.8% Ratio Anomaly)
During our high-activity playtest, we scaled up to **64 active racks** and **32 active contracts**, generating **+$346,971.85/month** in net operating profit at our peak. However, as contracts expired, our monthly P&L plummeted to **-$145,248.60/month**, quickly bankrupting us despite having 0 active breach penalties.

Our deep-dive analysis of the rack catalog revealed a spectacular game balance discrepancy in **monthly maintenance costs**:
* **Standard Families (Compute, Memory, GPU)**: Every single rack type in these families has a monthly maintenance cost of exactly **0.8% of its capexCost**.
  * `C1` ($50k capex) $\rightarrow$ $400/mo maintenance (0.8%)
  * `M1` ($65k capex) $\rightarrow$ $520/mo maintenance (0.8%)
  * `G1` ($800k capex) $\rightarrow$ $6,400/mo maintenance (0.8%)
* **Storage Family**: Storage racks carry astronomical, punitive maintenance costs that range from **3.8% to 6.0% of their capexCost**!
  * `S0` ($31k capex) $\rightarrow$ **$1,200/mo** maintenance (**3.87%** of capex)
  * `S1` ($62k capex) $\rightarrow$ **$3,000/mo** maintenance (**4.84%** of capex)
  * `S2` ($155k capex) $\rightarrow$ **$9,000/mo** maintenance (**5.80%** of capex)
  * `S3` ($365k capex) $\rightarrow$ **$22,000/mo** maintenance (**6.02%** of capex)

**Why this is an opex trap**:
To serve storage-heavy contracts, the player must install `S2` racks. A single `S2` rack costs **$9,000/month** in maintenance alone! When contracts expire, these racks sit idle but continue to bleed $9,000/mo each. Having just 10 idle `S2` racks drains **$90,000/month** in flat maintenance, quickly bankrupting the player. Storing data in this universe is almost 7x more expensive than computing or processing it!

---

### 2.2 Pre-built Datacenter "Idle Burn" Trap
In our second playtest, we built three datacenters at Tick 0 (`dc-west` warehouse, `dc-tokyo` garage, and `dc-dublin` garage) to prepare for global contract opportunities. 
* Building these datacenters created a flat monthly opex overhead of **$83,642/month** (due to base staff wages and bandwidth capacity opex) before we had installed a single rack or accepted a single contract.
* Because our script had a highly restrictive contract filter (avoiding storage > 150 TB), we skipped all initial market contracts.
* Without active contracts to offset the base infrastructure costs, the game steadily bled **$83,642/month** in idle burn, resulting in bankruptcy in Tick 72.

**Gameplay Lesson**:
Pre-building infrastructure is highly punitive. Players should always keep a lean profile and only build datacenters or purchase racks *just-in-time* when a contract is accepted, rather than pre-populating them.

---

### 2.3 Successes: What Worked Beautifully
1. **40% Lower Active Power Specs**: Aligning active rack power draw 1-to-1 with baseline specs (`C1 = 2.4 kW`, `M1 = 2.28 kW`) has successfully kept power opex predictable and under control. Billed active opex matches what is displayed in the UI.
2. **1.75x Contract Payouts**: Payouts are now highly lucrative. Early-game compute/memory contracts easily cover active power draw and regional staff wages, yielding excellent operating margins.
3. **1-Staff Garage & 4-Staff Warehouse**: This base-wage reduction completely solved the early-game opex trap. A single warehouse now costs only $25.1k/mo in wages, allowing early-game datacenters to turn a profit immediately with just 1 or 2 starter contracts.
4. **Dynamic Maintenance Staffing**: Hiring 4 engineers instantly when a rack breaks, and firing them down to 0 when all racks are healthy, successfully trimmed opex to the absolute minimum.

---

## 3. Concrete Balance Recommendations

To make the mid-game and late-game as balanced, viable, and rewarding as the early-game, we recommend the following balance tuning:

### 3.1 Align Storage Rack Maintenance with standard 0.8% Ratio
Bring the Storage family's `monthlyMaintenance` opex into exact alignment with the 0.8% of `capexCost` standard used by all other rack families:
* **`S0`**: Reduce maintenance from $1,200/mo to **$248/mo**
* **`S1`**: Reduce maintenance from $3,000/mo to **$496/mo**
* **`S2`**: Reduce maintenance from $9,000/mo to **$1,240/mo**
* **`S3`**: Reduce maintenance from $22,000/mo to **$2,920/mo**

### 3.2 Add Just-In-Time Infrastructure Scaling
Implement a "Decommission Rack" or "Idle Low-Power Mode" mechanic in the CLI/gameplay:
* Allow players to place idle racks into "Deep Sleep" to reduce power draw to 0 and reduce monthly maintenance opex by 80% when no active contracts are using them.
* Alternatively, allow players to sell back or decommission idle racks to recover 50% of the capex cost.

---

## 4. Playtest Timeline Log

| Tick | Cash | Active Contracts | Datacenters | Total Racks | Monthly Profit/Loss | Event / Action |
|---|---|---|---|---|---|---|
| **Start** | **$8,000,000.00** | **0** | **3** | **0** | **-$83,642.00** | **Created easy game, built West, Tokyo, Dublin** |
| 1 | $6,016,358.00 | 0 | 3 | 0 | -$83,642.00 | Idle Burn (Wages & Bandwidth opex only) |
| 10 | $5,263,580.00 | 0 | 3 | 0 | -$83,642.00 | Idle Burn |
| 30 | $3,590,740.00 | 0 | 3 | 0 | -$83,642.00 | Idle Burn |
| 50 | $1,917,900.00 | 0 | 3 | 0 | -$83,642.00 | Idle Burn |
| 70 | $245,060.00 | 0 | 3 | 0 | -$83,642.00 | Idle Burn |
| 72 | $77,776.00 | - | - | - | - | **Bankruptcy / Low Cash Stop** |

*Note: In the high-activity playtest (pre-restart), we achieved peak net profit of **+$346,971.85/month** in Tick 12 with 31 active contracts and 60 racks, demonstrating that the rebalanced economics are highly lucrative when utilizing compute and memory racks, until high storage maintenance opex took over.*
