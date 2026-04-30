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
  newGame,
  reduce,
  serialize,
  type Action,
  type DatacenterId,
  type GameState,
  type RackPlacementId,
} from "@datacenter-tycoon/game-logic";

const datacenterId = (value: string): DatacenterId => value as DatacenterId;
const rackPlacementId = (value: string): RackPlacementId => value as RackPlacementId;

let state: GameState = newGame(42, {
  playerName: "Alex",
});

const actions: Action[] = [
  {
    type: "BuildDatacenter",
    specId: DATACENTER_CATALOG.garage.id,
    dcId: datacenterId("dc-1"),
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
- all public domain types from `types.ts`

## Action reference

```ts
export type Action =
  | { type: "BuildDatacenter"; specId: DatacenterSpecId; dcId: DatacenterId }
  | {
      type: "PlaceRack";
      dcId: DatacenterId;
      specId: RackSpecId;
      row: number;
      position: number;
      placementId: RackPlacementId;
    }
  | { type: "RemoveRack"; dcId: DatacenterId; placementId: RackPlacementId }
  | { type: "AcceptContract"; contractId: ContractId; dcId: DatacenterId }
  | { type: "CancelContract"; contractId: ContractId }
  | { type: "Tick" };
```

## `GameState` shape

```ts
interface GameState {
  tick: number;
  seed: number;
  rngState: number;
  player: {
    id: string;
    name: string;
    cash: number;
  };
  datacenters: Datacenter[];
  contractMarket: Contract[];
  activeContracts: Contract[];
  ledger: LedgerEntry[];
}
```

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
  "saveVersion": 1,
  "state": {
    "tick": 0,
    "seed": 42,
    "rngState": 42,
    "player": {
      "id": "player-1",
      "name": "Player",
      "cash": 2500000
    },
    "datacenters": [],
    "contractMarket": [],
    "activeContracts": [],
    "ledger": []
  }
}
```

Use `deserialize(json)` to restore a saved game. Unknown save versions currently throw.
