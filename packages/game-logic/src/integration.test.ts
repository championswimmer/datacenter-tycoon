import assert from "node:assert/strict";
import test from "node:test";

import {
	DATACENTER_CATALOG,
	RACK_CATALOG,
	RELIABILITY_MARKET_OFFER_COUNT,
	datacenterRackPowerSummary,
	newGame,
	reduce,
	tickOpex,
	type ContractId,
	type DatacenterId,
	type RackPlacementId,
	type RegionId,
} from "./index.js";

const datacenterId = (value: string): DatacenterId => value as DatacenterId;
const rackPlacementId = (value: string): RackPlacementId => value as RackPlacementId;
const contractId = (value: string): ContractId => value as ContractId;
const regionId = (value: string): RegionId => value as RegionId;

test("end-to-end scripted game remains profitable over an early 3-tick run", () => {
	let state = newGame(1);
	const warehouseId = datacenterId("dc-warehouse-1");
	// Use US East — cheap power and staff, low tax — to keep the short scripted run profitable.
	const regionId = "us_east" as import("./types.js").RegionId;

	state = reduce(state, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.warehouse.id,
		dcId: warehouseId,
		regionId,
	});

	const placements = [
		{ specId: RACK_CATALOG.C2.id, row: 0, position: 0, placementId: rackPlacementId("rack-c2-1") },
		{ specId: RACK_CATALOG.C2.id, row: 0, position: 1, placementId: rackPlacementId("rack-c2-2") },
		{ specId: RACK_CATALOG.C2.id, row: 0, position: 2, placementId: rackPlacementId("rack-c2-3") },
		{ specId: RACK_CATALOG.C2.id, row: 0, position: 3, placementId: rackPlacementId("rack-c2-4") },
		{ specId: RACK_CATALOG.S2.id, row: 1, position: 0, placementId: rackPlacementId("rack-s2-1") },
		{ specId: RACK_CATALOG.S2.id, row: 1, position: 1, placementId: rackPlacementId("rack-s2-2") },
	] as const;

	for (const placement of placements) {
		state = reduce(state, {
			type: "PlaceRack",
			dcId: warehouseId,
			...placement,
		});
	}

	state = {
		...state,
		contractMarket: [
			{
				id: contractId("warehouse-anchor-contract"),
				name: "Warehouse Anchor Customer",
				requirements: {
					vCpu: 640,
					ramGb: 2_600,
					storageTb: 1_600,
					gpuFlops: 0,
				},
				monthlyPayment: 320_000,
				penaltyPerMonth: 90_000,
				termMonths: 3,
				status: "offered",
				offeredAtTick: state.tick,
				expiresAtTick: state.tick + 3,
			},
		],
	};

	state = reduce(state, {
		type: "AcceptContract",
		contractId: contractId("warehouse-anchor-contract"),
		dcId: warehouseId,
	});
	const cashBeforeTicks = state.player.cash;

	for (let month = 0; month < 3; month += 1) {
		state = reduce(state, { type: "Tick" });
	}

	const contract = state.activeContracts.find((candidate) => candidate.id === contractId("warehouse-anchor-contract"));

	assert.ok(contract);
	assert.equal(contract.status, "expired");
	assert.equal(state.tick, 3);
	assert.ok(state.player.cash > cashBeforeTicks);
	assert.ok(state.ledger.some((entry) => entry.type === "revenue"));
	assert.equal(state.datacenters[0]?.spec.id, DATACENTER_CATALOG.warehouse.id);
	assert.equal(state.datacenters[0]?.placements.length, 6);
});

