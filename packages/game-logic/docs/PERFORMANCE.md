# Game Logic Performance Baseline

This note records the initial benchmark baselines for plan [037-core-game-logic-performance-optimisation](../../.agents/plans/037-core-game-logic-performance-optimisation.md).

Run the same suite with:

```bash
npm run bench:perf -w @datacenter-tycoon/game-logic
npm run bench:perf -w @datacenter-tycoon/game-logic -- --json
```

The benchmark harness uses deterministic seeded fixtures from `src/perf/fixtures.ts` and measures:

- `tick()`
- `summarizeNetworkCapacityFromState()`
- `summarizeDistinctCapacityPoolsFromState()`
- `summarizeOpenMarketContractFits()`
- common reducer actions (`BuildDatacenter`, `PlaceRack`, `RemoveRack`, `MoveRack`, `AcceptContract`, `CancelContract`, `SetMaintenanceStaff`, `FabricLink`)

## Baseline fixture sizes

| Profile | Regions | Datacenters | Racks | Contracts |
| --- | ---: | ---: | ---: | ---: |
| `small` | 2 | 6 | 36 | 24 |
| `medium` | 4 | 20 | 360 | 120 |
| `stress` | 8 | 64 | 2,048 | 496 |

## Baseline measurements

Recorded on 2026-05-18 using:

- `npm run bench:perf -w @datacenter-tycoon/game-logic -- --json`
- local feature branch `arnav/perf-core`
- Node with `--expose-gc` enabled by the benchmark script

These numbers are most useful when compared on the **same machine**. Absolute timings will vary by CPU and Node version.

### Small profile baseline

| Scenario | Avg ms | Ops/s | Retained heap KB/iter |
| --- | ---: | ---: | ---: |
| `tick` | 1.062 | 941.7 | 5.87 |
| `networkCapacity` | 0.010 | 101,925.3 | 4.30 |
| `fabricPools` | 0.022 | 46,399.7 | 4.88 |
| `contractFits` | 0.444 | 2,251.7 | 0.29 |
| `reduceBuildDatacenter` | 0.009 | 114,376.3 | -0.35 |
| `reducePlaceRack` | 0.004 | 278,468.4 | 0.12 |
| `reduceRemoveRack` | 0.001 | 1,442,885.8 | -0.03 |
| `reduceMoveRack` | 0.004 | 267,260.1 | 0.00 |
| `reduceAcceptContract` | 0.024 | 41,985.3 | 0.79 |
| `reduceCancelContract` | 0.008 | 119,241.9 | 0.72 |
| `reduceSetMaintenanceStaff` | 0.001 | 726,390.5 | -0.09 |
| `reduceFabricLink` | 0.005 | 195,387.6 | 0.00 |

### Medium profile baseline

| Scenario | Avg ms | Ops/s | Retained heap KB/iter |
| --- | ---: | ---: | ---: |
| `tick` | 6.361 | 157.2 | 4.48 |
| `networkCapacity` | 0.034 | 29,791.5 | -0.41 |
| `fabricPools` | 0.194 | 5,145.7 | 0.00 |
| `contractFits` | 16.568 | 60.4 | 0.02 |
| `reduceBuildDatacenter` | 0.003 | 398,010.0 | 0.00 |
| `reducePlaceRack` | 0.010 | 104,489.1 | 0.04 |
| `reduceRemoveRack` | 0.001 | 712,595.8 | -0.30 |
| `reduceMoveRack` | 0.004 | 224,019.4 | 0.22 |
| `reduceAcceptContract` | 0.047 | 21,178.0 | 0.15 |
| `reduceCancelContract` | 0.022 | 44,918.6 | -0.01 |
| `reduceSetMaintenanceStaff` | 0.001 | 1,119,758.1 | -0.08 |
| `reduceFabricLink` | 0.002 | 489,296.6 | 0.00 |

### Stress profile baseline

| Scenario | Avg ms | Ops/s | Retained heap KB/iter |
| --- | ---: | ---: | ---: |
| `tick` | 52.217 | 19.2 | 33.92 |
| `networkCapacity` | 0.192 | 5,200.7 | -16.44 |
| `fabricPools` | 2.023 | 494.2 | -0.70 |
| `contractFits` | 621.014 | 1.6 | 0.36 |
| `reduceBuildDatacenter` | 0.005 | 200,332.6 | 0.00 |
| `reducePlaceRack` | 0.028 | 35,152.0 | -0.12 |
| `reduceRemoveRack` | 0.003 | 375,000.0 | -0.36 |
| `reduceMoveRack` | 0.008 | 120,819.8 | 0.17 |
| `reduceAcceptContract` | 0.158 | 6,326.8 | 0.00 |
| `reduceCancelContract` | 0.084 | 11,841.9 | -1.46 |
| `reduceSetMaintenanceStaff` | 0.002 | 546,278.9 | -0.35 |
| `reduceFabricLink` | 0.002 | 451,977.4 | -0.06 |

