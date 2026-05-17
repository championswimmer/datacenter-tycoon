import { describe, expect, it } from "vitest";
import {
  DATACENTER_CATALOG,
  RACK_CATALOG,
  createDatacenterUpgradeProgress,
  listRackMoveTargets,
  selectDatacenterMaintenanceStaffingViewFromState,
  selectHistoricalContractsFromState,
  selectLiveContractsFromState,
  selectOpenMarketContractsFromState,
  summarizeAllRegionFabricViewsFromState,
  summarizeDatacenterCapacityFromState,
  summarizeDatacenterFabricCapacityFromState,
  summarizeDatacenterFabricStatusFromState,
  summarizeDatacenterInfrastructureFromState,
  summarizeDatacenterUpgradeViewFromState,
  summarizeNetworkCapacityFromState,
  summarizeOpenMarketContractFits,
  summarizeRegionFabricViewFromState,
  type Contract,
  type ContractId,
  type Datacenter,
  type DatacenterId,
  type GameState,
  type RackPlacement,
  type RackPlacementId,
  type RegionId,
  withDerivedContractViews,
} from "@datacenter-tycoon/game-logic";

import {
  selectActiveContracts,
  selectAllRegionFabricSummaries,
  selectDatacenterCapacitySummary,
  selectDatacenterFabricCapacitySummary,
  selectDatacenterFabricSummary,
  selectDatacenterInfrastructureSummary,
  selectDatacenterMaintenanceStaffingView,
  selectDatacenterUpgradeSummary,
  selectFreeCapacity,
  selectHistoricalContracts,
  selectMarket,
  selectMarketFitSummaries,
  selectRackMoveTargets,
  selectRegionFabricSummary,
} from "./selectors.js";

const contractId = (value: string): ContractId => value as ContractId;
const datacenterId = (value: string): DatacenterId => value as DatacenterId;
const rackPlacementId = (value: string): RackPlacementId => value as RackPlacementId;
const regionId = (value: string): RegionId => value as RegionId;

function placement(id: string, specId: keyof typeof RACK_CATALOG, row: number, position: number): RackPlacement {
  const spec = RACK_CATALOG[specId]!;
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
    spec: DATACENTER_CATALOG.garage!,
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
        { id: regionId("region-a"), name: "Region A", code: "RA", city: "A City", coordinates: { x: 0, y: 0 }, powerCostPerKwh: 0.1, staffWage: 1_000, taxRate: 0.1, totalPowerAvailable: 100, totalStaffAvailable: 5, powerUsed: 0, staffUsed: 0 },
        { id: regionId("region-b"), name: "Region B", code: "RB", city: "B City", coordinates: { x: 1, y: 1 }, powerCostPerKwh: 0.1, staffWage: 1_000, taxRate: 0.1, totalPowerAvailable: 100, totalStaffAvailable: 5, powerUsed: 0, staffUsed: 0 },
      ],
    },
    ...overrides,
  });
}

