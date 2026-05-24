# Playtest Results - May 24, 2026 (Easy Mode 200-Tick Cashflow Sweep)

## Goal
Run a longer **easy-mode** CLI playtest to see whether it is possible to keep **revenue** and **cash** growing across a full **200-tick** session after the rack-capex / contract-pricing rebalance.

## Method
I ran a series of automated one-shot `dct` playthroughs using isolated save/socket pairs and manual `tick 1` advancement. The broad strategies tested were:

1. **Overbuilt balanced openings**
   - 2-5 garages prefilled with balanced compute/memory/storage racks.
   - Regions tested included `us_west`, `eu_west`, and mixed region starts.
2. **Single full garage openings**
   - One fully populated garage in `us_west` or `sa_east`.
3. **Lean adaptive opening**
   - Start with **one `sa_east` garage** and only three racks: `C1 + M1 + S1`.
   - Add more racks only when a visible contract justified the expansion.
   - Increase maintenance staffing gradually as rack age climbed.
4. **Seed sweep**
   - Re-ran the best-performing heuristic across multiple seeds:
     - `4242`, `111`, `222`, `333`, `444`, `555`, `666`, `777`, `888`, `999`

## Big Learnings

### 1. Overbuilding is still the fastest route to bankruptcy, even on easy
The multi-garage starts were the worst performers by far.

- 2-5 fully built garages created too much fixed opex.
- The playthroughs often looked fine for the first 30-70 ticks, then crashed once contract occupancy dipped.
- Several of those runs ended between roughly **-4M and -18M cash** by tick 200.

**Takeaway:** the rebalance improved unit economics, but it did **not** make “build a lot of balanced capacity up front” safe.

### 2. `sa_east` was the most resilient region for a generic non-GPU opener
The best results came from a single adaptive **São Paulo** garage.

Why it worked best:
- very low baseline wages versus US/EU regions,
- acceptable early contract pool for generic compute / memory / storage work,
- easier to stay cash-positive when there were idle periods.

### 3. The best easy-mode pattern was **lean start -> targeted expansion**
The strongest strategy was:
- build **one garage** in `sa_east`,
- start with **`C1 + M1 + S1`**,
- only add racks when a visible contract needed them,
- avoid region-specific second garages unless the offer was immediately compelling.

This consistently outperformed every “balanced fleet first” strategy.

### 4. Maintenance helps, but it does not solve late-game idleness
Increasing maintenance staffing over time reduced the worst failure spirals, but the bigger long-run issue was **market fit + idle fixed opex**, not just breakdowns.

The stronger maintenance schedule I used for the better runs was roughly:
- start at **1** extra maintenance staff,
- move to **2** once rack age got high,
- move to **4** in very old-rack late game.

That kept runs more stable, but it did not fully eliminate the late-game cash bleed once contracts stopped fitting often enough.

### 5. Late-game market composition is the next pressure point
By late game, the market tilted more toward:
- **region-limited** offers,
- **GPU-heavy** offers,
- and larger contracts that punished generic idle infrastructure if you had built too broadly.

This is why the single-garage adaptive run held up better than multi-garage openings: it minimized idle exposure.

## Seed Sweep Results (best heuristic only)
Heuristic: **single adaptive `sa_east` garage**, starting `C1 + M1 + S1`, expanding only on concrete contract fit.

| Seed | Final cash @ tick 200 | Final revenue @ tick 200 | Peak cash | Peak tick | Notes |
|---|---:|---:|---:|---:|---|
| 444 | **3,064,118.97** | 0 | 4,705,949.82 | 39 | Best final result in sweep |
| 888 | 2,534,580.57 | 32,600 | 4,567,115.73 | 1 | Ended active and solvent |
| 999 | 1,750,986.42 | 33,600 | 4,580,793.89 | 1 | Positive but weaker late-game fit |
| 4242 | 1,183,086.29 | 38,600 | 4,720,242.30 | 52 | Original exploratory seed |
| 333 | 943,487.74 | 0 | 4,612,937.75 | 25 | Positive but decayed late |
| 111 | 590,995.33 | 0 | 4,550,470.08 | 9 | Barely safe by tick 200 |
| 777 | 525,517.31 | 0 | 4,537,768.95 | 1 | Thin finish |
| 555 | 446,835.39 | 0 | 4,602,832.72 | 22 | Thin finish |
| 666 | 362,638.56 | 0 | 4,531,455.35 | 1 | Thin finish |
| 222 | **-156,680.58** | 0 | 4,539,496.91 | 1 | Worst seed in sweep |

## Best Representative Run: Seed 444
This was the strongest 200-tick result.

### Strategy
- Difficulty: `easy`
- Seed: `444`
- Region: `sa_east`
- Datacenters: **1 garage only**
- Opening racks: `C1`, `M1`, `S1`
- Final rack count: **8** (fully expanded over time, but only as contracts justified it)

### Checkpoints
| Tick | Cash | Active contracts | Monthly revenue | Rack count |
|---|---:|---:|---:|---:|
| 1 | 4,574,059.78 | 1 | 23,200 | 3 |
| 21 | 4,603,273.42 | 1 | 32,900 | 4 |
| 41 | 4,661,688.46 | 0 | 0 | 5 |
| 61 | 4,412,725.16 | 1 | 35,900 | 8 |
| 81 | 4,353,135.96 | 1 | 44,800 | 8 |
| 101 | 4,273,646.76 | 1 | 37,800 | 8 |
| 121 | 3,996,583.25 | 1 | 40,200 | 8 |
| 141 | 3,819,967.58 | 1 | 34,500 | 8 |
| 161 | 3,622,914.78 | 1 | 47,600 | 8 |
| 181 | 3,443,434.88 | 0 | 0 | 8 |
| 200 | **3,079,493.93** | 0 | 0 | 8 |

### Interpretation
This run never exceeded the **easy-mode starting cash** of 5,000,000, but it was the cleanest proof that the rebalance can support a **long, solvent 200-tick session** if the player stays disciplined about capex.

It also shows the current limit clearly:
- the economy supports **short-to-mid-term growth**,
- but late-game generic non-GPU garages still suffer long idle stretches,
- so cash eventually trends down unless the market keeps feeding matching work.

## Practical Conclusions

### What seems healthy now
- Storage is no longer the obvious always-buy lane.
- A small mixed garage can still climb early and stay solvent for a long session.
- Easy mode gives enough runway to recover from a slow contract patch if the player did **not** overbuild.

### What still looks fragile
- Long-horizon idle opex is still punishing.
- Region-limited late contracts strand generic capacity.
- Multi-garage balanced openings remain traps.

## Recommendation
If we want easy mode to support a more obvious “grow cash continuously for 200 ticks” story, the next balance pass should probably look at one of these:

1. **Lower late idle carrying cost** for non-active mixed fleets, or
2. **Improve late market continuity** for generic non-GPU garages, or
3. **Add a partial downsizing / decommission safety valve** so overbuilt capacity is not a permanent sentence.

For now, the strongest player guidance is:

> **Open lean in `sa_east`, expand only against visible contracts, and avoid prebuilding multiple balanced garages.**