## Optimization priorities

The current hottest measured paths are:

1. `contractFits` on `stress` (`621.014 ms` avg)
2. `tick` on `stress` (`52.217 ms` avg)
3. `contractFits` on `medium` (`16.568 ms` avg)
4. `fabricPools` on `stress` (`2.023 ms` avg)

Those are the primary targets for phases 2–4 of the plan.

## Budget targets for this optimisation plan

These are the target averages for the end of plan 037 when run on the same machine class that produced the baseline above.

| Scenario | Baseline avg ms | Target avg ms | Improvement target |
| --- | ---: | ---: | ---: |
| `stress.tick` | 52.217 | <= 40.000 | at least 23% faster |
| `stress.fabricPools` | 2.023 | <= 1.300 | at least 35% faster |
| `stress.contractFits` | 621.014 | <= 350.000 | at least 44% faster |
| `medium.tick` | 6.361 | <= 5.000 | at least 21% faster |
| `medium.contractFits` | 16.568 | <= 10.000 | at least 40% faster |
| `medium.fabricPools` | 0.194 | <= 0.140 | at least 28% faster |

Reducer action benchmarks are expected to stay neutral or improve. A small regression is acceptable only when it unlocks a large improvement in `tick`, `fabricPools`, or `contractFits` and does not change gameplay behavior.

## Regression thresholds

Use these guardrails when evaluating future changes:

- Treat **small-profile** timings as smoke tests only; they are too short to be hard gates.
- For **medium-profile** hot paths (`tick`, `fabricPools`, `contractFits`), investigate any regression greater than **15%** versus the last accepted baseline on the same machine.
- For **stress-profile** hot paths, investigate any regression greater than **20%**.
- For reducer actions, investigate regressions greater than **25%** if they are repeatable across two runs.
- Treat retained heap deltas as directional signals, not exact budgets. Sustained positive growth on `tick`, `fabricPools`, or `contractFits` should be called out in review notes.

## Comparison workflow

1. Run `npm run bench:perf -w @datacenter-tycoon/game-logic -- --json > /tmp/game-logic-perf.json`.
2. Compare the `averageMs` values for the `medium` and `stress` profiles against the tables above.
3. If a hot path regresses past the thresholds above, either:
   - fix the regression, or
   - document why the tradeoff is intentional and update this note after review.
4. When a meaningful optimisation lands, refresh this document with the new accepted baseline and keep the previous results in the plan/PR discussion.

## Save-state footprint audit

As of save version `12`, serialized saves persist only canonical `contracts` and omit the derived compatibility views `contractMarket` and `activeContracts`.

### Why

- Those arrays duplicate information already derivable from `contracts`.
- They noticeably increase save payload size for large markets and long contract histories.
- They also increase load-time normalization work when older saves carry divergent legacy views.

### Migration notes

- `deserialize()` still returns a full runtime `GameState` with `contractMarket` and `activeContracts` rehydrated via `withDerivedContractViews()`.
- `migrate()` upgrades version `11` saves by canonicalizing any legacy overrides from `contractMarket` / `activeContracts` into `contracts` before rehydrating derived views.
- Save/load tests cover compact current-version saves, legacy v11 overrides, and deterministic mid-month resumes.

### Compatibility risk

- External tooling that directly inspects raw save JSON must not assume `contractMarket` or `activeContracts` are present in newly written saves.
- Runtime code inside `game-logic`, `web`, `cli`, or `server` should continue to treat those arrays as derived compatibility views and prefer lifecycle selectors over direct persisted-state coupling.

## Notes

- The benchmark harness is intentionally deterministic and uses no `Math.random()`.
- `contractsFromState()` compatibility normalization is known to be expensive when repeatedly invoked inside nested loops; future changes should compute it once per operation and pass derived buckets downward.
- Fabric and capacity queries should prefer batched helpers over per-datacenter recomputation inside market-wide scans.