describe("web query-boundary selectors", () => {
  it("mirrors canonical contract buckets and fit summaries from game-logic", () => {
    const state = makeState({
      datacenters: [
        makeDatacenter("dc-exact", "region-a", [placement("rack-a", "C1", 0, 0)]),
        makeDatacenter("dc-partial", "region-b", [placement("rack-b", "C0", 0, 0)]),
      ],
      contracts: [
        makeContract("exact-fit", {
          requirements: { vCpu: 96, ramGb: 300, storageTb: 10, gpuFlops: 0 },
        }),
        makeContract("partial-fit", {
          requirements: { vCpu: 140, ramGb: 600, storageTb: 14, gpuFlops: 0 },
        }),
        makeContract("live", {
          lifecycleState: "serving",
          status: "active",
          startedAtTick: 1,
          assignedDcId: datacenterId("dc-exact"),
          requirements: { vCpu: 16, ramGb: 64, storageTb: 4, gpuFlops: 0 },
        }),
        makeContract("history", {
          lifecycleState: "cancelled",
          status: "cancelled",
          startedAtTick: 1,
          closedAtTick: 5,
          assignedDcId: datacenterId("dc-partial"),
        }),
      ],
      contractMarket: [],
      activeContracts: [],
    });

    expect(selectMarket(state).map((contract) => contract.id)).toEqual(
      selectOpenMarketContractsFromState(state).map((contract) => contract.id),
    );
    expect(selectActiveContracts(state).map((contract) => contract.id)).toEqual(
      selectLiveContractsFromState(state).map((contract) => contract.id),
    );
    expect(selectHistoricalContracts(state).map((contract) => contract.id)).toEqual(
      selectHistoricalContractsFromState(state).map((contract) => contract.id),
    );
    expect(selectMarketFitSummaries(state)).toEqual(summarizeOpenMarketContractFits(state));
  });

  it("mirrors canonical datacenter capacity and maintenance views", () => {
    const dc1 = makeDatacenter("dc-1", "region-a", [placement("rack-a", "C1", 0, 0)], 0);
    const dc2 = makeDatacenter("dc-2", "region-a", [placement("rack-b", "C1", 0, 0)], 1);
    const state = makeState({
      datacenters: [dc1, dc2],
      contracts: [
        makeContract("live", {
          lifecycleState: "serving",
          status: "active",
          startedAtTick: 1,
          assignedDcId: dc1.id,
          requirements: { vCpu: 16, ramGb: 64, storageTb: 4, gpuFlops: 0 },
        }),
      ],
      map: {
        regions: [
          { id: regionId("region-a"), name: "Region A", code: "RA", city: "A City", coordinates: { x: 0, y: 0 }, powerCostPerKwh: 0.1, staffWage: 1_200, taxRate: 0.1, totalPowerAvailable: 100, totalStaffAvailable: 5, powerUsed: 0, staffUsed: 0 },
          { id: regionId("region-b"), name: "Region B", code: "RB", city: "B City", coordinates: { x: 1, y: 1 }, powerCostPerKwh: 0.1, staffWage: 1_000, taxRate: 0.1, totalPowerAvailable: 100, totalStaffAvailable: 5, powerUsed: 0, staffUsed: 0 },
        ],
      },
    });

    expect(selectDatacenterCapacitySummary(state, dc1.id)).toEqual(
      summarizeDatacenterCapacityFromState(state, dc1.id),
    );
    expect(selectFreeCapacity(state)).toEqual(summarizeNetworkCapacityFromState(state).available);
    expect(selectDatacenterMaintenanceStaffingView(state, dc1.id)).toEqual(
      selectDatacenterMaintenanceStaffingViewFromState(state, dc1.id),
    );
    expect(selectDatacenterInfrastructureSummary(state, dc1.id)).toEqual(
      summarizeDatacenterInfrastructureFromState(state, dc1.id),
    );
    expect(selectDatacenterUpgradeSummary(state, dc1.id)).toEqual(
      summarizeDatacenterUpgradeViewFromState(state, dc1.id),
    );
  });

  it("mirrors canonical rack move target discovery", () => {
    const source = makeDatacenter("dc-source", "region-a", [placement("rack-source", "C1", 0, 0)]);
    const sameRegionTarget = makeDatacenter("dc-same", "region-a", []);
    const crossRegionTarget = makeDatacenter("dc-cross", "region-b", [
      placement("rack-1", "C0", 0, 0),
      placement("rack-2", "C0", 0, 1),
      placement("rack-3", "C0", 0, 2),
      placement("rack-4", "C0", 0, 3),
      placement("rack-5", "C0", 1, 0),
      placement("rack-6", "C0", 1, 1),
      placement("rack-7", "C0", 1, 2),
      placement("rack-8", "C0", 1, 3),
    ]);
    const state = makeState({ datacenters: [source, sameRegionTarget, crossRegionTarget] });

    expect(selectRackMoveTargets(state, source.id, rackPlacementId("rack-source"))).toEqual(
      listRackMoveTargets(state, source.id, rackPlacementId("rack-source")),
    );
  });

  it("mirrors canonical regional fabric summaries for pooled-capacity UI", () => {
    const garageSpecId = DATACENTER_CATALOG.garage!.id;
    const fiberUpgrades = {
      ...createDatacenterUpgradeProgress(garageSpecId),
      currentNodeByTrack: {
        ...createDatacenterUpgradeProgress(garageSpecId).currentNodeByTrack,
        networkType: "fiber" as const,
      },
    };
    const dcA: Datacenter = {
      ...makeDatacenter("dc-a", "region-a", [placement("rack-a", "C1", 0, 0)]),
      upgrades: fiberUpgrades,
    };
    const dcB: Datacenter = {
      ...makeDatacenter("dc-b", "region-a", [placement("rack-b", "C1", 0, 0)]),
      upgrades: fiberUpgrades,
    };
    const dcC = makeDatacenter("dc-c", "region-a", [placement("rack-c", "C1", 0, 0)]);
    const state = makeState({
      datacenters: [dcA, dcB, dcC],
      map: {
        regions: [
          { id: regionId("region-a"), name: "Region A", code: "RA", city: "A City", coordinates: { x: 0, y: 0 }, powerCostPerKwh: 0.1, staffWage: 1_000, taxRate: 0.1, totalPowerAvailable: 100, totalStaffAvailable: 5, powerUsed: 0, staffUsed: 0, fabric: { memberDcIds: [dcA.id, dcB.id] } },
          { id: regionId("region-b"), name: "Region B", code: "RB", city: "B City", coordinates: { x: 1, y: 1 }, powerCostPerKwh: 0.1, staffWage: 1_000, taxRate: 0.1, totalPowerAvailable: 100, totalStaffAvailable: 5, powerUsed: 0, staffUsed: 0 },
        ],
      },
    });

    expect(selectDatacenterFabricCapacitySummary(state, dcA.id)).toEqual(
      summarizeDatacenterFabricCapacityFromState(state, dcA.id),
    );
    expect(selectDatacenterFabricSummary(state, dcC.id)).toEqual(
      summarizeDatacenterFabricStatusFromState(state, dcC.id),
    );
    expect(selectRegionFabricSummary(state, dcA.regionId)).toEqual(
      summarizeRegionFabricViewFromState(state, dcA.regionId),
    );
    expect(selectAllRegionFabricSummaries(state)).toEqual(
      summarizeAllRegionFabricViewsFromState(state),
    );
  });
});
