# `@datacenter-tycoon/game-logic`

Deterministic, framework-agnostic game logic for Datacenter Tycoon.

## Install

```bash
npm install @datacenter-tycoon/game-logic
```

## Quickstart

```ts
import {
  DATACENTER_CATALOG,
  RACK_CATALOG,
  REGION_CATALOG,
  newGame,
  reduce,
  serialize,
  type Action,
  type DatacenterId,
  type GameState,
  type RackPlacementId,
  type RegionId,
} from "@datacenter-tycoon/game-logic";

const datacenterId = (value: string): DatacenterId => value as DatacenterId;
const rackPlacementId = (value: string): RackPlacementId => value as RackPlacementId;
const regionId = (value: string): RegionId => value as RegionId;

let state: GameState = newGame(42, {
  playerName: "Alex",
});

// Pick a region — each has unique power costs, wages, and taxes
const usEast = regionId("us_east");

const actions: Action[] = [
  {
    type: "BuildDatacenter",
    specId: DATACENTER_CATALOG.garage.id,
    dcId: datacenterId("dc-1"),
    regionId: usEast,
  },
  {
    type: "PlaceRack",
    dcId: datacenterId("dc-1"),
    specId: RACK_CATALOG.C0.id,
    row: 0,
    position: 0,
    placementId: rackPlacementId("rack-1"),
  },
  { type: "Tick" },
];

for (const action of actions) {
  state = reduce(state, action);
}

const saveJson = serialize(state);
console.log(saveJson);
```

## Public API

Main exports from `src/index.ts`:

- `newGame(seed, options?)`
- `reduce(state, action)`
- `tick(state)`
- `serialize(state)` / `deserialize(json)`
- `RACK_CATALOG`
- `DATACENTER_CATALOG`
- `REGION_CATALOG`
- `generateMap(seed)` — deterministic world map generator
- maintenance balance constants such as `RACK_FAILURE_YEAR_ONE_CHANCE`, `RACK_FAILURE_MAX_CHANCE`, `BASE_REPAIR_DAYS`, and `DAYS_PER_TICK`
- starter rack catalog entries `C0`, `M0`, `S0`, and `G0` for lower-capex early expansion
- reliability balance helpers such as `RELIABILITY_BASELINE_SCORE`, `RELIABILITY_MARKET_OFFER_COUNT`, `reliabilityBandForScore()`, and `reliabilityMarketPolicyForScore()`
- power billing helpers such as `RACK_IDLE_BASELINE_POWER_KW`, `idleBaselinePowerForRackCount()`, `monthlyKwhFromPowerKw()`, and `KWH_PER_KW_PER_MONTH`
- all public domain types from `types.ts`, including `RackActivityView` and `RackPowerSummary`

## Shared gameplay query surface

Consumer packages should prefer exported query helpers over reconstructing gameplay meaning from raw state. The canonical read-only surface now includes helpers such as:

- `bucketContractsFromState(state)`
- `selectOpenMarketContractsFromState(state)`
- `selectLiveContractsFromState(state)`
- `selectHistoricalContractsFromState(state)`
- `selectLiveContractsForDatacenter(state, dcId)`
- `summarizeContractAssignmentFit(state, contractId)`
- `summarizeOpenMarketContractFits(state)`
- `contractDealScore(contract)`
- `summarizeDatacenterCapacityFromState(state, dcId)`
- `summarizeDatacenterInfrastructureFromState(state, dcId)`
- `summarizeDatacenterUpgradeTracksFromState(state, dcId)`
- `summarizeDatacenterUpgradeViewFromState(state, dcId)`
- `summarizeNetworkCapacityFromState(state)`
- `selectDatacenterMaintenanceStaffingViewFromState(state, dcId)`
- `selectDatacenterRackActivityViewFromState(state, dcId)`
- `selectDatacenterRackPowerSummaryFromState(state, dcId)`
- `listRackMoveTargets(state, sourceDcId, placementId)`