test("starter-tier builds can serve a modest tier-1 contract without contract-system changes", () => {
	let state = newGame(21);
	const dcId = datacenterId("dc-starter-1");
	const placementSpecs = [RACK_CATALOG.C0.id, RACK_CATALOG.M0.id, RACK_CATALOG.S0.id] as const;

	state = reduce(state, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId,
		regionId: regionId("us_west"),
	});

	placementSpecs.forEach((specId, index) => {
		state = reduce(state, {
			type: "PlaceRack",
			dcId,
			specId,
			row: 0,
			position: index,
			placementId: rackPlacementId(`starter-${index}`),
		});
	});

	state = {
		...state,
		contractMarket: [
			{
				id: contractId("starter-tier-contract"),
				name: "Starter Tier Contract",
				requirements: { vCpu: 80, ramGb: 512, storageTb: 200, gpuFlops: 0 },
				monthlyPayment: 45_000,
				penaltyPerMonth: 10_000,
				termMonths: 2,
				status: "offered",
				offeredAtTick: state.tick,
				expiresAtTick: state.tick + 3,
				tier: 1,
			},
		],
	};

	state = reduce(state, {
		type: "AcceptContract",
		contractId: contractId("starter-tier-contract"),
		dcId,
	});
	const cashBeforeTick = state.player.cash;
	state = reduce(state, { type: "Tick" });

	assert.equal(state.activeContracts[0]?.status, "active");
	assert.ok(state.player.cash > cashBeforeTick);
	assert.equal(state.datacenters[0]?.placements.length, 3);
});

test("regional opex reflects location economics", () => {
	let state = newGame(42);
	const usEastId = regionId("us_east");
	const usWestId = regionId("us_west");

	// Build identical garages in US East and US West
	state = reduce(state, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId: datacenterId("dc-us-east"),
		regionId: usEastId,
	});
	state = reduce(state, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId: datacenterId("dc-us-west"),
		regionId: usWestId,
	});

	const usEastDc = state.datacenters.find((d) => d.id === datacenterId("dc-us-east"))!;
	const usWestDc = state.datacenters.find((d) => d.id === datacenterId("dc-us-west"))!;
	const usEastRegion = state.map.regions.find((r) => r.id === usEastId)!;
	const usWestRegion = state.map.regions.find((r) => r.id === usWestId)!;

	const usEastOpex = tickOpex(usEastDc, usEastRegion);
	const usWestOpex = tickOpex(usWestDc, usWestRegion);

	// US West should be cheaper than US East for staff
	assert.ok(usWestOpex.breakdown.staff < usEastOpex.breakdown.staff);
	// Both have no power/cooling/maintenance with no racks
	assert.equal(usEastOpex.breakdown.power, 0);
	assert.equal(usWestOpex.breakdown.power, 0);
	assert.equal(usEastOpex.breakdown.cooling, 0);
	assert.equal(usWestOpex.breakdown.cooling, 0);
	assert.equal(usEastOpex.breakdown.maintenance, 0);
	assert.equal(usWestOpex.breakdown.maintenance, 0);
	// US West total should be much lower than US East
	assert.ok(usWestOpex.total < usEastOpex.total);

	// Verify staff cost matches region wage * garage staffCount (1)
	assert.equal(usEastOpex.breakdown.staff, usEastRegion.staffWage * 1);
	assert.equal(usWestOpex.breakdown.staff, usWestRegion.staffWage * 1);

	// Run a tick and verify ledger reflects combined costs
	state = reduce(state, { type: "Tick" });
	const opexEntry = state.ledger.find((e) => e.type === "opex");
	assert.ok(opexEntry);
	assert.equal(opexEntry.amount, -(usEastOpex.total + usWestOpex.total));
});

function stateWithGarage(seed: number, dcIdValue: string) {
	let state = newGame(seed, { startingCash: 1_000_000 });
	state = reduce(state, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId: datacenterId(dcIdValue),
		regionId: regionId("us_east"),
	});
	return state;
}

