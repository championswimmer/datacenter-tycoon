import assert from "node:assert/strict";
import test from "node:test";

import { createDatacenterUpgradeProgress } from "../catalog/datacenter-upgrades.js";
import { DATACENTER_CATALOG } from "../catalog/datacenters.js";
import { RACK_CATALOG } from "../catalog/racks.js";
import { DEFAULT_MAINTENANCE_STAFF, MAX_MAINTENANCE_STAFF } from "../balance/maintenance.js";
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
import { canPlaceRack, resolveDatacenterInfrastructure, resolveDatacenterUpgradeState } from "../entities/datacenter.js";

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
		health: "healthy",
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
		regionId: "us_west" as import("../types.js").RegionId,
		maintenanceStaff: 0,
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
	assert.equal(nextState.datacenters[0]?.maintenanceStaff, DEFAULT_MAINTENANCE_STAFF);
	assert.deepEqual(nextState.datacenters[0]?.upgrades, createDatacenterUpgradeProgress(DATACENTER_CATALOG.garage.id));
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

test("reduce handles UpgradeDatacenter and debits capex for the validated next node", () => {
	const state = newGame(42, { startingCash: 3_000_000 });
	const firstRegionId = state.map.regions[0]!.id;
	const builtState = reduce(state, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId: datacenterId("dc-upgrade"),
		regionId: firstRegionId,
	});

	const upgradedState = reduce(builtState, {
		type: "UpgradeDatacenter",
		dcId: datacenterId("dc-upgrade"),
		trackId: "cooling",
		targetNodeId: "hybrid",
	});

	assert.equal(upgradedState.datacenters[0]?.upgrades?.currentNodeByTrack.cooling, "hybrid");
	assert.equal(
		upgradedState.player.cash,
		builtState.player.cash - 180_000,
	);
	assert.match(upgradedState.ledger.at(-1)?.reason ?? "", /Upgrade datacenter: Garage Datacenter Cooling loop/);
});

test("reduce rejects stale and non-immediate datacenter upgrade requests deterministically", () => {
	const state = newGame(42, { startingCash: 3_000_000 });
	const firstRegionId = state.map.regions[0]!.id;
	const builtState = reduce(state, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId: datacenterId("dc-upgrade-rules"),
		regionId: firstRegionId,
	});

	assert.throws(
		() =>
			reduce(builtState, {
				type: "UpgradeDatacenter",
				dcId: datacenterId("dc-upgrade-rules"),
				trackId: "networkType",
				targetNodeId: "fiber",
			}),
		{ message: /immediate next node 'cat8'/ },
	);

	const cat8State = reduce(builtState, {
		type: "UpgradeDatacenter",
		dcId: datacenterId("dc-upgrade-rules"),
		trackId: "networkType",
		targetNodeId: "cat8",
	});

	assert.throws(
		() =>
			reduce(cat8State, {
				type: "UpgradeDatacenter",
				dcId: datacenterId("dc-upgrade-rules"),
				trackId: "networkType",
				targetNodeId: "cat8",
			}),
		{ message: /already at node 'cat8'/ },
	);
	assert.throws(
		() =>
			reduce(
				reduce(cat8State, {
					type: "UpgradeDatacenter",
					dcId: datacenterId("dc-upgrade-rules"),
					trackId: "networkType",
					targetNodeId: "fiber",
				}),
				{
					type: "UpgradeDatacenter",
					dcId: datacenterId("dc-upgrade-rules"),
					trackId: "networkType",
					targetNodeId: "fiber",
				},
			),
		{ message: /already maxed/ },
	);
});

test("generator upgrades increase rack headroom without consuming additional regional grid reservations", () => {
	const state = newGame(42, { startingCash: 5_000_000 });
	const firstRegionId = state.map.regions[0]!.id;
	const builtState = reduce(state, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.warehouse.id,
		dcId: datacenterId("dc-generator"),
		regionId: firstRegionId,
	});
	const gridPowerBefore = builtState.map.regions.find((region) => region.id === firstRegionId)?.powerUsed;
	const baseInfrastructure = resolveDatacenterInfrastructure(builtState.datacenters[0]!);

	const upgradedState = reduce(builtState, {
		type: "UpgradeDatacenter",
		dcId: datacenterId("dc-generator"),
		trackId: "onsiteGeneration",
		targetNodeId: "gen-1",
	});
	const gridPowerAfter = upgradedState.map.regions.find((region) => region.id === firstRegionId)?.powerUsed;
	const upgradedInfrastructure = resolveDatacenterInfrastructure(upgradedState.datacenters[0]!);

	assert.equal(gridPowerAfter, gridPowerBefore);
	assert.equal(upgradedInfrastructure.gridImportCapacityKw, baseInfrastructure.gridImportCapacityKw);
	assert.equal(upgradedInfrastructure.onsiteGenerationCapacityKw, 80);
	assert.equal(upgradedInfrastructure.rackPowerCapacityKw, baseInfrastructure.rackPowerCapacityKw + 80);
});