Use these in `web`, `cli`, and any future consumers whenever the answer should be identical across interfaces — for example contract bucketing, capacity availability, contract-fit checks, maintenance affordances, and legal rack-move destinations.

## Rack health & maintenance scaffolding

Rack and datacenter state now exposes the persisted maintenance fields needed for aging/failure simulation:

```ts
type RackHealthStatus = "healthy" | "repairing";

interface RackPlacement {
  id: RackPlacementId;
  specId: RackSpecId;
  kind: RackKind;
  installedAtTick: Tick;
  health: RackHealthStatus;
  repairProgressDays?: number;
  lastFailureAtTick?: Tick;
  row: number;
  position: number;
}

interface Datacenter {
  id: DatacenterId;
  name: string;
  spec: DatacenterSpec;
  placements: RackPlacement[];
  builtAtTick: Tick;
  regionId: RegionId;
  maintenanceStaff: number;
  upgrades?: {
    currentNodeByTrack: {
      cooling: string;
      networkType: string;
      onsiteGeneration: string;
    };
  };
}
```

Repair timing constants are exported so consumers can display or reason about the monthly-tick / daily-repair bridge without duplicating numbers.

## Player reliability scaffolding

The player profile now includes a persisted reliability score that future contract-market systems can use without inventing UI-local state:

```ts
interface PlayerReliability {
  score: number;
  lastDelta?: number;
  recentOutcomes: ContractSlaOutcome[];
}

interface ContractSlaOutcome {
  contractId: ContractId;
  contractName: string;
  tick: Tick;
  kind: "fulfilled" | "breached" | "cancelled";
}
```

The current save policy is **destructive on incompatible format changes**. Version `9` adds optional contract region affinity and migrates version `8` saves losslessly because missing affinity metadata still means “deploy anywhere.” Version `7` saves still migrate forward by attaching empty regional fabric state; older save versions are intentionally rejected and should be recreated.

## Contract region affinity

Contracts can optionally persist a geography constraint alongside their normal capacity and term requirements:

```ts
type ContractRegionAffinityKey = "eu" | "asia" | "usa";

interface ContractRegionAffinity {
  key: ContractRegionAffinityKey;
  allowedRegionIds: RegionId[];
}

interface Contract {
  regionAffinity?: ContractRegionAffinity;
}
```

When `regionAffinity` is omitted, the contract is unrestricted and may be served from any region. When present, the affinity key provides stable UI copy and the explicit `allowedRegionIds` whitelist keeps historical/generated contracts deterministic even if catalog grouping rules evolve later.

## Contract lifecycle

Contracts use one player-facing lifecycle field:

```ts
type ContractLifecycleState =
  | "market_open"
  | "market_expired"
  | "serving"
  | "breached"
  | "cancelled"
  | "completed";
```

The lifecycle invariants are:

- only `market_open` contracts can be accepted
- only `serving` and `breached` contracts are live
- only historical/terminal contracts have `closedAtTick`
- `assignedDcId` and `acceptedAtTick` are set once an offer is accepted
- `breachStreakMonths` tracks consecutive breached months when breach cancellation is enabled

`Contract.status` remains as a deprecated compatibility bridge for existing game-logic, CLI, and web consumers. New code should read `lifecycleState`.

`GameState.contracts` is the canonical contract collection. `contractMarket` and `activeContracts` are deprecated derived compatibility views; new code should derive market, live, and history buckets from lifecycle selectors.

Only `serving` and `breached` contracts are **live**: they still commit capacity, pay revenue, and can levy penalties. `market_expired`, `cancelled`, and `completed` contracts are **historical**: their committed capacity has already been released and they no longer affect game-logic calculations.

Always use the exported helper to classify liveness — never open-code the status check:

```ts
import { selectLiveContracts } from "@datacenter-tycoon/game-logic";

// Count only live contracts
const liveCount = selectLiveContracts(state.contracts).length;

// Check if a specific contract still commits capacity
if (isLiveContractLifecycleState(contract.lifecycleState)) {
  // contract is serving or breached — capacity is reserved
}
```

