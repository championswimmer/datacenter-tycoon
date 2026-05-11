import assert from "node:assert/strict";
import test from "node:test";

import { DATACENTER_CATALOG } from "../catalog/datacenters.js";
import { RACK_CATALOG } from "../catalog/racks.js";
import {
	selectDatacenterMaintenanceStaffingViewFromState,
	summarizeDatacenterCapacityFromState,
	summarizeNetworkCapacityFromState,
	type Contract,
	type ContractId,
	type Datacenter,
	type DatacenterId,
	type GameState,
	type RackPlacement,
	type RackPlacementId,
	withDerivedContractViews,
} from "../index.js";

const contractId = (value: string): ContractId => value as ContractId;
const datacenterId = (value: string): DatacenterId => value as DatacenterId;
const rackPlacementId = (value: string): RackPlacementId => value as RackPlacementId;

function placement(id: string, specId: keyof typeof RACK_CATALOG, row: number, position: number, overrides: Partial<RackPlacement> = {}): RackPlacement {
	const spec = RACK_CATALOG[specId];
	return {
		id: rackPlacementId(id),
		specId: spec.id,
		kind: spec.kind,
		installedAtTick: 0,
		health: "healthy",
		row,
		position,
		...overrides,
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
		lifecycleState: "serving",
		status: "active",
		urgency: "standard",
		tier: 1,
		offeredAtTick: 0,
		expiresAtTick: 6,
		startedAtTick: 0,
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
		map: { regions: [] },
		...overrides,
	});
}

test("summarizeDatacenterCapacityFromState reports installed, usable, committed, and available capacity", () => {
	const dc1 = makeDatacenter("dc-1", "region-a", [
		placement("rack-a", "C1", 0, 0),
		placement("rack-b", "G1", 0, 1, { health: "repairing", repairProgressDays: 10 }),
	]);
	const dc2 = makeDatacenter("dc-2", "region-b", [placement("rack-c", "M1", 0, 0)]);
	const state = makeState({
		datacenters: [dc1, dc2],
		contracts: [
			makeContract("live-1", { assignedDcId: dc1.id }),
			makeContract("live-2", {
				id: contractId("live-2"),
				requirements: { vCpu: 16, ramGb: 64, storageTb: 4, gpuFlops: 0 },
				assignedDcId: dc2.id,
			}),
			makeContract("history", {
				id: contractId("history"),
				lifecycleState: "cancelled",
				status: "cancelled",
				assignedDcId: dc1.id,
				closedAtTick: 5,
			}),
		],
		map: {
			regions: [
				{ id: "region-a", name: "Region A", code: "RA", city: "A City", coordinates: { x: 0, y: 0 }, powerCostPerKwh: 0.1, staffWage: 1_000, taxRate: 0.1, totalPowerAvailable: 100, totalStaffAvailable: 5, powerUsed: 0, staffUsed: 0 },
				{ id: "region-b", name: "Region B", code: "RB", city: "B City", coordinates: { x: 1, y: 1 }, powerCostPerKwh: 0.1, staffWage: 1_000, taxRate: 0.1, totalPowerAvailable: 100, totalStaffAvailable: 5, powerUsed: 0, staffUsed: 0 },
			],
		},
	});

	assert.deepEqual(summarizeDatacenterCapacityFromState(state, dc1.id), {
		dcId: dc1.id,
		installed: { vCpu: 192, ramGb: 1536, storageTb: 40, gpuFlops: 500 },
		usable: { vCpu: 128, ramGb: 512, storageTb: 16, gpuFlops: 0 },
		committed: { vCpu: 64, ramGb: 256, storageTb: 8, gpuFlops: 0 },
		available: { vCpu: 64, ramGb: 256, storageTb: 8, gpuFlops: 0 },
	});

	const network = summarizeNetworkCapacityFromState(state);
	assert.deepEqual(network.available, { vCpu: 96, ramGb: 2240, storageTb: 24, gpuFlops: 0 });
	assert.equal(network.perDc.length, 2);
});

test("selectDatacenterMaintenanceStaffingViewFromState flags exhausted regional labor pools", () => {
	const dc1 = makeDatacenter("dc-1", "region-a", [placement("rack-a", "C1", 0, 0)], 0);
	const dc2 = makeDatacenter("dc-2", "region-a", [placement("rack-b", "C1", 0, 0)], 1);
	const state = makeState({
		datacenters: [dc1, dc2],
		map: {
			regions: [
				{
					id: "region-a",
					name: "Region A",
					code: "RA",
					city: "A City",
					coordinates: { x: 0, y: 0 },
					powerCostPerKwh: 0.1,
					staffWage: 1_200,
					taxRate: 0.1,
					totalPowerAvailable: 100,
					totalStaffAvailable: 5,
					powerUsed: 0,
					staffUsed: 0,
				},
			],
		},
	});

	const view = selectDatacenterMaintenanceStaffingViewFromState(state, dc1.id);
	assert.equal(view.availableRegionalStaff, 0);
	assert.equal(view.canIncrease, false);
	assert.equal(view.canDecrease, false);
	assert.equal(view.currentStaff, 0);
});
