import assert from "node:assert/strict";
import test from "node:test";

import {
	DATACENTER_CATALOG,
	RACK_CATALOG,
	newGame,
	reduce,
	type ContractId,
	type DatacenterId,
	type RackPlacementId,
} from "./index.js";

const datacenterId = (value: string): DatacenterId => value as DatacenterId;
const rackPlacementId = (value: string): RackPlacementId => value as RackPlacementId;
const contractId = (value: string): ContractId => value as ContractId;

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
