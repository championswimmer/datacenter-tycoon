import assert from "node:assert/strict";
import test from "node:test";

import { DATACENTER_CATALOG } from "../catalog/datacenters.js";
import { RACK_CATALOG } from "../catalog/racks.js";
import {
	canPlaceRack,
	datacenterCapacity,
	datacenterContractCapacitySummary,
	datacenterInstalledCapacity,
	datacenterMaintenanceSummary,
	datacenterRackPowerSummary,
	datacenterUsage,
	rackCapacity,
} from "../index.js";
import type {
	Contract,
	ContractId,
	Datacenter,
	DatacenterId,
	DatacenterSpec,
	RackPlacement,
	RackPlacementId,
	Tick,
} from "../types.js";

const contractId = (value: string): ContractId => value as ContractId;
const datacenterId = (value: string): DatacenterId => value as DatacenterId;
const rackPlacementId = (value: string): RackPlacementId => value as RackPlacementId;
const tick = (value: number): Tick => value as Tick;

function placement(id: string, specId: keyof typeof RACK_CATALOG, row: number, position: number): RackPlacement {
	const spec = RACK_CATALOG[specId];

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

function makeDatacenter(
	spec: DatacenterSpec,
	placements: RackPlacement[] = [],
	overrides: Partial<DatacenterSpec> = {},
): Datacenter {
	return {
		id: datacenterId(`${spec.id}-dc`),
		name: `${spec.name} Instance`,
		spec: {
			...spec,
			...overrides,
		},
		placements,
		builtAtTick: tick(0),
		regionId: "us_west" as import("../types.js").RegionId,
		maintenanceStaff: 0,
	};
}

function makeContract(id: string, dcId: DatacenterId, overrides: Partial<Contract> = {}): Contract {
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
		penaltyPerMonth: 1_500,
		termMonths: 6,
		status: "active",
		urgency: "standard",
		tier: 1,
		offeredAtTick: tick(0),
		expiresAtTick: tick(6),
		startedAtTick: tick(1),
		assignedDcId: dcId,
		...overrides,
	};
}

test("rackCapacity mirrors the capacity fields from a rack spec", () => {
	assert.deepEqual(rackCapacity(RACK_CATALOG.C2), {
		vCpu: 256,
		ramGb: 768,
		storageTb: 24,
		gpuFlops: 0,
	});

	assert.deepEqual(rackCapacity(RACK_CATALOG.G2), {
		vCpu: 96,
		ramGb: 1_536,
		storageTb: 32,
		gpuFlops: 1_100,
	});
});

test("datacenterUsage returns zeros for an empty datacenter", () => {
	const datacenter = makeDatacenter(DATACENTER_CATALOG.garage);

	assert.deepEqual(datacenterUsage(datacenter), {
		powerKw: 0,
		heatOutputBtuPerHr: 0,
		bandwidthGbps: 0,
		slotsUsed: 0,
	});
});

test("datacenterUsage sums placed rack power, heat, bandwidth, and slots", () => {
	const datacenter = makeDatacenter(DATACENTER_CATALOG.warehouse, [
		placement("rack-1", "C2", 0, 0),
		placement("rack-2", "M1", 0, 1),
		placement("rack-3", "S2", 1, 0),
	]);

	assert.deepEqual(datacenterUsage(datacenter), {
		powerKw: 16.6,
		heatOutputBtuPerHr: 56_639,
		bandwidthGbps: 36,
		slotsUsed: 3,
	});
});

test("datacenterCapacity aggregates the placed rack capacity", () => {
	const datacenter = makeDatacenter(DATACENTER_CATALOG.warehouse, [
		placement("rack-1", "C2", 0, 0),
		placement("rack-2", "M1", 0, 1),
		placement("rack-3", "G1", 1, 0),
	]);

	assert.deepEqual(datacenterCapacity(datacenter), {
		vCpu: 368,
		ramGb: 3_840,
		storageTb: 68,
		gpuFlops: 500,
	});
});

test("repairing racks reduce usable capacity without changing installed capacity or slot usage", () => {
	const datacenter = makeDatacenter(DATACENTER_CATALOG.warehouse, [
		placement("rack-1", "C2", 0, 0),
		{
			...placement("rack-2", "G1", 0, 1),
			health: "repairing",
			repairProgressDays: 15,
		},
	]);

	assert.deepEqual(datacenterCapacity(datacenter), {
		vCpu: 256,
		ramGb: 768,
		storageTb: 24,
		gpuFlops: 0,
	});
	assert.deepEqual(datacenterInstalledCapacity(datacenter), {
		vCpu: 320,
		ramGb: 1_792,
		storageTb: 48,
		gpuFlops: 500,
	});
	assert.equal(datacenterUsage(datacenter).slotsUsed, 2);
});