`datacenterContractCapacitySummary()` already applies this filter internally, so capacity numbers are always correct regardless of historical contracts in the list.

Reliability is now a full simulation input, not just persisted profile metadata:

- New games start at **50** reliability (`RELIABILITY_BASELINE_SCORE`).
- Each fulfilled month contributes **+3** reliability.
- A breached month contributes **-8** reliability.
- An explicit player cancellation contributes **-12** reliability.
- Scores are clamped to **0–100** and recent SLA history keeps the last **6** outcomes.

The score maps to three bands:

- **At-risk**: `0–34`
- **Baseline**: `35–69`
- **Trusted**: `70–100`

Those bands shape the future contract market on the **same tick** that the SLA outcome is evaluated:

| Band | Offer count | Market feel |
| --- | ---: | --- |
| `at-risk` | 4 | fewer offers, shorter/riskier work is more common |
| `baseline` | 6 | default market mix |
| `trusted` | 8 | more offers and better access to long-term anchor work |

Use `reliabilityMarketPolicyForScore(score)` when a consumer needs the exact offer count and term-bias values, and `reliabilityBandForScore(score)` when only the user-facing band label matters.

Because `tick()` updates reliability **before** refreshing the market, a clean fulfillment month can immediately improve the next offer refresh, while a breach can reduce the next refresh without any UI-side bookkeeping.

## Datacenter upgrade extension rules

Datacenter upgrades now follow the same extension path everywhere in the repo:

- Tune **costs, upkeep, bandwidth deltas, cooling deltas, generator yields, and slot caps** in `src/balance/datacenter-upgrades.ts`.
- Treat `src/catalog/datacenter-upgrades.ts` as the canonical blueprint builder over that balance data.
- Treat `Datacenter.spec` as the immutable built blueprint. Live power/cooling/network answers must come from `resolveDatacenterInfrastructure()` and the exported query summaries such as `summarizeDatacenterInfrastructureFromState()` / `summarizeDatacenterUpgradeViewFromState()`.
- CLI and web consumers should never inspect `datacenter.upgrades` or hardcode upgrade rules directly; they should render the canonical query surface instead.

## Action reference

```ts
export type Action =
  | { type: "BuildDatacenter"; specId: DatacenterSpecId; dcId: DatacenterId; regionId: RegionId }
  | {
      type: "PlaceRack";
      dcId: DatacenterId;
      specId: RackSpecId;
      row: number;
      position: number;
      placementId: RackPlacementId;
    }
  | { type: "RemoveRack"; dcId: DatacenterId; placementId: RackPlacementId }
  | { type: "SetMaintenanceStaff"; dcId: DatacenterId; maintenanceStaff: number }
  | { type: "UpgradeDatacenter"; dcId: DatacenterId; trackId: DatacenterUpgradeTrackId; targetNodeId: string }
  | { type: "AcceptContract"; contractId: ContractId; dcId: DatacenterId }
  | { type: "CancelContract"; contractId: ContractId }
  | { type: "Tick" };
```

## Rack aging, failures, and maintenance

- Rack age is derived from `currentTick - installedAtTick`, so wear stays deterministic and serializable.
- Failure chance now ramps to `2%` at `12` months, then accelerates through the rest of a rack's lifespan until it caps at `60%` by `72` months.
- That means early-life racks are more reliable than before, while older fleets degrade more sharply in the late game instead of following a flat linear climb.
- Repairs accumulate in **days** even though the main sim still advances in **monthly** ticks. The default repair target is now `45` days on hard mode (and `22.5` days on easy mode), and each tick contributes `repairProgressPerTick(maintenanceStaff)` days.
- Repairing racks still occupy slots and count toward installed hardware, but they contribute **zero usable contract capacity** until repairs complete.
- `maintenanceStaff` is extra datacenter headcount on top of the blueprint's baseline staff. More maintenance staff:
  - speeds up repairs,
  - increases monthly wage opex (at the discounted maintenance-staff rate surfaced by `datacenterMaintenanceStaffingView()`),
  - consumes more of the region's finite labor pool.

