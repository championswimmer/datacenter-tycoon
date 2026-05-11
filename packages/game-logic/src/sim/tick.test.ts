import assert from "node:assert/strict";
import test from "node:test";

import { DATACENTER_CATALOG } from "../catalog/datacenters.js";
import { RACK_CATALOG } from "../catalog/racks.js";
import { RELIABILITY_BASELINE_SCORE, RELIABILITY_MARKET_OFFER_COUNT, reliabilityBandForScore } from "../balance/reliability.js";
import { MARKET_REFRESH_SIZE } from "../economy/constants.js";
import { tickOpex } from "../economy/opex.js";
import { tick } from "./tick.js";
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
const tickValue = (value: number): Tick => value as Tick;

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
		installedAtTick: tickValue(0),
		health: "healthy",
		row,
		position,
	};
}

function makeDatacenter(
	id: string,
	placements: RackPlacement[] = [
		placement("rack-1", "C2", 0, 0),
		placement("rack-2", "M2", 0, 1),
		placement("rack-3", "S2", 1, 0),
		placement("rack-4", "G1", 1, 1),
	],
): Datacenter {
	return {
		id: datacenterId(id),
		name: `Warehouse ${id}`,
		spec: DATACENTER_CATALOG.warehouse,
		placements,
		builtAtTick: tickValue(0),
		regionId: "us_east" as import("../types.js").RegionId,
		maintenanceStaff: 0,
	};
}

function makeContract(id: string, datacenter: Datacenter, overrides: Partial<Contract> = {}): Contract {
	return {
		id: contractId(id),
		name: `Contract ${id}`,
		requirements: {
			vCpu: 200,
			ramGb: 3_000,
			storageTb: 400,
			gpuFlops: 200,
		},
		monthlyPayment: 20_000,
		penaltyPerMonth: 8_000,
		termMonths: 6,
		status: "active",
		urgency: "standard",
		tier: 1,
		offeredAtTick: tickValue(0),
		expiresAtTick: tickValue(6),
		startedAtTick: tickValue(0),
		assignedDcId: datacenter.id,
		...overrides,
	};
}

function makeState(overrides: Partial<GameState> = {}): GameState {
	return {
		tick: tickValue(0),
		seed: 123,
		rngState: 123,
		difficulty: "hard",
		player: {
			id: playerId("player-1"),
			name: "Player One",
			cash: 500_000,
			reliability: {
				score: RELIABILITY_BASELINE_SCORE,
				recentOutcomes: [],
			},
		},
		datacenters: [],
		contractMarket: [],
		activeContracts: [],
		ledger: [],
		map: { regions: [TEST_REGION] },
		...overrides,
	};
}

test("tick advances time, applies opex and revenue, and refreshes the contract market", () => {
	const datacenter = makeDatacenter("dc-1");
	const contract = makeContract("contract-1", datacenter);
	const state = makeState({
		datacenters: [datacenter],
		activeContracts: [contract],
	});
	const opex = tickOpex(datacenter, TEST_REGION, state.activeContracts).total;

	const nextState = tick(state);

	assert.equal(nextState.tick, 1);
	assert.equal(nextState.player.cash, state.player.cash - opex + contract.monthlyPayment);
	assert.equal(nextState.activeContracts[0]?.status, "active");
	assert.equal(nextState.ledger.length, 2);
	assert.deepEqual(
		nextState.ledger.map((entry) => ({ tick: entry.tick, type: entry.type, amount: entry.amount })),
		[
			{ tick: 1, type: "opex", amount: -opex },
			{ tick: 1, type: "revenue", amount: contract.monthlyPayment },
		],
	);
	assert.equal(nextState.contractMarket.length, MARKET_REFRESH_SIZE);
	assert.equal(nextState.contractMarket[0]?.offeredAtTick, 1);
});

test("tick expires breached contracts when their term ends and records penalties", () => {
	const weakDatacenter = makeDatacenter("dc-1", [placement("rack-1", "C1", 0, 0)]);
	const expiringContract = makeContract("contract-1", weakDatacenter, {
		requirements: { vCpu: 200, ramGb: 3_000, storageTb: 400, gpuFlops: 200 },
		penaltyPerMonth: 6_000,
		termMonths: 1,
		startedAtTick: tickValue(0),
	});
	const state = makeState({
		tick: tickValue(0),
		datacenters: [weakDatacenter],
		activeContracts: [expiringContract],
	});
	const opex = tickOpex(weakDatacenter, TEST_REGION, state.activeContracts).total;

	const nextState = tick(state);

	assert.equal(nextState.activeContracts[0]?.status, "expired");
	assert.equal(nextState.player.cash, state.player.cash - opex - expiringContract.penaltyPerMonth);
	assert.deepEqual(
		nextState.ledger.map((entry) => ({ type: entry.type, amount: entry.amount })),
		[
			{ type: "opex", amount: -opex },
			{ type: "penalty", amount: -expiringContract.penaltyPerMonth },
		],
	);
});

