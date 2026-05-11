import assert from "node:assert/strict";
import test from "node:test";

import {
  DATACENTER_CATALOG,
  RACK_CATALOG,
  selectDatacenterMaintenanceStaffingViewFromState,
  selectHistoricalContractsFromState,
  selectLiveContractsFromState,
  selectOpenMarketContractsFromState,
  summarizeDatacenterCapacityFromState,
  type Contract,
  type ContractId,
  type Datacenter,
  type DatacenterId,
  type GameState,
  type RackPlacement,
  type RackPlacementId,
  withDerivedContractViews,
} from "@datacenter-tycoon/game-logic";

import { presentContractBuckets } from "./commands/contracts-view.js";
import { GameRuntime } from "./daemon/runtime.js";

const contractId = (value: string): ContractId => value as ContractId;
const datacenterId = (value: string): DatacenterId => value as DatacenterId;
const rackPlacementId = (value: string): RackPlacementId => value as RackPlacementId;

function placement(id: string, specId: keyof typeof RACK_CATALOG, row: number, position: number): RackPlacement {
  const spec = RACK_CATALOG[specId];
  return {
    id: rackPlacementId(id),
    specId: spec.id,
    kind: spec.kind,
    installedAtTick: 0,
    health: "healthy",
    row,
    position,
  };
}

function makeDatacenter(id: string, regionId: string, placements: RackPlacement[], maintenanceStaff = 0): Datacenter {
  return {
    id: datacenterId(id),
    name: id,
    spec: DATACENTER_CATALOG.garage,
    placements,
    builtAtTick: 0,
    regionId: regionId as Datacenter["regionId"],
    maintenanceStaff,
  };
}

function makeContract(id: string, overrides: Partial<Contract> = {}): Contract {
  return {
    id: contractId(id),
    name: id,
    requirements: { vCpu: 64, ramGb: 256, storageTb: 8, gpuFlops: 0 },
    monthlyPayment: 10_000,
    penaltyPerMonth: 2_000,
    termMonths: 6,
    lifecycleState: "market_open",
    status: "offered",
    urgency: "standard",
    tier: 1,
    offeredAtTick: 0,
    expiresAtTick: 6,
    ...overrides,
  };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return withDerivedContractViews({
    gameId: "game-1" as GameState["gameId"],
    game: { speed: 1, paused: false },
    tick: 6,
    seed: 1,
    rngState: 1,
    difficulty: "hard",
    player: {
      id: "player-1" as GameState["player"]["id"],
      name: "Player",
      cash: 1_000_000,
      reliability: { score: 50, recentOutcomes: [] },
    },
    datacenters: [],
    contracts: [],
    contractMarket: [],
    activeContracts: [],
    ledger: [],
    audioEnabled: true,
    audioSettings: { master: true, music: true, sfx: true, money: true, ambient: true },
    map: {
      regions: [
        { id: "region-a", name: "Region A", code: "RA", city: "A City", coordinates: { x: 0, y: 0 }, powerCostPerKwh: 0.1, staffWage: 1_200, taxRate: 0.1, totalPowerAvailable: 100, totalStaffAvailable: 5, powerUsed: 0, staffUsed: 0 },
        { id: "region-b", name: "Region B", code: "RB", city: "B City", coordinates: { x: 1, y: 1 }, powerCostPerKwh: 0.1, staffWage: 1_000, taxRate: 0.1, totalPowerAvailable: 100, totalStaffAvailable: 5, powerUsed: 0, staffUsed: 0 },
      ],
    },
    ...overrides,
  });
}

test("CLI runtime list payloads mirror canonical game-logic queries", () => {
  const dc1 = makeDatacenter("dc-1", "region-a", [placement("rack-a", "C1", 0, 0)], 0);
  const dc2 = makeDatacenter("dc-2", "region-a", [placement("rack-b", "C1", 0, 0)], 1);
  const state = makeState({
    datacenters: [dc1, dc2],
    contracts: [
      makeContract("market"),
      makeContract("live", {
        lifecycleState: "serving",
        status: "active",
        startedAtTick: 1,
        assignedDcId: dc1.id,
        requirements: { vCpu: 16, ramGb: 64, storageTb: 4, gpuFlops: 0 },
      }),
      makeContract("history", {
        lifecycleState: "cancelled",
        status: "cancelled",
        startedAtTick: 1,
        closedAtTick: 5,
        assignedDcId: dc2.id,
      }),
    ],
  });
  const runtime = new GameRuntime({ state, paused: true });

  const contracts = runtime.query({ kind: "list", target: "contracts" });
  assert.equal(contracts.kind, "contracts");
  assert.deepEqual(contracts.market.map((contract) => contract.id), selectOpenMarketContractsFromState(state).map((contract) => contract.id));
  assert.deepEqual(contracts.active.map((contract) => contract.id), selectLiveContractsFromState(state).map((contract) => contract.id));
  assert.deepEqual(contracts.history.map((contract) => contract.id), selectHistoricalContractsFromState(state).map((contract) => contract.id));

  const datacenters = runtime.query({ kind: "list", target: "datacenters" });
  assert.equal(datacenters.kind, "datacenters");
  assert.deepEqual(datacenters.items[0]?.capacitySummary, summarizeDatacenterCapacityFromState(state, dc1.id));
  assert.deepEqual(datacenters.items[0]?.maintenance, selectDatacenterMaintenanceStaffingViewFromState(state, dc1.id));
});

test("CLI contract presenters mirror canonical game-logic buckets", () => {
  const state = makeState({
    contracts: [
      makeContract("market"),
      makeContract("live", {
        lifecycleState: "breached",
        status: "breached",
        startedAtTick: 1,
        assignedDcId: datacenterId("dc-1"),
      }),
      makeContract("history", {
        lifecycleState: "completed",
        status: "expired",
        startedAtTick: 1,
        closedAtTick: 5,
        assignedDcId: datacenterId("dc-1"),
      }),
    ],
  });

  const buckets = presentContractBuckets(state);
  assert.deepEqual(buckets.market.map((contract) => contract.id), selectOpenMarketContractsFromState(state).map((contract) => contract.id));
  assert.deepEqual(buckets.active.map((contract) => contract.id), selectLiveContractsFromState(state).map((contract) => contract.id));
  assert.deepEqual(buckets.history.map((contract) => contract.id), selectHistoricalContractsFromState(state).map((contract) => contract.id));
});