### Reading live rack failure probability

Use `rackFailureRiskView()` to get the current failure probability for a single rack placement. This is the canonical, client-facing helper — both CLI and web consumers should call this instead of composing `rackAgeMonths()` + `rackFailureChance()` themselves.

```ts
import {
  rackFailureRiskView,
  type RackFailureRiskView,
} from "@datacenter-tycoon/game-logic";

const view: RackFailureRiskView = rackFailureRiskView(gameState.tick, placement);
// view.ageMonths          — how old the rack is (in monthly ticks)
// view.health             — "healthy" | "repairing"
// view.failureProbability — monthly failure probability in [0, 1]
//                           Always 0 for repairing racks (already failed).
```

Policy notes:
- **Healthy racks** return the age-curve derived probability (`rackFailureChance(ageMonths)`).
- **Repairing racks** always return `0` — they have already failed and cannot newly fail while under repair.
- The probability is clamped to `RACK_FAILURE_MAX_CHANCE` once a rack exceeds `RACK_FAILURE_MAX_AGE_MONTHS`.

### Inspecting datacenter maintenance staffing

Use `datacenterMaintenanceStaffingView()` to get a complete snapshot of a datacenter's maintenance staffing state, including hire affordances, wage costs, and repair speed. This is the canonical helper for both CLI and TUI consumers — never recompute these values ad-hoc.

```ts
import {
  datacenterMaintenanceStaffingView,
  type DatacenterMaintenanceStaffingView,
} from "@datacenter-tycoon/game-logic";

const region = state.map.regions.find((r) => r.id === datacenter.regionId)!;
const view: DatacenterMaintenanceStaffingView = datacenterMaintenanceStaffingView(
  datacenter,
  region,
  state.datacenters,
  state.tick,
);
// view.currentStaff           — extra maintenance staff currently hired
// view.maxStaff               — hard cap (MAX_MAINTENANCE_STAFF)
// view.canIncrease            — false if capped or regional labor exhausted
// view.canDecrease            — false if currentStaff === 0
// view.availableRegionalStaff — spare slots in the region's labor pool
// view.staffWagePerHead       — monthly wage per extra maintenance head
// view.extraWagesMonthly      — total extra wages = currentStaff * staffWagePerHead
// view.repairSpeedDaysPerTick — repair progress added per tick (increases with staff)
// view.repairingRackCount     — racks currently under repair in this datacenter
// view.totalRackCount         — total rack placements
// view.averageRackAgeMonths   — mean rack age across all placements
```

To adjust maintenance staffing, dispatch `SetMaintenanceStaff`. The reducer clamps the count to `[0, MAX_MAINTENANCE_STAFF]` and validates regional labor availability.

```ts
reduce(state, { type: "SetMaintenanceStaff", dcId: datacenter.id, count: 3 });
```

## Starter datacenter cooling headroom

Starter datacenters now ship with slightly more thermal budget for normal expansion:

- `garage`: `120,000` BTU/hr
- `warehouse`: `520,000` BTU/hr
- `hyperscale`: `10,500,000` BTU/hr

The extra headroom makes routine compute / memory / storage growth less punishing, but air-cooled sites are still intentionally constrained: tier-3 racks remain too thermally dense for garage and warehouse blueprints on a per-slot basis.

## Starter rack tiers

The rack catalog now spans tiers `0–3` for every family:

- `C0–C3` — compute
- `M0–M3` — memory
- `S0–S3` — storage
- `G0–G3` — GPU

Tier 0 is intentionally a starter line: roughly half the capacity, capex, power draw, and monthly upkeep of tier 1 hardware. That gives early games a gentler on-ramp without changing contract tiers or introducing a separate beginner-only ruleset.