test("platinum reliability from clean SLA months expands future market supply", () => {
	const dcId = datacenterId("dc-reliable-1");
	let state = stateWithGarage(84, "dc-reliable-1");
	state = {
		...state,
		player: {
			...state.player,
			reliability: {
				score: 68,
				recentOutcomes: [],
			},
		},
		contractMarket: [],
		activeContracts: [
			{
				id: contractId("reliable-contract"),
				name: "Reliable Growth Contract",
				requirements: { vCpu: 0, ramGb: 0, storageTb: 0, gpuFlops: 0 },
				monthlyPayment: 18_000,
				penaltyPerMonth: 2_000,
				termMonths: 12,
				status: "active",
				offeredAtTick: 0,
				expiresAtTick: 6,
				startedAtTick: 0,
				assignedDcId: dcId,
			},
		],
	};

	state = reduce(state, { type: "Tick" });

	assert.equal(state.player.reliability.score, 71);
	assert.equal(state.player.reliability.lastDelta, 3);
	assert.equal(state.contractMarket.length, RELIABILITY_MARKET_OFFER_COUNT.platinum);
	assert.equal(state.activeContracts[0]?.status, "active");
	assert.equal(state.player.reliability.recentOutcomes.at(-1)?.kind, "fulfilled");
});

test("breached reliability loops shrink later market opportunities once the score falls silver-tier", () => {
	const dcId = datacenterId("dc-breach-1");
	let state = stateWithGarage(85, "dc-breach-1");
	state = {
		...state,
		player: {
			...state.player,
			reliability: {
				score: 38,
				recentOutcomes: [],
			},
		},
		contractMarket: [],
		activeContracts: [
			{
				id: contractId("breached-contract"),
				name: "Impossible SLA Contract",
				requirements: { vCpu: 500, ramGb: 5_000, storageTb: 500, gpuFlops: 500 },
				monthlyPayment: 25_000,
				penaltyPerMonth: 9_000,
				termMonths: 12,
				status: "active",
				offeredAtTick: 0,
				expiresAtTick: 6,
				startedAtTick: 0,
				assignedDcId: dcId,
			},
		],
	};

	state = reduce(state, { type: "Tick" });

	assert.equal(state.player.reliability.score, 30);
	assert.equal(state.player.reliability.lastDelta, -8);
	assert.equal(state.contractMarket.length, RELIABILITY_MARKET_OFFER_COUNT["silver"]);
	assert.equal(state.activeContracts[0]?.status, "breached");
	assert.equal(state.player.reliability.recentOutcomes.at(-1)?.kind, "breached");
});

test("tax is applied on profitable datacenters and varies by region", () => {
	let state = newGame(42, { startingCash: 1_000_000 });
	const dcId = datacenterId("dc-test-1");
	const usEastId = regionId("us_east");

	state = reduce(state, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId,
		regionId: usEastId,
	});

	state = reduce(state, {
		type: "PlaceRack",
		dcId,
		specId: RACK_CATALOG.C1.id,
		row: 0,
		position: 0,
		placementId: rackPlacementId("rack-1"),
	});

	// Inject a high-paying contract so the DC is profitable
	state = {
		...state,
		contractMarket: [
			{
				id: contractId("test-contract"),
				name: "Test Contract",
				requirements: { vCpu: 32, ramGb: 64, storageTb: 8, gpuFlops: 0 },
				monthlyPayment: 50_000,
				penaltyPerMonth: 10_000,
				termMonths: 3,
				status: "offered",
				offeredAtTick: 0,
				expiresAtTick: 3,
			},
		],
	};

	state = reduce(state, {
		type: "AcceptContract",
		contractId: contractId("test-contract"),
		dcId,
	});

	const region = state.map.regions.find((r) => r.id === usEastId)!;
	const dc = state.datacenters.find((d) => d.id === dcId)!;
	const opexBeforeTick = tickOpex(dc, region, state.contracts);

	state = reduce(state, { type: "Tick" });

	const opexEntry = state.ledger.find((e) => e.type === "opex");
	assert.ok(opexEntry);

	// Verify revenue was recorded
	const revenueEntry = state.ledger.find((e) => e.type === "revenue");
	assert.ok(revenueEntry);
	assert.equal(revenueEntry.amount, 50000);

	// Calculate expected tax: profit * taxRate
	const profit = Math.max(0, revenueEntry.amount - opexBeforeTick.total);
	const expectedTax = Math.round(profit * region.taxRate * 100) / 100;
	const expectedTotalOpex = Math.round((opexBeforeTick.total + expectedTax) * 100) / 100;

	assert.equal(opexEntry.amount, -expectedTotalOpex);

	// Cash should have increased because revenue exceeds opex
	assert.ok(state.player.cash > 700_000);
});