test("datacenterMaintenanceSummary reports rack counts and average age", () => {
	const datacenter = makeDatacenter(DATACENTER_CATALOG.warehouse, [
		placement("rack-1", "C2", 0, 0),
		{
			...placement("rack-2", "M1", 0, 1),
			installedAtTick: tick(3),
			health: "repairing",
			repairProgressDays: 10,
		},
	]);

	assert.deepEqual(datacenterMaintenanceSummary(datacenter, tick(9)), {
		totalRackCount: 2,
		healthyRackCount: 1,
		repairingRackCount: 1,
		averageRackAgeMonths: 7.5,
	});
});

test("datacenterContractCapacitySummary reports empty committed demand for an unused datacenter", () => {
	const datacenter = makeDatacenter(DATACENTER_CATALOG.garage, [placement("rack-1", "C1", 0, 0)]);

	assert.deepEqual(datacenterContractCapacitySummary(datacenter, []), {
		installed: { vCpu: 128, ramGb: 512, storageTb: 16, gpuFlops: 0 },
		usable: { vCpu: 128, ramGb: 512, storageTb: 16, gpuFlops: 0 },
		committed: { vCpu: 0, ramGb: 0, storageTb: 0, gpuFlops: 0 },
		available: { vCpu: 128, ramGb: 512, storageTb: 16, gpuFlops: 0 },
	});
});

test("datacenterContractCapacitySummary subtracts active and breached demand from usable capacity", () => {
	const datacenter = makeDatacenter(DATACENTER_CATALOG.warehouse, [
		placement("rack-1", "C2", 0, 0),
		placement("rack-2", "M2", 0, 1),
		placement("rack-3", "S2", 0, 2),
		placement("rack-4", "G1", 0, 3),
	]);

	const summary = datacenterContractCapacitySummary(datacenter, [
		makeContract("active-1", datacenter.id, {
			requirements: { vCpu: 128, ramGb: 2_048, storageTb: 200, gpuFlops: 100 },
		}),
		makeContract("breach-1", datacenter.id, {
			status: "breached",
			requirements: { vCpu: 64, ramGb: 512, storageTb: 50, gpuFlops: 0 },
		}),
		makeContract("elsewhere", datacenterId("dc-other"), {
			requirements: { vCpu: 999, ramGb: 999, storageTb: 999, gpuFlops: 999 },
		}),
		makeContract("cancelled", datacenter.id, {
			status: "cancelled",
			requirements: { vCpu: 999, ramGb: 999, storageTb: 999, gpuFlops: 999 },
		}),
	]);

	assert.deepEqual(summary, {
		installed: { vCpu: 416, ramGb: 6_272, storageTb: 1_276, gpuFlops: 500 },
		usable: { vCpu: 416, ramGb: 6_272, storageTb: 1_276, gpuFlops: 500 },
		committed: { vCpu: 192, ramGb: 2_560, storageTb: 250, gpuFlops: 100 },
		available: { vCpu: 224, ramGb: 3_712, storageTb: 1_026, gpuFlops: 400 },
	});
});

test("datacenterContractCapacitySummary floors negative availability at zero and tracks repairing racks", () => {
	const datacenter = makeDatacenter(DATACENTER_CATALOG.garage, [
		placement("rack-1", "C1", 0, 0),
		{
			...placement("rack-2", "G1", 0, 1),
			health: "repairing",
			repairProgressDays: 8,
		},
	]);

	const summary = datacenterContractCapacitySummary(datacenter, [
		makeContract("overbooked", datacenter.id, {
			requirements: { vCpu: 200, ramGb: 1_500, storageTb: 40, gpuFlops: 600 },
		}),
	]);

	assert.deepEqual(summary, {
		installed: { vCpu: 192, ramGb: 1_536, storageTb: 40, gpuFlops: 500 },
		usable: { vCpu: 128, ramGb: 512, storageTb: 16, gpuFlops: 0 },
		committed: { vCpu: 200, ramGb: 1_500, storageTb: 40, gpuFlops: 600 },
		available: { vCpu: 0, ramGb: 0, storageTb: 0, gpuFlops: 0 },
	});
});

test("canPlaceRack accepts a valid in-bounds placement within all datacenter budgets", () => {
	const datacenter = makeDatacenter(DATACENTER_CATALOG.warehouse, [placement("rack-1", "C2", 0, 0)]);

	assert.deepEqual(canPlaceRack(datacenter, RACK_CATALOG.M2, { row: 0, position: 1 }), { ok: true });
});

test("canPlaceRack rejects out-of-bounds positions", () => {
	const datacenter = makeDatacenter(DATACENTER_CATALOG.garage);

	assert.deepEqual(canPlaceRack(datacenter, RACK_CATALOG.C1, { row: -1, position: 0 }), {
		ok: false,
		reason: "out_of_bounds",
	});
	assert.deepEqual(canPlaceRack(datacenter, RACK_CATALOG.C1, { row: 0, position: 4 }), {
		ok: false,
		reason: "out_of_bounds",
	});
});