## Power reservation vs billed usage

Installed racks now have two different power views that intentionally serve different gameplay systems:

- **Reserved power** (placement-time): placement validation still assumes each installed rack could draw its full `powerDrawKw`. This keeps datacenter build limits strict and prevents overbuilding beyond facility capacity.
- **Billed power** (monthly opex): billing uses usage-aware rack activity. Idle racks contribute only the global `RACK_IDLE_BASELINE_POWER_KW`, while active racks consume their full rack-spec draw.

That split lets players pre-install hardware for future growth without always paying full electricity cost for every rack before contracts arrive.

Operational behavior to expect:

- With **no active demand**, billed power is the idle baseline (`RACK_IDLE_BASELINE_POWER_KW`) multiplied by rack count.
- With **active contracts**, a deterministic allocator marks the minimum healthy racks active for assigned demand; those racks bill full spec draw.
- **Repairing racks** cannot absorb active workload, so healthy racks take load first; repairing/idle racks continue at baseline billing.
- When contracts are expired, cancelled, or unassigned, billed power drops back toward baseline on the next monthly tick.

## `GameState` shape

```ts
interface GameState {
  gameId: string;
  game: {
    speed: number;
    paused: boolean;
  };
  tick: number;
  seed: number;
  rngState: number;
  player: {
    id: string;
    name: string;
    cash: number;
    reliability: {
      score: number;
      lastDelta?: number;
      recentOutcomes: ContractSlaOutcome[];
    };
  };
  datacenters: Datacenter[];
  contracts: Contract[];
  contractMarket: Contract[]; // deprecated derived compatibility view
  activeContracts: Contract[]; // deprecated derived compatibility view
  ledger: LedgerEntry[];
  audioEnabled: boolean;
  audioSettings: AudioSettings;
  map: MapState;
}
```

## Region & Map

Datacenters are built in specific regions. Each region has its own economy:

```ts
interface Region {
  id: RegionId;
  name: string;
  code: string;
  city: string;
  coordinates: { x: number; y: number };
  powerCostPerKwh: number;
  staffWage: number;
  taxRate: number;
  totalPowerAvailable: number;
  totalStaffAvailable: number;
  powerUsed: number;
  staffUsed: number;
}

interface MapState {
  regions: Region[];
}
```

- **Power cost** varies by region (e.g., US East ~$0.07/kWh, US West ~$0.05/kWh).
- **Staff wage** varies by region, multiplied by the datacenter's baseline `staffCount + maintenanceStaff` to produce monthly staff opex.
- **Tax rate** is applied to datacenter profit (revenue minus base opex) each tick.
- **Finite pools**: `totalPowerAvailable` and `totalStaffAvailable` cap how many datacenters can be built in a region.

`generateMap(seed)` creates a deterministic set of regions with minor randomized variations (±10% power cost, ±5% wages) for replayability.

## Determinism contract

- Simulation state is plain JSON-serializable data.
- Randomness flows through the seeded PRNG only.
- `newGame(seed)` is deterministic.
- Replaying the same action sequence from the same starting state produces the same result.
- `reduce` and `tick` are pure state-to-state transitions.

## Save format

`serialize(state)` writes a versioned envelope:

```json
{
  "saveVersion": 7,
  "state": {
    "tick": 0,
    "seed": 42,
    "rngState": 42,
    "player": {
      "id": "player-1",
      "name": "Player",
      "cash": 2500000,
      "reliability": {
        "score": 50,
        "recentOutcomes": []
      }
    },
    "datacenters": [],
    "contracts": [],
    "contractMarket": [],
    "activeContracts": [],
    "ledger": [],
    "map": {
      "regions": [...]
    }
  }
}
```

Use `deserialize(json)` to restore a saved game. Saves from earlier versions are intentionally rejected and must be recreated after incompatible updates; the current incompatible boundary is `saveVersion: 7`, which introduced persisted datacenter upgrade progress.