test("contract lifecycle preserves assignment visibility across expired, cancelled, and breached outcomes", () => {
	let state = newGame(202, { startingCash: 1_000_000 });
	const dcId = datacenterId("dc-lifecycle");
	const lifecycleRegionId = regionId("us_east");

	state = reduce(state, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId,
		regionId: lifecycleRegionId,
	});
	state = reduce(state, {
		type: "PlaceRack",
		dcId,
		specId: RACK_CATALOG.C1.id,
		row: 0,
		position: 0,
		placementId: rackPlacementId("rack-lifecycle-c1"),
	});

	state = {
		...state,
		contractMarket: [
			{
				id: contractId("expired-contract"),
				name: "Expires Cleanly",
				requirements: { vCpu: 32, ramGb: 64, storageTb: 0, gpuFlops: 0 },
				monthlyPayment: 35_000,
				penaltyPerMonth: 6_000,
				termMonths: 1,
				status: "offered",
				offeredAtTick: state.tick,
				expiresAtTick: state.tick + 6,
			},
		],
	};
	state = reduce(state, {
		type: "AcceptContract",
		contractId: contractId("expired-contract"),
		dcId,
	});
	assert.equal(state.activeContracts.find((contract) => contract.id === contractId("expired-contract"))?.assignedDcId, dcId);

	state = reduce(state, { type: "Tick" });
	assert.equal(state.activeContracts.find((contract) => contract.id === contractId("expired-contract"))?.status, "expired");

	state = {
		...state,
		contractMarket: [
			{
				id: contractId("cancelled-contract"),
				name: "Cancelled By Player",
				requirements: { vCpu: 32, ramGb: 64, storageTb: 0, gpuFlops: 0 },
				monthlyPayment: 28_000,
				penaltyPerMonth: 5_000,
				termMonths: 3,
				status: "offered",
				offeredAtTick: state.tick,
				expiresAtTick: state.tick + 6,
			},
		],
	};
	state = reduce(state, {
		type: "AcceptContract",
		contractId: contractId("cancelled-contract"),
		dcId,
	});
	state = reduce(state, {
		type: "CancelContract",
		contractId: contractId("cancelled-contract"),
	});
	assert.equal(state.activeContracts.find((contract) => contract.id === contractId("cancelled-contract"))?.status, "cancelled");

	state = {
		...state,
		contractMarket: [
			{
				id: contractId("breached-contract-lifecycle"),
				name: "Breaches Then Expires",
				requirements: { vCpu: 32, ramGb: 64, storageTb: 0, gpuFlops: 0 },
				monthlyPayment: 30_000,
				penaltyPerMonth: 7_000,
				termMonths: 3,
				status: "offered",
				offeredAtTick: state.tick,
				expiresAtTick: state.tick + 6,
			},
		],
	};
	state = reduce(state, {
		type: "AcceptContract",
		contractId: contractId("breached-contract-lifecycle"),
		dcId,
	});
	state = reduce(state, {
		type: "RemoveRack",
		dcId,
		placementId: rackPlacementId("rack-lifecycle-c1"),
	});
	state = reduce(state, { type: "Tick" });

	const breachedContract = state.activeContracts.find((contract) => contract.id === contractId("breached-contract-lifecycle"));
	assert.equal(breachedContract?.assignedDcId, dcId);
	assert.equal(breachedContract?.status, "breached");
	assert.equal(state.player.reliability.recentOutcomes.at(-1)?.kind, "breached");
});

