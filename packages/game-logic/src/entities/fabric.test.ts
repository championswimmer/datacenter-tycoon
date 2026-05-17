import assert from "node:assert/strict";
import test from "node:test";

import { DATACENTER_CATALOG } from "../catalog/datacenters.js";
import { RACK_CATALOG } from "../catalog/racks.js";
import type {
	Contract,
	ContractId,
	Datacenter,
	DatacenterId,
	GameState,
	RackPlacement,
	RackPlacementId,
	Region,
	RegionId,
	Tick,
} from "../types.js";
import {
	resolveDatacenterCapacityPoolMemberIds,
	summarizeAllDatacenterFabricCapacities,
	summarizeDistinctCapacityPools,
	summarizeFabricCapacityForDatacenter,
} from "./fabric.js";

const contractId = (value: string): ContractId => value as ContractId;
const datacenterId = (value: string): DatacenterId => value as DatacenterId;
const rackPlacementId = (value: string): RackPlacementId => value as RackPlacementId;
const regionId = (value: string): RegionId => value as RegionId;
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

function makeDatacenter(id: string, region: RegionId, placements: RackPlacement[]): Datacenter {
	return {
		id: datacenterId(id),
		name: id,
		spec: DATACENTER_CATALOG.garage,
		placements,
		builtAtTick: tick(0),
		regionId: region,
		maintenanceStaff: 0,
	};
}

function makeContract(id: string, dcId: DatacenterId, overrides: Partial<Contract> = {}): Contract {
	return {
		id: contractId(id),
		name: id,
		requirements: { vCpu: 64, ramGb: 128, storageTb: 4, gpuFlops: 0 },
		monthlyPayment: 10_000,
		penaltyPerMonth: 2_000,
		termMonths: 6,
		lifecycleState: "serving",
		status: "active",
		urgency: "standard",
		tier: 1,
		offeredAtTick: tick(0),
		expiresAtTick: tick(6),
		startedAtTick: tick(0),
		assignedDcId: dcId,
		...overrides,
	};
}

function makeRegion(id: RegionId, memberDcIds: DatacenterId[] = []): Region {
	return {
		id,
		name: id,
		code: id.toUpperCase(),
		city: `${id} City`,
		coordinates: { x: 0, y: 0 },
		powerCostPerKwh: 0.1,
		staffWage: 1_000,
		taxRate: 0.1,
		totalPowerAvailable: 100,
		totalStaffAvailable: 5,
		powerUsed: 0,
		staffUsed: 0,
		fabric: { memberDcIds },
	};
}

function makeState(overrides: Partial<Pick<GameState, "datacenters" | "map" | "contracts" | "contractMarket" | "activeContracts">> = {}) {
	return {
		datacenters: [],
		contracts: [],
		contractMarket: [],
		activeContracts: [],
		map: { regions: [] as Region[] },
		...overrides,
	};
}

test("summarizeFabricCapacityForDatacenter pools linked member capacity and keeps local capacity visible", () => {
	const regionA = regionId("region-a");
	const dcA = makeDatacenter("dc-a", regionA, [placement("rack-a", "C1", 0, 0)]);
	const dcB = makeDatacenter("dc-b", regionA, [placement("rack-b", "C1", 0, 0)]);
	const state = makeState({
		datacenters: [dcA, dcB],
		activeContracts: [makeContract("live-1", dcA.id)],
		map: { regions: [makeRegion(regionA, [dcA.id, dcB.id])] },
	});

	const summary = summarizeFabricCapacityForDatacenter(state, dcA.id);
	const allSummaries = summarizeAllDatacenterFabricCapacities(state);

	assert.equal(summary.connected, true);
	assert.deepEqual(summary.memberDcIds, [dcA.id, dcB.id]);
	assert.deepEqual(summary.local.available, { vCpu: 64, ramGb: 384, storageTb: 12, gpuFlops: 0 });
	assert.deepEqual(summary.usable, { vCpu: 256, ramGb: 1024, storageTb: 32, gpuFlops: 0 });
	assert.deepEqual(summary.available, { vCpu: 192, ramGb: 896, storageTb: 28, gpuFlops: 0 });
	assert.equal(allSummaries.length, 2);
	assert.deepEqual(allSummaries.map((entry) => entry.memberDcIds), [[dcA.id, dcB.id], [dcA.id, dcB.id]]);
	assert.deepEqual(allSummaries.find((entry) => entry.dcId === dcB.id)?.available, summary.available);
});

test("summarizeFabricCapacityForDatacenter leaves isolated sites independent and distinct pools are deduped", () => {
	const regionA = regionId("region-a");
	const regionB = regionId("region-b");
	const dcA = makeDatacenter("dc-a", regionA, [placement("rack-a", "C1", 0, 0)]);
	const dcB = makeDatacenter("dc-b", regionA, [placement("rack-b", "C1", 0, 0)]);
	const dcC = makeDatacenter("dc-c", regionB, [placement("rack-c", "C1", 0, 0)]);
	const state = makeState({
		datacenters: [dcA, dcB, dcC],
		map: {
			regions: [makeRegion(regionA, [dcA.id, dcB.id]), makeRegion(regionB)],
		},
	});

	const isolated = summarizeFabricCapacityForDatacenter(state, dcC.id);
	const pools = summarizeDistinctCapacityPools(state);

	assert.equal(isolated.connected, false);
	assert.deepEqual(isolated.memberDcIds, [dcC.id]);
	assert.deepEqual(isolated.available, { vCpu: 128, ramGb: 512, storageTb: 16, gpuFlops: 0 });
	assert.equal(pools.length, 2);
	assert.deepEqual(pools.map((pool) => pool.memberDcIds), [[dcA.id, dcB.id], [dcC.id]]);
});

test("resolveDatacenterCapacityPoolMemberIds falls back to local membership when the region is missing", () => {
	const dc = makeDatacenter("dc-orphan", regionId("missing-region"), [placement("rack-a", "C1", 0, 0)]);
	const state = makeState({ datacenters: [dc], map: { regions: [] } });

	assert.deepEqual(resolveDatacenterCapacityPoolMemberIds(state, dc.id), [dc.id]);
});
