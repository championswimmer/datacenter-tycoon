import assert from "node:assert/strict";
import test from "node:test";

import { DATACENTER_CATALOG } from "../catalog/datacenters.js";
import { RACK_CATALOG } from "../catalog/racks.js";
import {
	selectDatacenterMaintenanceStaffingViewFromState,
	summarizeDatacenterCapacityFromState,
	summarizeDatacenterFabricCapacityFromState,
	summarizeDatacenterFabricStatusFromState,
	summarizeDatacenterInfrastructureFromState,
	summarizeDatacenterUpgradeViewFromState,
	summarizeNetworkCapacityFromState,
	summarizeRegionFabricViewFromState,
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

function trackNodeStatuses(state: GameState, dcId: DatacenterId, trackId: "cooling" | "networkType" | "onsiteGeneration") {
	return summarizeDatacenterUpgradeViewFromState(state, dcId).tracks.find((track) => track.trackId === trackId)?.nodes.map((node) => node.status);
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

test("summarizeDatacenterInfrastructureFromState exposes explicit base and effective infrastructure views", () => {
	const dc1 = makeDatacenter("dc-1", "region-a", [placement("rack-a", "C1", 0, 0)]);
	const state = makeState({ datacenters: [dc1] });

	assert.deepEqual(summarizeDatacenterInfrastructureFromState(state, dc1.id), {
		dcId: dc1.id,
		base: {
			gridImportCapacityKw: DATACENTER_CATALOG.garage.powerCapacityKw,
			onsiteGenerationCapacityKw: 0,
			rackPowerCapacityKw: DATACENTER_CATALOG.garage.powerCapacityKw,
			coolingCapacityBtuPerHr: DATACENTER_CATALOG.garage.coolingCapacityBtuPerHr,
			coolingType: DATACENTER_CATALOG.garage.coolingType,
			networkType: DATACENTER_CATALOG.garage.networkType,
			bandwidthGbps: DATACENTER_CATALOG.garage.bandwidthGbps,
		},
		effective: {
			gridImportCapacityKw: DATACENTER_CATALOG.garage.powerCapacityKw,
			onsiteGenerationCapacityKw: 0,
			rackPowerCapacityKw: DATACENTER_CATALOG.garage.powerCapacityKw,
			coolingCapacityBtuPerHr: DATACENTER_CATALOG.garage.coolingCapacityBtuPerHr,
			coolingType: DATACENTER_CATALOG.garage.coolingType,
			networkType: DATACENTER_CATALOG.garage.networkType,
			bandwidthGbps: DATACENTER_CATALOG.garage.bandwidthGbps,
		},
		fabricEligible: false,
	});
});

test("summarizeDatacenterUpgradeViewFromState exposes track affordances, upgrade opex, and fiber eligibility", () => {
	const upgradedDc: Datacenter = {
		...makeDatacenter("dc-upgraded", "region-a", [placement("rack-a", "C1", 0, 0)]),
		upgrades: {
			currentNodeByTrack: {
				cooling: "hybrid",
				networkType: "fiber",
				onsiteGeneration: "gen-1",
			},
		},
	};
	const state = makeState({ datacenters: [upgradedDc] });
	const summary = summarizeDatacenterUpgradeViewFromState(state, upgradedDc.id);

	assert.equal(summary.fabricEligible, true);
	assert.equal(summary.infrastructure.effective.coolingType, "hybrid");
	assert.equal(summary.infrastructure.effective.networkType, "fiber");
	assert.equal(summary.infrastructure.effective.onsiteGenerationCapacityKw, 25);
	assert.equal(summary.fixedMonthlyUpgradeOpex, 3_750);
	assert.equal(summary.tracks.find((track) => track.trackId === "cooling")?.currentNode.id, "hybrid");
	assert.equal(summary.tracks.find((track) => track.trackId === "cooling")?.nextNode, null);
	assert.deepEqual(trackNodeStatuses(state, upgradedDc.id, "cooling"), ["completed", "current"]);
	assert.equal(summary.tracks.find((track) => track.trackId === "networkType")?.currentNode.id, "fiber");
	assert.deepEqual(trackNodeStatuses(state, upgradedDc.id, "networkType"), ["completed", "completed", "current"]);
	assert.equal(summary.tracks.find((track) => track.trackId === "onsiteGeneration")?.nextNode?.id ?? null, null);
	assert.equal(summary.tracks.find((track) => track.trackId === "onsiteGeneration")?.totalNodes, 2);
	assert.equal(summary.tracks.find((track) => track.trackId === "onsiteGeneration")?.maxed, true);
	assert.deepEqual(trackNodeStatuses(state, upgradedDc.id, "onsiteGeneration"), ["completed", "current"]);
});

test("summarizeDatacenterUpgradeViewFromState exposes next-node capex, opex deltas, and ladder states for default datacenters", () => {
	const dc1 = makeDatacenter("dc-1", "region-a", []);
	const state = makeState({ datacenters: [dc1] });
	const summary = summarizeDatacenterUpgradeViewFromState(state, dc1.id);
	const cooling = summary.tracks.find((track) => track.trackId === "cooling");
	const network = summary.tracks.find((track) => track.trackId === "networkType");

	assert.equal(summary.fabricEligible, false);
	assert.equal(cooling?.currentNode.id, "air");
	assert.equal(cooling?.nextNode?.id, "hybrid");
	assert.equal(cooling?.nextNode?.capexCost, 180_000);
	assert.equal(cooling?.nextNode?.fixedMonthlyOpexDelta, 900);
	assert.deepEqual(trackNodeStatuses(state, dc1.id, "cooling"), ["current", "available"]);
	assert.equal(network?.currentNode.id, "cat6");
	assert.equal(network?.nextNode?.id, "cat8");
	assert.equal(network?.nextNode?.fixedMonthlyOpexDelta, 350);
	assert.deepEqual(trackNodeStatuses(state, dc1.id, "networkType"), ["current", "available", "locked"]);
	assert.deepEqual(trackNodeStatuses(state, dc1.id, "onsiteGeneration"), ["current", "available"]);
});

test("summarizeDatacenterUpgradeViewFromState marks intermediate ladder progress on partially upgraded tracks", () => {
	const partiallyUpgradedDc: Datacenter = {
		...makeDatacenter("dc-partial", "region-a", []),
		upgrades: {
			currentNodeByTrack: {
				networkType: "cat8",
			},
		},
	};
	const state = makeState({ datacenters: [partiallyUpgradedDc] });
	const summary = summarizeDatacenterUpgradeViewFromState(state, partiallyUpgradedDc.id);
	const network = summary.tracks.find((track) => track.trackId === "networkType");

	assert.equal(network?.currentNode.id, "cat8");
	assert.equal(network?.nextNode?.id, "fiber");
	assert.deepEqual(trackNodeStatuses(state, partiallyUpgradedDc.id, "networkType"), ["completed", "current", "available"]);
});

test("summarizeDatacenterFabric* selectors expose pooled capacity and fiber-gated status views", () => {
	const dcA: Datacenter = {
		...makeDatacenter("dc-a", "region-a", [placement("rack-a", "C1", 0, 0)]),
		upgrades: { currentNodeByTrack: { networkType: "fiber" } },
	};
	const dcB: Datacenter = {
		...makeDatacenter("dc-b", "region-a", [placement("rack-b", "C1", 0, 0)]),
		upgrades: { currentNodeByTrack: { networkType: "fiber" } },
	};
	const dcC = makeDatacenter("dc-c", "region-a", [placement("rack-c", "C1", 0, 0)]);
	const state = makeState({
		datacenters: [dcA, dcB, dcC],
		contracts: [
			makeContract("live-1", {
				assignedDcId: dcA.id,
				requirements: { vCpu: 64, ramGb: 128, storageTb: 4, gpuFlops: 0 },
			}),
		],
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
					fabric: { memberDcIds: [dcA.id, dcB.id] },
				},
			],
		},
	});

	const pooled = summarizeDatacenterFabricCapacityFromState(state, dcA.id);
	const linkedStatus = summarizeDatacenterFabricStatusFromState(state, dcA.id);
	const blockedStatus = summarizeDatacenterFabricStatusFromState(state, dcC.id);
	const regionView = summarizeRegionFabricViewFromState(state, "region-a" as Datacenter["regionId"]);

	assert.equal(pooled.connected, true);
	assert.deepEqual(pooled.memberDcIds, [dcA.id, dcB.id]);
	assert.deepEqual(pooled.available, { vCpu: 192, ramGb: 896, storageTb: 28, gpuFlops: 0 });
	assert.equal(linkedStatus.fabricConnected, true);
	assert.equal(linkedStatus.fabricEligible, true);
	assert.equal(blockedStatus.fabricEligible, false);
	assert.equal(blockedStatus.fabricIneligibilityReason, "Upgrade network to fiber to join the regional fabric.");
	assert.equal(regionView.active, true);
	assert.deepEqual(regionView.memberDcIds, [dcA.id, dcB.id]);
	assert.deepEqual(regionView.eligibleDcIds, [dcA.id, dcB.id]);
	assert.deepEqual(regionView.blockedDcIds, [dcC.id]);
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