test("activity-aware power billing rises with active contracts and drops after contract completion", () => {
	let state = newGame(101, { startingCash: 1_000_000 });
	const dcId = datacenterId("dc-billing-lifecycle");
	const targetRegionId = regionId("us_east");

	state = reduce(state, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId,
		regionId: targetRegionId,
	});
	state = reduce(state, {
		type: "PlaceRack",
		dcId,
		specId: RACK_CATALOG.C1.id,
		row: 0,
		position: 0,
		placementId: rackPlacementId("rack-billing-c1"),
	});

	const region = state.map.regions.find((candidate) => candidate.id === targetRegionId)!;
	const datacenter = state.datacenters.find((candidate) => candidate.id === dcId)!;
	const idleOpex = tickOpex(datacenter, region, []).total;

	state = {
		...state,
		contractMarket: [
			{
				id: contractId("billing-lifecycle-contract"),
				name: "Billing Lifecycle Contract",
				requirements: { vCpu: 32, ramGb: 64, storageTb: 0, gpuFlops: 0 },
				monthlyPayment: 35_000,
				penaltyPerMonth: 6_000,
				termMonths: 1,
				status: "offered",
				offeredAtTick: state.tick,
				expiresAtTick: state.tick + 6,
			},
		],
	};
	state = reduce(state, {
		type: "AcceptContract",
		contractId: contractId("billing-lifecycle-contract"),
		dcId,
	});

	const activeDatacenter = state.datacenters.find((candidate) => candidate.id === dcId)!;
	const activeOpex = tickOpex(activeDatacenter, region, state.activeContracts).total;
	assert.ok(activeOpex > idleOpex);

	state = reduce(state, { type: "Tick" });
	const firstOpex = Math.abs(state.ledger.find((entry) => entry.type === "opex" && entry.tick === state.tick)!.amount);
	assert.equal(
		state.activeContracts.find((contract) => contract.id === contractId("billing-lifecycle-contract"))?.status,
		"expired",
	);

	state = reduce(state, { type: "Tick" });
	const secondOpex = Math.abs(state.ledger.find((entry) => entry.type === "opex" && entry.tick === state.tick)!.amount);
	assert.ok(secondOpex < firstOpex);
});

test("repairing racks reduce active billed draw and force remaining healthy racks to absorb load", () => {
	let state = newGame(202, { startingCash: 1_000_000 });
	const dcId = datacenterId("dc-repair-billing");

	state = reduce(state, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId,
		regionId: regionId("us_east"),
	});
	state = reduce(state, {
		type: "PlaceRack",
		dcId,
		specId: RACK_CATALOG.C1.id,
		row: 0,
		position: 0,
		placementId: rackPlacementId("rack-repair-1"),
	});
	state = reduce(state, {
		type: "PlaceRack",
		dcId,
		specId: RACK_CATALOG.C1.id,
		row: 0,
		position: 1,
		placementId: rackPlacementId("rack-repair-2"),
	});

	const datacenter = state.datacenters.find((candidate) => candidate.id === dcId)!;
	const demand = {
		vCpu: 200,
		ramGb: 0,
		storageTb: 0,
		gpuFlops: 0,
	};

	const healthySummary = datacenterRackPowerSummary(datacenter, demand);
	assert.equal(healthySummary.activeRackCount, 2);
	assert.equal(healthySummary.repairingRackCount, 0);

	const repairingDatacenter = {
		...datacenter,
		placements: [
			{ ...datacenter.placements[0]!, health: "repairing" as const, repairProgressDays: 0 },
			datacenter.placements[1]!,
		],
	};
	const repairingSummary = datacenterRackPowerSummary(repairingDatacenter, demand);

	assert.equal(repairingSummary.activeRackCount, 1);
	assert.equal(repairingSummary.repairingRackCount, 1);
	assert.ok(repairingSummary.activePowerKw < healthySummary.activePowerKw);
	assert.ok(repairingSummary.billedPowerKw < healthySummary.billedPowerKw);
	assert.ok(repairingSummary.idleBaselinePowerKw > 0);
});
