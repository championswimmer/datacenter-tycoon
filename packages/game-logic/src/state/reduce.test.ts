import assert from "node:assert/strict";
import test from "node:test";

import { DATACENTER_CATALOG } from "../catalog/datacenters.js";
import { RACK_CATALOG } from "../catalog/racks.js";
import { MARKET_REFRESH_SIZE } from "../economy/constants.js";
import { tick as tickState } from "../sim/tick.js";
import type {
	Contract,
	ContractId,
	Datacenter,
	DatacenterId,
	DatacenterSpecId,
	RackPlacement,
	RackPlacementId,
	RackSpecId,
	Tick,
} from "../types.js";
import { newGame } from "./newGame.js";
import { reduce } from "./reduce.js";

const contractId = (value: string): ContractId => value as ContractId;
const datacenterId = (value: string): DatacenterId => value as DatacenterId;
const datacenterSpecId = (value: string): DatacenterSpecId => value as DatacenterSpecId;
const rackPlacementId = (value: string): RackPlacementId => value as RackPlacementId;
const rackSpecId = (value: string): RackSpecId => value as RackSpecId;
const tick = (value: number): Tick => value as Tick;

function placement(id: string, specKey: keyof typeof RACK_CATALOG, row: number, position: number): RackPlacement {
	const spec = RACK_CATALOG[specKey];
	return {
		id: rackPlacementId(id),
		specId: spec.id,
		kind: spec.kind,
		installedAtTick: tick(0),
		row,
		position,
	};
}

function makeDatacenter(id: string, placements: RackPlacement[] = []): Datacenter {
	return {
		id: datacenterId(id),
		name: `Garage ${id}`,
		spec: DATACENTER_CATALOG.garage,
		placements,
		builtAtTick: tick(0),
		regionId: "silicon_valley" as import("../types.js").RegionId,
	};
}

function makeContract(id: string, dcId: DatacenterId): Contract {
	return {
		id: contractId(id),
		name: `Contract ${id}`,
		requirements: {
			vCpu: 32,
			ramGb: 128,
			storageTb: 10,
			gpuFlops: 0,
		},
		monthlyPayment: 5_000,
		penaltyPerMonth: 2_000,
		termMonths: 3,
		status: "active",
		urgency: "standard",
		tier: 1,
		offeredAtTick: tick(0),
		expiresAtTick: tick(6),
		startedAtTick: tick(0),
		assignedDcId: dcId,
	};
}

test("reduce handles BuildDatacenter and validates spec ids", () => {
	const state = newGame(42, { startingCash: 3_000_000 });
	const firstRegionId = state.map.regions[0]!.id;

	const nextState = reduce(state, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId: datacenterId("dc-1"),
		regionId: firstRegionId,
	});

	assert.equal(nextState.datacenters.length, 1);
	assert.equal(nextState.datacenters[0]?.spec.id, DATACENTER_CATALOG.garage.id);
	assert.equal(nextState.player.cash, state.player.cash - DATACENTER_CATALOG.garage.capexCost);
	assert.equal(nextState.ledger.at(-1)?.type, "capex");
	assert.throws(
		() =>
			reduce(state, {
				type: "BuildDatacenter",
				specId: datacenterSpecId("missing"),
				dcId: datacenterId("dc-x"),
				regionId: firstRegionId,
			}),
		{ message: /Unknown datacenter spec/ },
	);
});

test("reduce handles PlaceRack and rejects invalid placement attempts", () => {
	const state = newGame(42, { startingCash: 3_000_000 });
	const firstRegionId = state.map.regions[0]!.id;
	const builtState = reduce(state, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId: datacenterId("dc-1"),
		regionId: firstRegionId,
	});

	const nextState = reduce(builtState, {
		type: "PlaceRack",
		dcId: datacenterId("dc-1"),
		specId: RACK_CATALOG.C1.id,
		row: 0,
		position: 0,
		placementId: rackPlacementId("rack-1"),
	});

	assert.equal(nextState.datacenters[0]?.placements.length, 1);
	assert.equal(nextState.datacenters[0]?.placements[0]?.specId, RACK_CATALOG.C1.id);
	assert.equal(nextState.player.cash, builtState.player.cash - RACK_CATALOG.C1.capexCost);
	assert.throws(
		() =>
			reduce(nextState, {
				type: "PlaceRack",
				dcId: datacenterId("dc-1"),
				specId: RACK_CATALOG.C1.id,
				row: 0,
				position: 0,
				placementId: rackPlacementId("rack-2"),
			}),
		{ message: /Cannot place rack: slot_taken/ },
	);
});

test("reduce handles RemoveRack and rejects missing placements", () => {
	const stateWithRack = {
		...newGame(42, { startingCash: 3_000_000 }),
		datacenters: [makeDatacenter("dc-1", [placement("rack-1", "C1", 0, 0)])],
	};

	const nextState = reduce(stateWithRack, {
		type: "RemoveRack",
		dcId: datacenterId("dc-1"),
		placementId: rackPlacementId("rack-1"),
	});

	assert.equal(nextState.datacenters[0]?.placements.length, 0);
	assert.throws(
		() =>
			reduce(stateWithRack, {
				type: "RemoveRack",
				dcId: datacenterId("dc-1"),
				placementId: rackPlacementId("missing-rack"),
			}),
		{ message: /Unknown rack placement/ },
	);
});

test("reduce handles AcceptContract and delegates validation", () => {
	const state = {
		...newGame(42, { startingCash: 3_000_000 }),
		datacenters: [makeDatacenter("dc-1")],
		contractMarket: [
			{
				id: contractId("offer-1"),
				name: "Offer 1",
				requirements: { vCpu: 16, ramGb: 64, storageTb: 5, gpuFlops: 0 },
				monthlyPayment: 1_000,
				penaltyPerMonth: 250,
				termMonths: 2,
				status: "offered",
				urgency: "standard",
				tier: 1,
				offeredAtTick: tick(0),
				expiresAtTick: tick(6),
			},
		],
	};

	const nextState = reduce(state, {
		type: "AcceptContract",
		contractId: contractId("offer-1"),
		dcId: datacenterId("dc-1"),
	});

	assert.equal(nextState.contractMarket.length, MARKET_REFRESH_SIZE);
	assert.equal(nextState.activeContracts[0]?.status, "active");
	assert.equal(nextState.activeContracts[0]?.assignedDcId, datacenterId("dc-1"));
	assert.throws(
		() =>
			reduce(state, {
				type: "AcceptContract",
				contractId: contractId("missing-contract"),
				dcId: datacenterId("dc-1"),
			}),
		{ message: /Unknown market contract/ },
	);
});

test("reduce handles CancelContract and rejects missing active contracts", () => {
	const activeContract = makeContract("contract-1", datacenterId("dc-1"));
	const state = {
		...newGame(42, { startingCash: 3_000_000 }),
		datacenters: [makeDatacenter("dc-1")],
		activeContracts: [activeContract],
	};

	const nextState = reduce(state, {
		type: "CancelContract",
		contractId: activeContract.id,
	});

	assert.equal(nextState.activeContracts[0]?.status, "cancelled");
	assert.throws(
		() =>
			reduce(state, {
				type: "CancelContract",
				contractId: contractId("missing-contract"),
			}),
		{ message: /Unknown active contract/ },
	);
});

test("reduce handles Tick by delegating to sim.tick", () => {
	const state = {
		...newGame(42, { startingCash: 3_000_000 }),
		datacenters: [makeDatacenter("dc-1", [placement("rack-1", "C1", 0, 0)])],
	};

	assert.deepEqual(reduce(state, { type: "Tick" }), tickState(state));
});