test("garage and warehouse cooling upgrades progress monotonically and unlock tier-3 rack placement", () => {
	const state = newGame(42, { startingCash: 8_000_000 });
	const firstRegionId = state.map.regions[0]!.id;
	const secondRegionId = state.map.regions[1]!.id;
	const builtGarage = reduce(state, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId: datacenterId("dc-garage-cooling"),
		regionId: firstRegionId,
	});
	const builtWarehouse = reduce(builtGarage, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.warehouse.id,
		dcId: datacenterId("dc-warehouse-cooling"),
		regionId: secondRegionId,
	});

	const garageBefore = builtWarehouse.datacenters.find((dc) => dc.id === datacenterId("dc-garage-cooling"))!;
	const warehouseBefore = builtWarehouse.datacenters.find((dc) => dc.id === datacenterId("dc-warehouse-cooling"))!;
	assert.deepEqual(canPlaceRack(garageBefore, RACK_CATALOG.C3, { row: 0, position: 0 }), {
		ok: false,
		reason: "cooling_type_mismatch",
	});
	assert.deepEqual(canPlaceRack(warehouseBefore, RACK_CATALOG.C3, { row: 0, position: 0 }), {
		ok: false,
		reason: "cooling_type_mismatch",
	});

	const hybridGarageState = reduce(builtWarehouse, {
		type: "UpgradeDatacenter",
		dcId: datacenterId("dc-garage-cooling"),
		trackId: "cooling",
		targetNodeId: "hybrid",
	});
	const liquidWarehouseState = reduce(
		reduce(hybridGarageState, {
			type: "UpgradeDatacenter",
			dcId: datacenterId("dc-warehouse-cooling"),
			trackId: "cooling",
			targetNodeId: "hybrid",
		}),
		{
			type: "UpgradeDatacenter",
			dcId: datacenterId("dc-warehouse-cooling"),
			trackId: "cooling",
			targetNodeId: "liquid",
		},
	);

	const garageAfter = liquidWarehouseState.datacenters.find((dc) => dc.id === datacenterId("dc-garage-cooling"))!;
	const warehouseAfter = liquidWarehouseState.datacenters.find((dc) => dc.id === datacenterId("dc-warehouse-cooling"))!;
	assert.equal(resolveDatacenterInfrastructure(garageAfter).coolingType, "hybrid");
	assert.equal(resolveDatacenterInfrastructure(warehouseAfter).coolingType, "liquid");
	assert.equal(resolveDatacenterUpgradeState(garageAfter).tracks.find((track) => track.trackId === "cooling")?.maxNode.id, "hybrid");
	assert.deepEqual(canPlaceRack(garageAfter, RACK_CATALOG.C3, { row: 0, position: 0 }), { ok: true });
	assert.deepEqual(canPlaceRack(warehouseAfter, RACK_CATALOG.C3, { row: 0, position: 0 }), { ok: true });
});

test("garage network upgrades increase bandwidth monotonically and become fabric-eligible only at fiber", () => {
	const state = newGame(42, { startingCash: 4_000_000 });
	const firstRegionId = state.map.regions[0]!.id;
	const builtState = reduce(state, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId: datacenterId("dc-network"),
		regionId: firstRegionId,
	});
	const cat8State = reduce(builtState, {
		type: "UpgradeDatacenter",
		dcId: datacenterId("dc-network"),
		trackId: "networkType",
		targetNodeId: "cat8",
	});
	const fiberState = reduce(cat8State, {
		type: "UpgradeDatacenter",
		dcId: datacenterId("dc-network"),
		trackId: "networkType",
		targetNodeId: "fiber",
	});

	const builtDc = builtState.datacenters[0]!;
	const cat8Dc = cat8State.datacenters[0]!;
	const fiberDc = fiberState.datacenters[0]!;
	assert.equal(resolveDatacenterInfrastructure(builtDc).bandwidthGbps, 80);
	assert.equal(resolveDatacenterInfrastructure(cat8Dc).bandwidthGbps, 160);
	assert.equal(resolveDatacenterInfrastructure(fiberDc).bandwidthGbps, 320);
	assert.equal(resolveDatacenterUpgradeState(builtDc).fabricEligible, false);
	assert.equal(resolveDatacenterUpgradeState(cat8Dc).fabricEligible, false);
	assert.equal(resolveDatacenterUpgradeState(fiberDc).fabricEligible, true);
});

