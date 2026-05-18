import assert from "node:assert/strict";
import test from "node:test";
import { DATACENTER_CATALOG } from "../catalog/datacenters.js";
import { RACK_CATALOG } from "../catalog/racks.js";
import { newGame } from "../state/newGame.js";
import type { Datacenter, GameState, RackPlacement, RackPlacementId } from "../types.js";
import {
  countInstalledServers,
  summarizeCumulativeRevenue,
  summarizeLeaderboardFromState,
  totalLeaderboardCapacity,
} from "./leaderboard.js";

function rackPlacementId(value: string): RackPlacementId {
  return value as RackPlacementId;
}

function placement(
  id: string,
  specKey: keyof typeof RACK_CATALOG,
  row: number,
  position: number,
): RackPlacement {
  const spec = RACK_CATALOG[specKey];

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

function makeDatacenter(placements: RackPlacement[]): Datacenter {
  return {
    id: "dc-1" as Datacenter["id"],
    name: "dc-1",
    spec: DATACENTER_CATALOG.garage,
    placements,
    builtAtTick: 0,
    regionId: "region-1" as Datacenter["regionId"],
    maintenanceStaff: 0,
  };
}

test("summarizeLeaderboardFromState derives top-level leaderboard metrics from game state", () => {
  const computeRack = RACK_CATALOG.C0;
  const memoryRack = RACK_CATALOG.M0;
  const storageRack = RACK_CATALOG.S0;
  const gpuRack = RACK_CATALOG.G0;
  const baseState = newGame(12345, { playerName: "Acme Cloud" });
  const state: GameState = {
    ...baseState,
    tick: 6,
    player: {
      ...baseState.player,
      cash: 1_875_000,
    },
    datacenters: [
      makeDatacenter([
        placement("rack-c0", "C0", 0, 0),
        placement("rack-m0", "M0", 0, 1),
        placement("rack-s0", "S0", 0, 2),
        placement("rack-g0", "G0", 0, 3),
      ]),
    ],
    ledger: [
      { id: "ledger-1" as GameState["ledger"][number]["id"], tick: 1, type: "revenue", amount: 120_000, reason: "rev-1" },
      { id: "ledger-2" as GameState["ledger"][number]["id"], tick: 2, type: "opex", amount: -10_000, reason: "opex" },
      { id: "ledger-3" as GameState["ledger"][number]["id"], tick: 3, type: "revenue", amount: 90_000, reason: "rev-2" },
      { id: "ledger-4" as GameState["ledger"][number]["id"], tick: 4, type: "penalty", amount: -5_000, reason: "penalty" },
    ],
  };

  const summary = summarizeLeaderboardFromState(state);

  assert.equal(summary.gameId, state.gameId);
  assert.equal(summary.gameMonth, 6);
  assert.deepEqual(summary.metrics, {
    money: 1_875_000,
    cumulativeRevenue: 210_000,
    totalServers: 4,
    computeCapacity: computeRack.vCpu + memoryRack.vCpu + storageRack.vCpu + gpuRack.vCpu,
    memoryCapacity: computeRack.ramGb + memoryRack.ramGb + storageRack.ramGb + gpuRack.ramGb,
    storageCapacity: computeRack.storageTb + memoryRack.storageTb + storageRack.storageTb + gpuRack.storageTb,
    gpuCapacity: computeRack.gpuFlops + memoryRack.gpuFlops + storageRack.gpuFlops + gpuRack.gpuFlops,
  });
  assert.equal(totalLeaderboardCapacity(summary.metrics),
    summary.metrics.computeCapacity
      + summary.metrics.memoryCapacity
      + summary.metrics.storageCapacity
      + summary.metrics.gpuCapacity);
});

test("summarizeCumulativeRevenue only counts revenue ledger entries", () => {
  assert.equal(
    summarizeCumulativeRevenue([
      { type: "revenue", amount: 10 },
      { type: "opex", amount: -4 },
      { type: "revenue", amount: 6 },
      { type: "penalty", amount: -3 },
    ]),
    16,
  );
});

test("countInstalledServers totals rack placements across all datacenters", () => {
  const state = newGame(77);
  state.datacenters = [
    makeDatacenter([placement("rack-a", "C0", 0, 0)]),
    {
      ...makeDatacenter([
        placement("rack-b", "M0", 0, 0),
        placement("rack-c", "S0", 0, 1),
      ]),
      id: "dc-2" as Datacenter["id"],
      name: "dc-2",
    },
  ];

  assert.equal(countInstalledServers(state), 3);
});
