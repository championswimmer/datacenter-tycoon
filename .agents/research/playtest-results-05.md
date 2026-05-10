# Playtest Results - May 10, 2026

## Overview
I played several rounds of Datacenter Tycoon in "easy" mode via the CLI (`dct`).
My goal was to maximize revenue and end at tick 120 with more than the initial $5M cash.

## Findings

### 1. Economy & Opex
- **Baseline Costs**: Opex is remarkably high. A Garage datacenter with a full rack mix costs ~$50k/month. A Warehouse costs ~$120k/month.
- **Idle Penalty**: Sitting idle without active contracts is the fastest way to lose. You must constantly hunt for new contracts to stay profitable.
- **Easy Mode?**: Even on "easy", the starting $5M can be burned through in less than 40-50 ticks if the player overbuilds or fails to maintain contract coverage.

### 2. Infrastructure & Scaling
- **Garage vs Warehouse**: The jump to a Warehouse is dangerous. The jump from 2 to 8 staff members significantly increases the monthly "burn rate".
- **Cooling Constraints**: The Garage's limited cooling (120k BTU) prevents it from being used for high-tier dense builds (Tier 2/3 racks). Players are forced to scale to a Warehouse to use advanced hardware.
- **GPU Bottleneck**: Many mid-game contracts require GPU Flops. Since GPU racks (G1/G2) are expensive and have high power/cooling needs, they represent a significant "gate" in progression.

### 3. Reliability & Aging
- **Rack Failure**: At tick 60, initial racks have a ~32% failure risk per month.
- **Breaches**: A single rack failure in a tight build (where capacity is 100% committed) leads to immediate contract breaches and heavy penalties.
- **Maintenance Staff**: Hiring maintenance engineers is essential after tick 40. Without them, repairs take 1-2 months, during which penalties can exceed $100k.

### 4. CLI Experience
- **Json Output**: The `--json` flag is excellent for automated play and state inspection.
- **Feedback Loop**: `dct status` and `dct ls contracts` are the most used commands.
- **Safety**: The new "insufficient capacity" check on contract acceptance is a lifesaver, preventing accidental overcommitment.

## Conclusion
The game is a tight economic simulation. Successful play requires:
1. Only buying racks that match an available contract.
2. Avoiding over-scaling to a Warehouse too early.
3. Managing rack age and maintenance staffing proactively.
4. Keeping a $1M+ cash buffer for opex and repairs.

I ended my successful run (after several restarts) by focusing on high-margin T2 contracts in a Warehouse only once I had $200k+ in monthly revenue coverage.