test("generator track caps are enforced for warehouse and hyperscale blueprints", () => {
	const state = newGame(42, { startingCash: 50_000_000 });
	const firstRegionId = state.map.regions[0]!.id;
	const secondRegionId = state.map.regions[1]!.id;
	const builtWarehouse = reduce(state, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.warehouse.id,
		dcId: datacenterId("dc-warehouse-gen"),
		regionId: firstRegionId,
	});
	const builtHyperscale = reduce(builtWarehouse, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.hyperscale.id,
		dcId: datacenterId("dc-hyperscale-gen"),
		regionId: secondRegionId,
	});

	const warehouseMaxed = reduce(
		reduce(builtHyperscale, {
			type: "UpgradeDatacenter",
			dcId: datacenterId("dc-warehouse-gen"),
			trackId: "onsiteGeneration",
			targetNodeId: "gen-1",
		}),
		{
			type: "UpgradeDatacenter",
			dcId: datacenterId("dc-warehouse-gen"),
			trackId: "onsiteGeneration",
			targetNodeId: "gen-2",
		},
	);
	const hyperscaleMaxed = reduce(
		reduce(
			reduce(
				reduce(warehouseMaxed, {
					type: "UpgradeDatacenter",
					dcId: datacenterId("dc-hyperscale-gen"),
					trackId: "onsiteGeneration",
					targetNodeId: "gen-1",
				}),
				{
					type: "UpgradeDatacenter",
					dcId: datacenterId("dc-hyperscale-gen"),
					trackId: "onsiteGeneration",
					targetNodeId: "gen-2",
				},
			),
			{
				type: "UpgradeDatacenter",
				dcId: datacenterId("dc-hyperscale-gen"),
				trackId: "onsiteGeneration",
				targetNodeId: "gen-3",
			},
		),
		{
			type: "UpgradeDatacenter",
			dcId: datacenterId("dc-hyperscale-gen"),
			trackId: "onsiteGeneration",
			targetNodeId: "gen-4",
		},
	);

	assert.equal(
		resolveDatacenterUpgradeState(hyperscaleMaxed.datacenters.find((dc) => dc.id === datacenterId("dc-warehouse-gen"))!)
			.tracks.find((track) => track.trackId === "onsiteGeneration")?.currentNode.id,
		"gen-2",
	);
	assert.equal(
		resolveDatacenterUpgradeState(hyperscaleMaxed.datacenters.find((dc) => dc.id === datacenterId("dc-hyperscale-gen"))!)
			.tracks.find((track) => track.trackId === "onsiteGeneration")?.currentNode.id,
		"gen-4",
	);
	assert.throws(
		() =>
			reduce(warehouseMaxed, {
				type: "UpgradeDatacenter",
				dcId: datacenterId("dc-warehouse-gen"),
				trackId: "onsiteGeneration",
				targetNodeId: "gen-2",
			}),
		{ message: /already maxed/ },
	);
	assert.throws(
		() =>
			reduce(hyperscaleMaxed, {
				type: "UpgradeDatacenter",
				dcId: datacenterId("dc-hyperscale-gen"),
				trackId: "onsiteGeneration",
				targetNodeId: "gen-4",
			}),
		{ message: /already maxed/ },
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

test("reduce can place starter-tier racks through the normal reducer flow", () => {
	const state = newGame(42, { startingCash: 3_000_000 });
	const firstRegionId = state.map.regions[0]!.id;
	const builtState = reduce(state, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId: datacenterId("dc-0"),
		regionId: firstRegionId,
	});

	const nextState = reduce(builtState, {
		type: "PlaceRack",
		dcId: datacenterId("dc-0"),
		specId: RACK_CATALOG.C0.id,
		row: 0,
		position: 0,
		placementId: rackPlacementId("rack-c0"),
	});

	assert.equal(nextState.datacenters[0]?.placements[0]?.specId, RACK_CATALOG.C0.id);
	assert.equal(nextState.datacenters[0]?.placements[0]?.kind, "compute");
	assert.equal(nextState.player.cash, builtState.player.cash - RACK_CATALOG.C0.capexCost);
});

