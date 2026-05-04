import assert from "node:assert/strict";
import test from "node:test";

import { DATACENTER_CATALOG } from "../catalog/datacenters.js";
import { RACK_CATALOG } from "../catalog/racks.js";
import { applyCapex, tickOpex, tickRevenue } from "../index.js";
import type {
	Contract,
	ContractId,
	Datacenter,
	DatacenterId,
	GameState,
	PlayerId,
	RackPlacement,
	RackPlacementId,
	Region,
	Tick,
} from "../types.js";

const contractId = (value: string): ContractId => value as ContractId;
const datacenterId = (value: string): DatacenterId => value as DatacenterId;
const playerId = (value: string): PlayerId => value as PlayerId;
const rackPlacementId = (value: string): RackPlacementId => value as RackPlacementId;
const tick = (value: number): Tick => value as Tick;

const TEST_REGION: Region = {
	id: "iowa" as import("../types.js").RegionId,
	name: "Test Region",
	powerCostPerKwh: 0.12,
	staffWage: 6_000,
	taxRate: 0.1,
	totalPowerAvailable: 10_000,
	totalStaffAvailable: 1_000,
	powerUsed: 0,
	staffUsed: 0,
};

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
	id: string,
	spec: (typeof DATACENTER_CATALOG)[keyof typeof DATACENTER_CATALOG],
	placements: RackPlacement[] = [],
): Datacenter {
	return {
		id: datacenterId(id),
		name: `${spec.name} ${id}`,
		spec,
		placements,
		builtAtTick: tick(0),
		regionId: "iowa" as import("../types.js").RegionId,
		maintenanceStaff: 0,
	};
}

function makeContract(
	id: string,
	datacenter: Datacenter,
	overrides: Partial<Contract> = {},
): Contract {
	return {
		id: contractId(id),
		name: `Contract ${id}`,
		requirements: {
			vCpu: 100,
			ramGb: 1_000,
			storageTb: 100,
			gpuFlops: 100,
		},
		monthlyPayment: 10_000,
		penaltyPerMonth: 2_500,
		termMonths: 12,
		status: "active",
		offeredAtTick: tick(0),
		expiresAtTick: tick(12),
		startedAtTick: tick(0),
		assignedDcId: datacenter.id,
		...overrides,
	};
}

function makeState(overrides: Partial<GameState> = {}): GameState {
	return {
		tick: tick(5),
		seed: 42,
		rngState: 42,
		player: {
			id: playerId("player-1"),
			name: "Player One",
			cash: 100_000,
		},
		datacenters: [],
		contractMarket: [],
		activeContracts: [],
		ledger: [],
		map: { regions: [TEST_REGION] },
		...overrides,
	};
}

test("applyCapex debits player cash and appends a ledger entry", () => {
	const state = makeState();
	const nextState = applyCapex(state, 35_000, "Bought C1 rack");

	assert.equal(nextState.player.cash, 65_000);
	assert.equal(nextState.ledger.length, 1);
	assert.deepEqual(nextState.ledger[0], {
		id: "ledger-5-0",
		tick: 5,
		type: "capex",
		amount: -35_000,
		reason: "Bought C1 rack",
	});
	assert.equal(state.ledger.length, 0);
});

test("applyCapex throws when funds are insufficient", () => {
	const state = makeState({
		player: {
			id: playerId("player-1"),
			name: "Player One",
			cash: 10_000,
		},
	});

	assert.throws(() => applyCapex(state, 25_000, "Bought warehouse datacenter"), {
		message: /Insufficient funds/,
	});
});

test("tickOpex charges staff and reserved bandwidth even for an empty datacenter", () => {
	const datacenter = makeDatacenter("garage-1", DATACENTER_CATALOG.garage);

	assert.deepEqual(tickOpex(datacenter, TEST_REGION), {
		total: 18_800,
		breakdown: {
			power: 0,
			cooling: 0,
			bandwidth: 6_800,
			staff: 12_000,
			maintenance: 0,
			tax: 0,
		},
	});
});

test("tickOpex includes power, cooling, staff, bandwidth, and rack maintenance", () => {
	const datacenter = makeDatacenter("warehouse-1", DATACENTER_CATALOG.warehouse, [
		placement("rack-1", "C2", 0, 0),
		placement("rack-2", "M1", 0, 1),
	]);

	assert.deepEqual(tickOpex(datacenter, TEST_REGION), {
		total: 85079.9,
		breakdown: {
			power: 946.08,
			cooling: 283.82,
			bandwidth: 34_000,
			staff: 48_000,
			maintenance: 1_850,
			tax: 0,
		},
	});
});

test("tickRevenue pays fulfilled contracts and recovers previously breached contracts", () => {
	const datacenter = makeDatacenter("warehouse-1", DATACENTER_CATALOG.warehouse, [
		placement("rack-1", "C2", 0, 0),
		placement("rack-2", "M2", 0, 1),
		placement("rack-3", "S2", 1, 0),
		placement("rack-4", "G1", 1, 1),
	]);

	const state = makeState({
		datacenters: [datacenter],
		activeContracts: [
			makeContract("contract-1", datacenter, {
				requirements: { vCpu: 200, ramGb: 2_000, storageTb: 500, gpuFlops: 200 },
				monthlyPayment: 10_000,
				penaltyPerMonth: 3_000,
				status: "active",
			}),
			makeContract("contract-2", datacenter, {
				requirements: { vCpu: 150, ramGb: 3_000, storageTb: 600, gpuFlops: 200 },
				monthlyPayment: 12_000,
				penaltyPerMonth: 4_000,
				status: "breached",
			}),
		],
	});

	assert.deepEqual(tickRevenue(state), {
		revenue: 22_000,
		perDcRevenue: { [datacenter.id]: 22_000 },
		updatedContracts: [
			{
				...state.activeContracts[0],
				status: "active",
			},
			{
				...state.activeContracts[1],
				status: "active",
			},
		],
	});
});

test("tickRevenue breaches all overcommitted contracts on the same datacenter", () => {
	const datacenter = makeDatacenter("warehouse-1", DATACENTER_CATALOG.warehouse, [
		placement("rack-1", "C2", 0, 0),
		placement("rack-2", "M2", 0, 1),
		placement("rack-3", "S2", 1, 0),
		placement("rack-4", "G1", 1, 1),
	]);

	const state = makeState({
		datacenters: [datacenter],
		activeContracts: [
			makeContract("contract-1", datacenter, {
				requirements: { vCpu: 200, ramGb: 2_000, storageTb: 500, gpuFlops: 200 },
				monthlyPayment: 10_000,
				penaltyPerMonth: 3_000,
			}),
			makeContract("contract-2", datacenter, {
				requirements: { vCpu: 150, ramGb: 3_000, storageTb: 600, gpuFlops: 200 },
				monthlyPayment: 12_000,
				penaltyPerMonth: 4_000,
			}),
			makeContract("contract-3", datacenter, {
				requirements: { vCpu: 100, ramGb: 2_000, storageTb: 300, gpuFlops: 200 },
				monthlyPayment: 15_000,
				penaltyPerMonth: 5_000,
			}),
		],
	});

	const result = tickRevenue(state);
	assert.equal(result.revenue, -12_000);
	assert.deepEqual(result.perDcRevenue, { [datacenter.id]: -12_000 });
	assert.deepEqual(
		result.updatedContracts.map((contract) => contract.status),
		["breached", "breached", "breached"],
	);
});
