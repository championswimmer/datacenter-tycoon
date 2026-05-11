import assert from "node:assert/strict";
import test from "node:test";

import { DATACENTER_CATALOG } from "../catalog/datacenters.js";
import { RACK_CATALOG } from "../catalog/racks.js";
import { COOLING_OVERHEAD_RATIO } from "./constants.js";
import { DIFFICULTY_CONFIG } from "../balance/difficulty.js";
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
	id: "us_east" as import("../types.js").RegionId,
	name: "Test Region",
	code: "IAD",
	city: "Ashburn",
	coordinates: { x: 26, y: 35 },
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
		regionId: "us_east" as import("../types.js").RegionId,
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
		difficulty: "hard",
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
			upgrades: 0,
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
		total: 84709.9,
		breakdown: {
			power: 946.08,
			cooling: 283.82,
			bandwidth: 34_000,
			staff: 48_000,
			maintenance: 1_480,
			upgrades: 0,
			tax: 0,
		},
	});
});

test("tickOpex charges idle-baseline power when no active workload is assigned", () => {
	const datacenter = makeDatacenter("warehouse-1", DATACENTER_CATALOG.warehouse, [
		placement("rack-1", "C2", 0, 0),
		placement("rack-2", "M1", 0, 1),
	]);

	assert.deepEqual(tickOpex(datacenter, TEST_REGION, []), {
		total: 83662.21,
		breakdown: {
			power: 140.16,
			cooling: 42.05,
			bandwidth: 34_000,
			staff: 48_000,
			maintenance: 1_480,
			upgrades: 0,
			tax: 0,
		},
	});
});

test("tickOpex charges full draw only for racks needed by assigned contract demand", () => {
	const datacenter = makeDatacenter("warehouse-1", DATACENTER_CATALOG.warehouse, [
		placement("rack-1", "C2", 0, 0),
		placement("rack-2", "M1", 0, 1),
	]);
	const computeOnlyContract = makeContract("contract-compute", datacenter, {
		requirements: {
			vCpu: 100,
			ramGb: 0,
			storageTb: 0,
			gpuFlops: 0,
		},
		assignedDcId: datacenter.id,
	});

	assert.deepEqual(tickOpex(datacenter, TEST_REGION, [computeOnlyContract]), {
		total: 84368.26,
		breakdown: {
			power: 683.28,
			cooling: 204.98,
			bandwidth: 34_000,
			staff: 48_000,
			maintenance: 1_480,
			upgrades: 0,
			tax: 0,
		},
	});
});

test("tickOpex charges additional wages for maintenance staffing", () => {
	const datacenter = {
		...makeDatacenter("garage-1", DATACENTER_CATALOG.garage),
		maintenanceStaff: 3,
	};

	assert.deepEqual(tickOpex(datacenter, TEST_REGION), {
		total: 33_200,
		breakdown: {
			power: 0,
			cooling: 0,
			bandwidth: 6_800,
			staff: 26_400,
			maintenance: 0,
			upgrades: 0,
			tax: 0,
		},
	});
});

test("tickOpex charges fixed upgrade upkeep and upgraded bandwidth from the effective infrastructure", () => {
	const datacenter: Datacenter = {
		...makeDatacenter("garage-upgraded", DATACENTER_CATALOG.garage),
		upgrades: {
			currentNodeByTrack: {
				cooling: "hybrid",
				networkType: "fiber",
				onsiteGeneration: "gen-1",
			},
		},
	};

	assert.deepEqual(tickOpex(datacenter, TEST_REGION), {
		total: 42_950,
		breakdown: {
			power: 0,
			cooling: 0,
			bandwidth: 27_200,
			staff: 12_000,
			maintenance: 0,
			upgrades: 3_750,
			tax: 0,
		},
	});
});