test("reduce keeps placement power-cap checks strict even with no active demand", () => {
	const constrainedDatacenter: Datacenter = {
		...makeDatacenter("dc-1", [placement("rack-1", "C1", 0, 0)]),
		spec: {
			...DATACENTER_CATALOG.garage,
			powerCapacityKw: RACK_CATALOG.C1.powerDrawKw + 0.1,
		},
	};
	const state = {
		...newGame(42, { startingCash: 3_000_000 }),
		datacenters: [constrainedDatacenter],
	};

	assert.throws(
		() =>
			reduce(state, {
				type: "PlaceRack",
				dcId: datacenterId("dc-1"),
				specId: RACK_CATALOG.C1.id,
				row: 0,
				position: 1,
				placementId: rackPlacementId("rack-2"),
			}),
		{ message: /Cannot place rack: insufficient_power/ },
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
		datacenters: [makeDatacenter("dc-1", [placement("rack-1", "C1", 0, 0)])],
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

test("reduce rejects AcceptContract when the datacenter lacks current available capacity", () => {
	const state = {
		...newGame(42, { startingCash: 3_000_000 }),
		datacenters: [makeDatacenter("dc-1", [
			placement("rack-1", "C2", 0, 0),
			placement("rack-2", "M2", 0, 1),
			placement("rack-3", "S2", 0, 2),
			placement("rack-4", "G1", 0, 3),
		])],
		activeContracts: [
			{
				id: contractId("active-1"),
				name: "Active 1",
				requirements: { vCpu: 300, ramGb: 5_000, storageTb: 1_100, gpuFlops: 450 },
				monthlyPayment: 10_000,
				penaltyPerMonth: 2_500,
				termMonths: 6,
				status: "active",
				urgency: "standard",
				tier: 1,
				offeredAtTick: tick(0),
				expiresAtTick: tick(6),
				startedAtTick: tick(0),
				assignedDcId: datacenterId("dc-1"),
			},
		],
		contractMarket: [
			{
				id: contractId("offer-2"),
				name: "Offer 2",
				requirements: { vCpu: 130, ramGb: 1_500, storageTb: 200, gpuFlops: 60 },
				monthlyPayment: 2_000,
				penaltyPerMonth: 500,
				termMonths: 2,
				status: "offered",
				urgency: "standard",
				tier: 1,
				offeredAtTick: tick(0),
				expiresAtTick: tick(6),
			},
		],
	};

	assert.throws(
		() =>
			reduce(state, {
				type: "AcceptContract",
				contractId: contractId("offer-2"),
				dcId: datacenterId("dc-1"),
			}),
		(error: unknown) => {
			assert.ok(error instanceof Error);
			assert.equal(error.message, "Datacenter dc-1 lacks available capacity for this contract");
			assert.deepEqual((error as Error & { data?: unknown }).data, {
				code: "insufficient_capacity",
				dcId: datacenterId("dc-1"),
				required: { vCpu: 130, ramGb: 1_500, storageTb: 200, gpuFlops: 60 },
				available: { vCpu: 116, ramGb: 1_272, storageTb: 176, gpuFlops: 50 },
			});
			return true;
		},
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

test("reduce handles SetMaintenanceStaff increases and decreases regional staff usage", () => {
	const state = newGame(42, { startingCash: 3_000_000 });
	const firstRegionId = state.map.regions[0]!.id;
	const builtState = reduce(state, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId: datacenterId("dc-1"),
		regionId: firstRegionId,
	});

	const increasedState = reduce(builtState, {
		type: "SetMaintenanceStaff",
		dcId: datacenterId("dc-1"),
		maintenanceStaff: 3,
	});
	const decreasedState = reduce(increasedState, {
		type: "SetMaintenanceStaff",
		dcId: datacenterId("dc-1"),
		maintenanceStaff: 1,
	});

	assert.equal(increasedState.datacenters[0]?.maintenanceStaff, 3);
	assert.equal(
		increasedState.map.regions.find((region) => region.id === firstRegionId)?.staffUsed,
		builtState.map.regions.find((region) => region.id === firstRegionId)!.staffUsed + 3,
	);
	assert.equal(decreasedState.datacenters[0]?.maintenanceStaff, 1);
	assert.equal(
		decreasedState.map.regions.find((region) => region.id === firstRegionId)?.staffUsed,
		builtState.map.regions.find((region) => region.id === firstRegionId)!.staffUsed + 1,
	);
});

test("reduce handles SetMaintenanceStaff clamps out-of-range values", () => {
	const state = newGame(42, { startingCash: 3_000_000 });
	const firstRegionId = state.map.regions[0]!.id;
	const builtState = reduce(state, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId: datacenterId("dc-1"),
		regionId: firstRegionId,
	});

	const highClampedState = reduce(builtState, {
		type: "SetMaintenanceStaff",
		dcId: datacenterId("dc-1"),
		maintenanceStaff: MAX_MAINTENANCE_STAFF + 5,
	});
	const lowClampedState = reduce(highClampedState, {
		type: "SetMaintenanceStaff",
		dcId: datacenterId("dc-1"),
		maintenanceStaff: -5,
	});

	assert.equal(highClampedState.datacenters[0]?.maintenanceStaff, MAX_MAINTENANCE_STAFF);
	assert.equal(lowClampedState.datacenters[0]?.maintenanceStaff, 0);
});

test("reduce handles SetMaintenanceStaff rejects changes that exceed regional staff limits", () => {
	const builtState = reduce(newGame(42, { startingCash: 3_000_000 }), {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId: datacenterId("dc-1"),
		regionId: "us_west" as import("../types.js").RegionId,
	});
	const constrainedState = {
		...builtState,
		map: {
			...builtState.map,
			regions: builtState.map.regions.map((region) =>
				region.id === ("us_west" as import("../types.js").RegionId)
					? {
...region,
							totalStaffAvailable: region.staffUsed + 1,
						}
					: region,
			),
		},
	};

	assert.throws(
		() =>
			reduce(constrainedState, {
				type: "SetMaintenanceStaff",
				dcId: datacenterId("dc-1"),
				maintenanceStaff: 2,
			}),
		{ message: /Insufficient staff available in region/ },
	);
});

test("reduce handles Tick by delegating to sim.tick", () => {
	const state = {
		...newGame(42, { startingCash: 3_000_000 }),
		datacenters: [makeDatacenter("dc-1", [placement("rack-1", "C1", 0, 0)])],
	};

	assert.deepEqual(reduce(state, { type: "Tick" }), tickState(state));
});

test("reduce handles MoveRack for same-region move", () => {
	const state = newGame(42, { startingCash: 3_000_000 });
	const firstRegionId = state.map.regions[0]!.id;
	const builtState = reduce(state, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId: datacenterId("dc-1"),
		regionId: firstRegionId,
	});
	const secondDcState = reduce(builtState, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId: datacenterId("dc-2"),
		regionId: firstRegionId,
	});
	const placedState = reduce(secondDcState, {
		type: "PlaceRack",
		dcId: datacenterId("dc-1"),
		specId: RACK_CATALOG.C1.id,
		row: 0,
		position: 0,
		placementId: rackPlacementId("rack-1"),
	});

	const nextState = reduce(placedState, {
		type: "MoveRack",
		dcId: datacenterId("dc-1"),
		placementId: rackPlacementId("rack-1"),
		targetDcId: datacenterId("dc-2"),
		row: 0,
		position: 0,
	});

	assert.equal(nextState.datacenters[0]?.placements.length, 0);
	assert.equal(nextState.datacenters[1]?.placements.length, 1);
	assert.equal(nextState.datacenters[1]?.placements[0]?.specId, RACK_CATALOG.C1.id);
	assert.equal(nextState.datacenters[1]?.placements[0]?.row, 0);
	assert.equal(nextState.datacenters[1]?.placements[0]?.position, 0);
	assert.equal(nextState.ledger.at(-1)?.type, "capex");
	assert.ok(nextState.ledger.at(-1)?.reason.includes("Move rack"));
});

test("reduce handles MoveRack for cross-region move", () => {
	const state = newGame(42, { startingCash: 3_000_000 });
	const region1 = state.map.regions[0]!.id;
	const region2 = state.map.regions[1]?.id ?? region1;
	const builtState = reduce(state, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId: datacenterId("dc-1"),
		regionId: region1,
	});
	const secondDcState = reduce(builtState, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId: datacenterId("dc-2"),
		regionId: region2,
	});
	const placedState = reduce(secondDcState, {
		type: "PlaceRack",
		dcId: datacenterId("dc-1"),
		specId: RACK_CATALOG.C1.id,
		row: 0,
		position: 0,
		placementId: rackPlacementId("rack-1"),
	});

	const nextState = reduce(placedState, {
		type: "MoveRack",
		dcId: datacenterId("dc-1"),
		placementId: rackPlacementId("rack-1"),
		targetDcId: datacenterId("dc-2"),
		row: 0,
		position: 0,
	});

	assert.equal(nextState.datacenters[0]?.placements.length, 0);
	assert.equal(nextState.datacenters[1]?.placements.length, 1);
});