test("tick is deterministic across multiple months for the same seed and starting state", () => {
	const datacenter = makeDatacenter("dc-1");
	const baseState = makeState({
		datacenters: [datacenter],
		activeContracts: [makeContract("contract-1", datacenter)],
	});

	let firstRun = baseState;
	let secondRun = baseState;

	for (let month = 0; month < 6; month += 1) {
		firstRun = tick(firstRun);
		secondRun = tick(secondRun);
	}

	assert.deepEqual(firstRun, secondRun);
	assert.equal(firstRun.tick, 6);
	assert.equal(firstRun.contractMarket.length, RELIABILITY_MARKET_OFFER_COUNT.platinum);
	assert.deepEqual(firstRun.player.reliability, secondRun.player.reliability);
});

test("tick keeps a previously breached contract breached while it remains live", () => {
	const weakDatacenter = makeDatacenter("dc-1", [placement("rack-1", "C1", 0, 0)]);
	const breachedContract = makeContract("contract-1", weakDatacenter, {
		status: "breached",
		requirements: { vCpu: 500, ramGb: 5_000, storageTb: 500, gpuFlops: 500 },
		penaltyPerMonth: 6_000,
		termMonths: 10,
		startedAtTick: tickValue(0),
	});
	const state = makeState({
		tick: tickValue(1),
		datacenters: [weakDatacenter],
		activeContracts: [breachedContract],
	});
	const opex = tickOpex(weakDatacenter, TEST_REGION, state.activeContracts).total;

	const nextState = tick(state);

	assert.equal(nextState.activeContracts[0]?.status, "breached");
	assert.equal(nextState.player.cash, state.player.cash - opex - breachedContract.penaltyPerMonth);
});

test("tick rolls deterministic late-life failures for healthy racks", () => {
	const agedDatacenter = makeDatacenter("dc-1", [
		{
			...placement("rack-1", "C1", 0, 0),
			installedAtTick: tickValue(0),
		},
	]);
	const state = makeState({
		tick: tickValue(59),
		rngState: 99,
		datacenters: [agedDatacenter],
	});

	const nextState = tick(state);
	const failedRack = nextState.datacenters[0]?.placements[0];

	assert.equal(failedRack?.health, "repairing");
	assert.equal(failedRack?.repairProgressDays, 0);
	assert.equal(failedRack?.lastFailureAtTick, 60);
	assert.notEqual(nextState.rngState, state.rngState);
});

test("higher maintenance staffing restores repairing racks in fewer ticks", () => {
	const repairingRack = {
		...placement("rack-1", "C1", 0, 0),
		health: "repairing" as const,
		repairProgressDays: 0,
		lastFailureAtTick: tickValue(1),
	};
	const lowStaffState = tick(
		makeState({
			tick: tickValue(1),
			datacenters: [
				{
					...makeDatacenter("dc-low", [repairingRack]),
					maintenanceStaff: 0,
				},
			],
		}),
	);
	const highStaffState = tick(
		makeState({
			tick: tickValue(1),
			datacenters: [
				{
					...makeDatacenter("dc-high", [repairingRack]),
					maintenanceStaff: 4,
				},
			],
		}),
	);

	assert.equal(lowStaffState.datacenters[0]?.placements[0]?.health, "repairing");
	assert.equal(highStaffState.datacenters[0]?.placements[0]?.health, "healthy");
});

test("a late-life rack failure can breach an overcommitted contract in the same tick", () => {
	const datacenter = makeDatacenter("dc-1", [
		{
			...placement("rack-1", "C1", 0, 0),
			installedAtTick: tickValue(0),
		},
	]);
	const contract = makeContract("contract-1", datacenter, {
		requirements: { vCpu: 64, ramGb: 128, storageTb: 8, gpuFlops: 0 },
		monthlyPayment: 5_000,
		penaltyPerMonth: 2_000,
		termMonths: 12,
		startedAtTick: tickValue(59),
	});
	const state = makeState({
		tick: tickValue(59),
		rngState: 99,
		datacenters: [datacenter],
		activeContracts: [contract],
	});
	const nextState = tick(state);
	const postFailureDatacenter = nextState.datacenters[0]!;
	const opex = tickOpex(postFailureDatacenter, TEST_REGION, state.activeContracts).total;

	assert.equal(nextState.datacenters[0]?.placements[0]?.health, "repairing");
	assert.equal(nextState.activeContracts[0]?.status, "breached");
	assert.equal(nextState.player.cash, state.player.cash - opex - contract.penaltyPerMonth);
	assert.deepEqual(
		nextState.ledger.map((entry) => ({ type: entry.type, amount: entry.amount })),
		[
			{ type: "opex", amount: -opex },
			{ type: "penalty", amount: -contract.penaltyPerMonth },
		],
	);
});