test("starter-tier racks are cheaper to buy and operate than tier-1 hardware", () => {
	for (const family of ["C", "M", "S", "G"] as const) {
		const starter = RACK_CATALOG[`${family}0`];
		const tierOne = RACK_CATALOG[`${family}1`];
		assert.ok(starter.capexCost < tierOne.capexCost);
		assert.ok(starter.monthlyMaintenance < tierOne.monthlyMaintenance);
	}

	const starterOpex = tickOpex(
		makeDatacenter("garage-starter", DATACENTER_CATALOG.garage, [placement("rack-c0", "C0", 0, 0)]),
		TEST_REGION,
	);
	const tierOneOpex = tickOpex(
		makeDatacenter("garage-tier-one", DATACENTER_CATALOG.garage, [placement("rack-c1", "C1", 0, 0)]),
		TEST_REGION,
	);

	assert.ok(starterOpex.breakdown.maintenance < tierOneOpex.breakdown.maintenance);
	assert.ok(starterOpex.total < tierOneOpex.total);
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
				lifecycleState: "serving",
				status: "active",
			},
			{
				...state.activeContracts[1],
				lifecycleState: "serving",
				status: "active",
			},
		],
	});
});

test("tickRevenue scales breach penalties by difficulty", () => {
	const datacenter = makeDatacenter("warehouse-1", DATACENTER_CATALOG.warehouse, [
		placement("rack-1", "C2", 0, 0),
		placement("rack-2", "M2", 0, 1),
		placement("rack-3", "S2", 1, 0),
		placement("rack-4", "G1", 1, 1),
	]);
	const breachedContracts = [
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
	];
	const hardRevenue = tickRevenue(
		makeState({
			difficulty: "hard",
			datacenters: [datacenter],
			activeContracts: breachedContracts,
		}),
	);
	const easyRevenue = tickRevenue(
		makeState({
			difficulty: "easy",
			datacenters: [datacenter],
			activeContracts: breachedContracts,
		}),
	);

	assert.equal(hardRevenue.revenue, -12_000);
	assert.equal(
		easyRevenue.revenue,
		-12_000 * DIFFICULTY_CONFIG.easy.breachPenaltyMultiplier,
	);
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

test("tickOpex keeps non-power cost components stable across active vs idle billing modes", () => {
	const datacenter = makeDatacenter("warehouse-1", DATACENTER_CATALOG.warehouse, [
		placement("rack-1", "C2", 0, 0),
		placement("rack-2", "M1", 0, 1),
	]);
	const contract = makeContract("contract-compute", datacenter, {
		requirements: {
			vCpu: 100,
			ramGb: 0,
			storageTb: 0,
			gpuFlops: 0,
		},
		assignedDcId: datacenter.id,
	});

	const idleOpex = tickOpex(datacenter, TEST_REGION, []);
	const activeOpex = tickOpex(datacenter, TEST_REGION, [contract]);

	assert.equal(idleOpex.breakdown.staff, activeOpex.breakdown.staff);
	assert.equal(idleOpex.breakdown.bandwidth, activeOpex.breakdown.bandwidth);
	assert.equal(idleOpex.breakdown.maintenance, activeOpex.breakdown.maintenance);
	assert.equal(idleOpex.breakdown.upgrades, activeOpex.breakdown.upgrades);
	assert.equal(idleOpex.breakdown.tax, activeOpex.breakdown.tax);
	assert.ok(idleOpex.breakdown.power < activeOpex.breakdown.power);
	assert.ok(idleOpex.breakdown.cooling < activeOpex.breakdown.cooling);
});

test("tickOpex cooling remains proportional to billed power under activity-aware billing", () => {
	const datacenter = makeDatacenter("warehouse-1", DATACENTER_CATALOG.warehouse, [
		placement("rack-1", "C2", 0, 0),
		placement("rack-2", "M1", 0, 1),
	]);
	const contract = makeContract("contract-compute", datacenter, {
		requirements: {
			vCpu: 100,
			ramGb: 0,
			storageTb: 0,
			gpuFlops: 0,
		},
		assignedDcId: datacenter.id,
	});

	const opex = tickOpex(datacenter, TEST_REGION, [contract]);
	const expectedCooling = Number((opex.breakdown.power * COOLING_OVERHEAD_RATIO).toFixed(2));
	assert.equal(opex.breakdown.cooling, expectedCooling);
});