test("reduce handles MoveRack rejects insufficient funds", () => {
	const state = newGame(42, { startingCash: 3_000_000 });
	const firstRegionId = state.map.regions[0]!.id;
	const builtState = reduce(state, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId: datacenterId("dc-1"),
		regionId: firstRegionId,
	});
	const secondDcState = reduce(builtState, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId: datacenterId("dc-2"),
		regionId: firstRegionId,
	});
	const placedState = reduce(secondDcState, {
		type: "PlaceRack",
		dcId: datacenterId("dc-1"),
		specId: RACK_CATALOG.C1.id,
		row: 0,
		position: 0,
		placementId: rackPlacementId("rack-1"),
	});
	const brokeState = {
		...placedState,
		player: { ...placedState.player, cash: 0 },
	};

	assert.throws(
		() =>
			reduce(brokeState, {
				type: "MoveRack",
				dcId: datacenterId("dc-1"),
				placementId: rackPlacementId("rack-1"),
				targetDcId: datacenterId("dc-2"),
				row: 0,
				position: 0,
			}),
		{ message: /Insufficient funds/ },
	);
});

test("reduce handles MoveRack rejects invalid target slot", () => {
	const state = newGame(42, { startingCash: 3_000_000 });
	const firstRegionId = state.map.regions[0]!.id;
	const builtState = reduce(state, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId: datacenterId("dc-1"),
		regionId: firstRegionId,
	});
	const secondDcState = reduce(builtState, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId: datacenterId("dc-2"),
		regionId: firstRegionId,
	});
	const placedState = reduce(secondDcState, {
		type: "PlaceRack",
		dcId: datacenterId("dc-1"),
		specId: RACK_CATALOG.C1.id,
		row: 0,
		position: 0,
		placementId: rackPlacementId("rack-1"),
	});

	assert.throws(
		() =>
			reduce(placedState, {
				type: "MoveRack",
				dcId: datacenterId("dc-1"),
				placementId: rackPlacementId("rack-1"),
				targetDcId: datacenterId("dc-2"),
				row: 99,
				position: 99,
			}),
		(error: unknown) => {
			assert.match((error as Error).message, /Cannot place rack: out_of_bounds/);
			assert.deepEqual((error as Error & { data?: unknown }).data, {
				code: "out_of_bounds",
				dcId: "dc-2",
				rows: DATACENTER_CATALOG.garage.rows,
				positionsPerRow: DATACENTER_CATALOG.garage.positionsPerRow,
			});
			return true;
		},
	);
});