test("a repaired rack can restore contract revenue in the same tick", () => {
	const datacenter = {
		...makeDatacenter("dc-1", [
			{
				...placement("rack-1", "C1", 0, 0),
				health: "repairing" as const,
				repairProgressDays: 15,
				lastFailureAtTick: tickValue(1),
			},
		]),
		maintenanceStaff: 4,
	};
	const contract = makeContract("contract-1", datacenter, {
		requirements: { vCpu: 64, ramGb: 128, storageTb: 8, gpuFlops: 0 },
		monthlyPayment: 5_000,
		penaltyPerMonth: 2_000,
	});
	const repairedOpex = tickOpex(
		{
			...datacenter,
			placements: [
				{
					...datacenter.placements[0]!,
					health: "healthy",
				},
			],
		},
		TEST_REGION,
		[contract],
	).total;
	const state = makeState({
		tick: tickValue(1),
		datacenters: [datacenter],
		activeContracts: [contract],
	});

	const nextState = tick(state);

	assert.equal(nextState.datacenters[0]?.placements[0]?.health, "healthy");
	assert.equal(nextState.activeContracts[0]?.status, "active");
	assert.equal(nextState.player.cash, state.player.cash - repairedOpex + contract.monthlyPayment);
});

test("tick increases reliability and records fulfilled SLA outcomes for healthy months", () => {
	const datacenter = makeDatacenter("dc-1");
	const contract = makeContract("contract-1", datacenter, {
		requirements: { vCpu: 64, ramGb: 128, storageTb: 8, gpuFlops: 0 },
		monthlyPayment: 5_000,
		penaltyPerMonth: 2_000,
		termMonths: 12,
	});
	const state = makeState({
		datacenters: [datacenter],
		activeContracts: [contract],
	});

	const nextState = tick(state);

	assert.equal(nextState.player.reliability.score, 53);
	assert.equal(nextState.player.reliability.lastDelta, 3);
	assert.deepEqual(nextState.player.reliability.recentOutcomes, [
		{
			contractId: contract.id,
			contractName: contract.name,
			tick: 1,
			kind: "fulfilled",
		},
	]);
});

test("tick lowers reliability for repeated breached SLA months without auto-cancelling", () => {
	const weakDatacenter = makeDatacenter("dc-1", [placement("rack-1", "C1", 0, 0)]);
	const breachedContract = makeContract("contract-1", weakDatacenter, {
		requirements: { vCpu: 500, ramGb: 5_000, storageTb: 500, gpuFlops: 500 },
		penaltyPerMonth: 6_000,
		termMonths: 10,
	});
	const breachedState = makeState({
		datacenters: [weakDatacenter],
		activeContracts: [breachedContract],
	});

	const afterBreach = tick(breachedState);

	assert.equal(afterBreach.activeContracts[0]?.status, "breached");
	assert.equal(afterBreach.player.reliability.score, 42);
	assert.equal(afterBreach.player.reliability.lastDelta, -8);
	assert.equal(afterBreach.player.reliability.recentOutcomes.at(-1)?.kind, "breached");

	const afterSecondBreach = tick(afterBreach);

	assert.equal(afterSecondBreach.activeContracts[0]?.status, "breached");
	assert.equal(afterSecondBreach.player.reliability.score, 34);
	assert.equal(afterSecondBreach.player.reliability.lastDelta, -8);
	assert.equal(afterSecondBreach.player.reliability.recentOutcomes.at(-1)?.kind, "breached");
	assert.equal(reliabilityBandForScore(afterSecondBreach.player.reliability.score), "silver");
});

test("fulfilled streaks and clamp edges behave deterministically across repeated ticks", () => {
	const datacenter = makeDatacenter("dc-1");
	const weakDatacenter = makeDatacenter("dc-weak", [placement("rack-1", "C1", 0, 0)]);
	const contract = makeContract("contract-1", datacenter, {
		requirements: { vCpu: 0, ramGb: 0, storageTb: 0, gpuFlops: 0 },
		monthlyPayment: 5_000,
		penaltyPerMonth: 2_000,
		termMonths: 12,
	});
	let streakState = makeState({
		datacenters: [datacenter],
		activeContracts: [contract],
	});

	for (let month = 0; month < 7; month += 1) {
		streakState = tick(streakState);
	}

	assert.equal(streakState.player.reliability.score, 71);
	assert.equal(reliabilityBandForScore(streakState.player.reliability.score), "platinum");

	const baselinePlayer = makeState().player;
	const cappedHighState = tick({
		...makeState({
			datacenters: [datacenter],
			activeContracts: [contract],
		}),
		player: {
			...baselinePlayer,
			reliability: {
				score: 99,
				recentOutcomes: [],
			},
		},
	});
	assert.equal(cappedHighState.player.reliability.score, 100);

	const cappedLowState = tick({
		...makeState({
			datacenters: [weakDatacenter],
			activeContracts: [
				makeContract("contract-2", weakDatacenter, {
					status: "breached",
					requirements: { vCpu: 500, ramGb: 5_000, storageTb: 500, gpuFlops: 500 },
					penaltyPerMonth: 6_000,
					termMonths: 10,
				}),
			],
		}),
		player: {
			...baselinePlayer,
			reliability: {
				score: 4,
				recentOutcomes: [],
			},
		},
	});
	assert.equal(cappedLowState.player.reliability.score, 0);
});
