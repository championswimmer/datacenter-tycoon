import assert from "node:assert/strict";
import test from "node:test";

import {
	DATACENTER_CATALOG,
	RACK_CATALOG,
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

test("end-to-end scripted game remains profitable over 12 ticks", () => {
	let state = newGame(42);
	const initialCash = state.player.cash;
	const warehouseId = datacenterId("dc-warehouse-1");
	// Use Iowa — cheap power and staff, low tax — to ensure profitability
	const regionId = "iowa" as import("./types.js").RegionId;

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
					vCpu: 960,
					ramGb: 3_200,
					storageTb: 2_200,
					gpuFlops: 0,
				},
				monthlyPayment: 320_000,
				penaltyPerMonth: 90_000,
				termMonths: 12,
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

	for (let month = 0; month < 12; month += 1) {
		state = reduce(state, { type: "Tick" });
	}

	const contract = state.activeContracts.find((candidate) => candidate.id === contractId("warehouse-anchor-contract"));

	assert.ok(contract);
	assert.ok(contract.status === "active" || contract.status === "completed");
	assert.equal(state.tick, 12);
	assert.ok(state.player.cash > initialCash);
	assert.ok(state.ledger.some((entry) => entry.type === "revenue"));
	assert.equal(state.datacenters[0]?.spec.id, DATACENTER_CATALOG.warehouse.id);
	assert.equal(state.datacenters[0]?.placements.length, 6);
});

test("regional opex reflects location economics", () => {
	let state = newGame(42);
	const iowaId = regionId("iowa");
	const svId = regionId("silicon_valley");

	// Build identical garages in Iowa and Silicon Valley
	state = reduce(state, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId: datacenterId("dc-iowa"),
		regionId: iowaId,
	});
	state = reduce(state, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId: datacenterId("dc-sv"),
		regionId: svId,
	});

	const iowaDc = state.datacenters.find((d) => d.id === datacenterId("dc-iowa"))!;
	const svDc = state.datacenters.find((d) => d.id === datacenterId("dc-sv"))!;
	const iowaRegion = state.map.regions.find((r) => r.id === iowaId)!;
	const svRegion = state.map.regions.find((r) => r.id === svId)!;

	const iowaOpex = tickOpex(iowaDc, iowaRegion);
	const svOpex = tickOpex(svDc, svRegion);

	// Iowa should be cheaper than Silicon Valley for staff
	assert.ok(iowaOpex.breakdown.staff < svOpex.breakdown.staff);
	// Both have no power/cooling/maintenance with no racks
	assert.equal(iowaOpex.breakdown.power, 0);
	assert.equal(svOpex.breakdown.power, 0);
	assert.equal(iowaOpex.breakdown.cooling, 0);
	assert.equal(svOpex.breakdown.cooling, 0);
	assert.equal(iowaOpex.breakdown.maintenance, 0);
	assert.equal(svOpex.breakdown.maintenance, 0);
	// Iowa total should be much lower than SV
	assert.ok(iowaOpex.total < svOpex.total);

	// Verify staff cost matches region wage * garage staffCount (2)
	assert.equal(iowaOpex.breakdown.staff, iowaRegion.staffWage * 2);
	assert.equal(svOpex.breakdown.staff, svRegion.staffWage * 2);

	// Run a tick and verify ledger reflects combined costs
	state = reduce(state, { type: "Tick" });
	const opexEntry = state.ledger.find((e) => e.type === "opex");
	assert.ok(opexEntry);
	assert.equal(opexEntry.amount, -(iowaOpex.total + svOpex.total));
});

test("tax is applied on profitable datacenters and varies by region", () => {
	let state = newGame(42, { startingCash: 1_000_000 });
	const dcId = datacenterId("dc-test-1");
	const iowaId = regionId("iowa");

	state = reduce(state, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId,
		regionId: iowaId,
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

	const region = state.map.regions.find((r) => r.id === iowaId)!;
	const dc = state.datacenters.find((d) => d.id === dcId)!;
	const opexBeforeTick = tickOpex(dc, region);

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