test("canPlaceRack rejects occupied slots", () => {
	const datacenter = makeDatacenter(DATACENTER_CATALOG.garage, [placement("rack-1", "C1", 1, 2)]);

	assert.deepEqual(canPlaceRack(datacenter, RACK_CATALOG.M1, { row: 1, position: 2 }), {
		ok: false,
		reason: "slot_taken",
	});
});

test("canPlaceRack rejects tier-3 racks in air-cooled datacenters", () => {
	const datacenter = makeDatacenter(DATACENTER_CATALOG.garage);

	assert.deepEqual(canPlaceRack(datacenter, RACK_CATALOG.C3, { row: 0, position: 0 }), {
		ok: false,
		reason: "cooling_type_mismatch",
	});
});

test("canPlaceRack rejects placements that exceed remaining power budget", () => {
	const datacenter = makeDatacenter(DATACENTER_CATALOG.warehouse, [
		placement("rack-1", "G2", 0, 0),
		placement("rack-2", "G2", 0, 1),
	], { powerCapacityKw: 30 });

	assert.deepEqual(canPlaceRack(datacenter, RACK_CATALOG.G2, { row: 0, position: 2 }), {
		ok: false,
		reason: "insufficient_power",
	});
});

test("placement still uses reserved full-draw power even when billed power is mostly idle baseline", () => {
	const datacenter = makeDatacenter(
		DATACENTER_CATALOG.garage,
		[placement("rack-1", "C2", 0, 0)],
		{ powerCapacityKw: RACK_CATALOG.C2.powerDrawKw + 0.1 },
	);

	const powerSummary = datacenterRackPowerSummary(datacenter, {
		vCpu: 0,
		ramGb: 0,
		storageTb: 0,
		gpuFlops: 0,
	});
	assert.ok(powerSummary.billedPowerKw < powerSummary.reservedPowerKw);

	assert.deepEqual(canPlaceRack(datacenter, RACK_CATALOG.C1, { row: 0, position: 1 }), {
		ok: false,
		reason: "insufficient_power",
	});
});

test("garage cooling rebalance allows more routine storage growth before hitting the thermal cap", () => {
	const garageWithFiveStorageRacks = makeDatacenter(DATACENTER_CATALOG.garage, [
		placement("rack-1", "S2", 0, 0),
		placement("rack-2", "S2", 0, 1),
		placement("rack-3", "S2", 0, 2),
		placement("rack-4", "S2", 0, 3),
		placement("rack-5", "S2", 1, 0),
	]);
	const garageWithSixStorageRacks = makeDatacenter(DATACENTER_CATALOG.garage, [
		...garageWithFiveStorageRacks.placements,
		placement("rack-6", "S2", 1, 1),
	]);

	assert.deepEqual(canPlaceRack(garageWithFiveStorageRacks, RACK_CATALOG.S2, { row: 1, position: 1 }), {
		ok: true,
	});
	assert.deepEqual(canPlaceRack(garageWithSixStorageRacks, RACK_CATALOG.S2, { row: 1, position: 2 }), {
		ok: false,
		reason: "insufficient_cooling",
	});
});

test("canPlaceRack rejects placements that exceed remaining cooling budget", () => {
	const datacenter = makeDatacenter(
		DATACENTER_CATALOG.hyperscale,
		[placement("rack-1", "C2", 0, 0), placement("rack-2", "C2", 0, 1)],
		{ coolingCapacityBtuPerHr: 60_000 },
	);

	assert.deepEqual(canPlaceRack(datacenter, RACK_CATALOG.C2, { row: 0, position: 2 }), {
		ok: false,
		reason: "insufficient_cooling",
	});
});

test("canPlaceRack rejects placements that exceed remaining bandwidth budget", () => {
	const datacenter = makeDatacenter(DATACENTER_CATALOG.warehouse, [
		placement("rack-1", "G2", 0, 0),
		placement("rack-2", "G2", 0, 1),
	], { bandwidthGbps: 70 });

	assert.deepEqual(canPlaceRack(datacenter, RACK_CATALOG.G2, { row: 0, position: 2 }), {
		ok: false,
		reason: "insufficient_bandwidth",
	});
});

test("canPlaceRack allows tier-3 racks in liquid-cooled datacenters when budgets permit", () => {
	const datacenter = makeDatacenter(DATACENTER_CATALOG.hyperscale, [placement("rack-1", "G2", 0, 0)]);

	assert.deepEqual(canPlaceRack(datacenter, RACK_CATALOG.C3, { row: 0, position: 1 }), { ok: true });
});