test("reduce handles MoveRack rejects missing placement", () => {
	const state = newGame(42, { startingCash: 3_000_000 });
	const firstRegionId = state.map.regions[0]!.id;
	const builtState = reduce(state, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId: datacenterId("dc-1"),
		regionId: firstRegionId,
	});
	const secondDcState = reduce(builtState, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId: datacenterId("dc-2"),
		regionId: firstRegionId,
	});

	assert.throws(
		() =>
			reduce(secondDcState, {
				type: "MoveRack",
				dcId: datacenterId("dc-1"),
				placementId: rackPlacementId("missing-rack"),
				targetDcId: datacenterId("dc-2"),
				row: 0,
				position: 0,
			}),
		{ message: /Unknown rack placement/ },
	);
});

test("reduce handles MoveRack rejects same datacenter", () => {
	const state = newGame(42, { startingCash: 3_000_000 });
	const firstRegionId = state.map.regions[0]!.id;
	const builtState = reduce(state, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId: datacenterId("dc-1"),
		regionId: firstRegionId,
	});
	const placedState = reduce(builtState, {
		type: "PlaceRack",
		dcId: datacenterId("dc-1"),
		specId: RACK_CATALOG.C1.id,
		row: 0,
		position: 0,
		placementId: rackPlacementId("rack-1"),
	});

	assert.throws(
		() =>
			reduce(placedState, {
				type: "MoveRack",
				dcId: datacenterId("dc-1"),
				placementId: rackPlacementId("rack-1"),
				targetDcId: datacenterId("dc-1"),
				row: 0,
				position: 1,
			}),
		{ message: /Cannot move rack to the same datacenter/ },
	);
});
