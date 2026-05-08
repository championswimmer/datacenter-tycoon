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
    specId: RACK_CATALOG.C1.id,
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
- maintenance balance constants such as `RACK_FAILURE_MAX_CHANCE`, `BASE_REPAIR_DAYS`, and `DAYS_PER_TICK`
- reliability balance helpers such as `RELIABILITY_BASELINE_SCORE`, `RELIABILITY_MARKET_OFFER_COUNT`, `reliabilityBandForScore()`, and `reliabilityMarketPolicyForScore()`
- power billing helpers such as `RACK_IDLE_BASELINE_POWER_KW`, `idleBaselinePowerForRackCount()`, `monthlyKwhFromPowerKw()`, and `KWH_PER_KW_PER_MONTH`
- all public domain types from `types.ts`, including `RackActivityView` and `RackPowerSummary`

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

The current save policy remains **destructive on incompatible format changes**. Version `4` added this reliability shape, so older saves are intentionally rejected rather than migrated.

## Reliability-driven contract market

Reliability is now a full simulation input, not just persisted profile metadata:

- New games start at **50** reliability (`RELIABILITY_BASELINE_SCORE`).
- Each fulfilled month contributes **+3** reliability.
- A breached month contributes **-8** reliability.
- A cancellation after sustained breach contributes **-12** reliability.
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
  | { type: "AcceptContract"; contractId: ContractId; dcId: DatacenterId }
  | { type: "CancelContract"; contractId: ContractId }
  | { type: "Tick" };
```

## Rack aging, failures, and maintenance

- Rack age is derived from `currentTick - installedAtTick`, so wear stays deterministic and serializable.
- Failure chance ramps linearly from `0` to `50%` over the first `36` months of rack life.
- Repairs accumulate in **days** even though the main sim still advances in **monthly** ticks. The default repair target is `90` days, and each tick contributes `repairProgressPerTick(maintenanceStaff)` days.
- Repairing racks still occupy slots and count toward installed hardware, but they contribute **zero usable contract capacity** until repairs complete.
- `maintenanceStaff` is extra datacenter headcount on top of the blueprint's baseline staff. More maintenance staff:
  - speeds up repairs,
  - increases monthly wage opex,
  - consumes more of the region's finite labor pool.

## Power reservation vs billed usage

Installed racks now have two different power views that intentionally serve different gameplay systems:

- **Reserved power** (placement-time): placement validation still assumes each installed rack could draw its full `powerDrawKw`. This keeps datacenter build limits strict and prevents overbuilding beyond facility capacity.
- **Billed power** (monthly opex): billing uses usage-aware rack activity. Idle racks contribute only the global `RACK_IDLE_BASELINE_POWER_KW`, while active racks consume their full rack-spec draw.

That split lets players pre-install hardware for future growth without always paying full electricity cost for every rack before contracts arrive.

Operational behavior to expect:

- With **no active demand**, billed power is the idle baseline (`RACK_IDLE_BASELINE_POWER_KW`) multiplied by rack count.
- With **active contracts**, a deterministic allocator marks the minimum healthy racks active for assigned demand; those racks bill full spec draw.
- **Repairing racks** cannot absorb active workload, so healthy racks take load first; repairing/idle racks continue at baseline billing.
- When contracts are completed, cancelled, or unassigned, billed power drops back toward baseline on the next monthly tick.

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
  contractMarket: Contract[];
  activeContracts: Contract[];
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
  "saveVersion": 4,
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
    "contractMarket": [],
    "activeContracts": [],
    "ledger": [],
    "map": {
      "regions": [...]
    }
  }
}
```

Use `deserialize(json)` to restore a saved game. Saves from earlier versions are intentionally rejected and must be recreated after incompatible updates; the current incompatible boundary is `saveVersion: 4`, which introduced persisted player reliability.
