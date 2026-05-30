import assert from "node:assert/strict";
import test from "node:test";

import { DATACENTER_CATALOG } from "../catalog/datacenters.js";
import { RACK_CATALOG } from "../catalog/racks.js";
import { DAYS_PER_TICK } from "../balance/maintenance.js";
import { RELIABILITY_BASELINE_SCORE, RELIABILITY_MARKET_OFFER_COUNT, reliabilityBandForScore } from "../balance/reliability.js";
import { CONTRACT_BREACH_AUTO_CANCEL_MONTHS } from "../contracts/lifecycle.js";
import { MARKET_REFRESH_SIZE } from "../economy/constants.js";
import { tickOpex } from "../economy/opex.js";
import { createPerformanceFixture } from "../perf/fixtures.js";
import { advanceSubtick } from "./subtick.js";
import { settleMonthlyTick, tick } from "./tick.js";
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

function regionWithFabric(memberDcIds: DatacenterId[]): Region {
	return {
		...TEST_REGION,
		fabric: { memberDcIds },
	};
}

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
		slaTargetPercent: 90,
		currentSlaWindow: { sampledDays: 0, servedDays: 0, failedDays: 0 },
		lifecycleState: "serving",
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
		subtick: 0,
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

test("advanceSubtick increments the day counter without settling the month early", () => {
	const state = makeState();

	const nextState = advanceSubtick(state);

	assert.equal(nextState.tick, 0);
	assert.equal(nextState.subtick, 1);
	assert.deepEqual(nextState.ledger, state.ledger);
});

test("advanceSubtick rolls the month boundary into exactly one monthly settlement", () => {
	let state = makeState();

	for (let day = 0; day < DAYS_PER_TICK; day += 1) {
		state = advanceSubtick(state);
	}

	assert.equal(state.tick, 1);
	assert.equal(state.subtick, 0);
	assert.equal(state.contractMarket.length, MARKET_REFRESH_SIZE);
});

test("tick honors pooled regional fabric capacity during monthly contract settlement", () => {
	const dcA = makeDatacenter("dc-a", [placement("rack-a", "C1", 0, 0)]);
	const dcB = makeDatacenter("dc-b", [placement("rack-b", "C1", 0, 0)]);
	const contract = makeContract("contract-fabric", dcA, {
		requirements: { vCpu: 192, ramGb: 700, storageTb: 20, gpuFlops: 0 },
		monthlyPayment: 12_000,
		penaltyPerMonth: 4_000,
	});
	const state = makeState({
		datacenters: [dcA, dcB],
		activeContracts: [contract],
		map: { regions: [regionWithFabric([dcA.id, dcB.id])] },
	});

	const nextState = tick(state);

	assert.equal(nextState.activeContracts[0]?.status, "active");
	assert.ok(nextState.ledger.some((entry) => entry.type === "revenue" && entry.amount === contract.monthlyPayment));
	assert.equal(nextState.ledger.some((entry) => entry.type === "penalty"), false);
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
	assert.equal(nextState.player.reliability.recentOutcomes.at(-1)?.kind, "breached");
	assert.deepEqual(
		nextState.ledger.map((entry) => ({ type: entry.type, amount: entry.amount })),
		[
			{ type: "opex", amount: -opex },
			{ type: "penalty", amount: -expiringContract.penaltyPerMonth },
		],
	);
});

test("month-end SLA settlement tolerates short outages for 80/90 targets but breaches 95", () => {
	const datacenter = makeDatacenter("dc-1");
	const eighty = makeContract("contract-80", datacenter, {
		requirements: { vCpu: 64, ramGb: 128, storageTb: 8, gpuFlops: 0 },
		monthlyPayment: 4_000,
		penaltyPerMonth: 2_000,
		slaTargetPercent: 80,
		currentSlaWindow: { sampledDays: DAYS_PER_TICK, servedDays: DAYS_PER_TICK - 3, failedDays: 3 },
	});
	const ninety = makeContract("contract-90", datacenter, {
		requirements: { vCpu: 64, ramGb: 128, storageTb: 8, gpuFlops: 0 },
		monthlyPayment: 5_000,
		penaltyPerMonth: 2_000,
		slaTargetPercent: 90,
		currentSlaWindow: { sampledDays: DAYS_PER_TICK, servedDays: DAYS_PER_TICK - 3, failedDays: 3 },
	});
	const ninetyFive = makeContract("contract-95", datacenter, {
		requirements: { vCpu: 64, ramGb: 128, storageTb: 8, gpuFlops: 0 },
		monthlyPayment: 6_000,
		penaltyPerMonth: 3_000,
		slaTargetPercent: 95,
		currentSlaWindow: { sampledDays: DAYS_PER_TICK, servedDays: DAYS_PER_TICK - 3, failedDays: 3 },
	});
	const state = makeState({
		datacenters: [datacenter],
		activeContracts: [eighty, ninety, ninetyFive],
	});
	const opex = tickOpex(datacenter, TEST_REGION, state.activeContracts).total;

	const nextState = settleMonthlyTick(state);

	assert.equal(nextState.activeContracts.find((contract) => contract.id === eighty.id)?.status, "active");
	assert.equal(nextState.activeContracts.find((contract) => contract.id === ninety.id)?.status, "active");
	assert.equal(nextState.activeContracts.find((contract) => contract.id === ninetyFive.id)?.status, "breached");
	assert.deepEqual(nextState.activeContracts.find((contract) => contract.id === eighty.id)?.currentSlaWindow, { sampledDays: 0, servedDays: 0, failedDays: 0 });
	assert.deepEqual(nextState.activeContracts.find((contract) => contract.id === ninety.id)?.currentSlaWindow, { sampledDays: 0, servedDays: 0, failedDays: 0 });
	assert.deepEqual(nextState.activeContracts.find((contract) => contract.id === ninetyFive.id)?.currentSlaWindow, { sampledDays: 0, servedDays: 0, failedDays: 0 });
	assert.ok(Math.abs(nextState.player.cash - (state.player.cash - opex + eighty.monthlyPayment + ninety.monthlyPayment - ninetyFive.penaltyPerMonth)) < 1e-9);
	assert.deepEqual(
		nextState.player.reliability.recentOutcomes.map((outcome) => outcome.kind),
		["fulfilled", "fulfilled", "breached"],
	);
});

test("breached SLA months can auto-cancel after the configured streak while keeping a breached outcome", () => {
	const weakDatacenter = makeDatacenter("dc-1", [placement("rack-1", "C1", 0, 0)]);
	const contract = makeContract("contract-1", weakDatacenter, {
		requirements: { vCpu: 500, ramGb: 5_000, storageTb: 500, gpuFlops: 500 },
		penaltyPerMonth: 6_000,
		status: "breached",
		lifecycleState: "breached",
		breachStreakMonths: CONTRACT_BREACH_AUTO_CANCEL_MONTHS - 1,
		currentSlaWindow: { sampledDays: DAYS_PER_TICK, servedDays: 0, failedDays: DAYS_PER_TICK },
	});
	const state = makeState({
		tick: tickValue(1),
		datacenters: [weakDatacenter],
		activeContracts: [contract],
	});

	const nextState = settleMonthlyTick(state);

	assert.equal(nextState.activeContracts[0]?.status, "cancelled");
	assert.equal(nextState.activeContracts[0]?.closedAtTick, 2);
	assert.equal(nextState.player.reliability.recentOutcomes.at(-1)?.kind, "breached");
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

test("tick rolls deterministic late-life failures and can recover them before month end", () => {
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

	assert.equal(failedRack?.health, "healthy");
	assert.equal("repairProgressDays" in (failedRack ?? {}), false);
	assert.equal(failedRack?.lastFailureAtTick, 59);
	assert.ok(failedRack?.lastFailureAtSubtick !== undefined);
	assert.notEqual(nextState.rngState, state.rngState);
});

test("daily failure rolls land on the same subtick for identical seed histories", () => {
	const agedDatacenter = makeDatacenter("dc-1", [
		{
			...placement("rack-1", "C1", 0, 0),
			installedAtTick: tickValue(0),
		},
	]);
	const initial = makeState({
		tick: tickValue(59),
		rngState: 99,
		datacenters: [agedDatacenter],
	});
	let first = initial;
	let second = initial;

	for (let day = 0; day < DAYS_PER_TICK; day += 1) {
		if (first.datacenters[0]?.placements[0]?.health === "repairing") {
			break;
		}
		first = advanceSubtick(first);
		second = advanceSubtick(second);
	}

	const firstRack = first.datacenters[0]?.placements[0];
	const secondRack = second.datacenters[0]?.placements[0];
	assert.equal(firstRack?.health, "repairing");
	assert.equal(secondRack?.health, "repairing");
	assert.equal(firstRack?.lastFailureAtTick, secondRack?.lastFailureAtTick);
	assert.equal(firstRack?.lastFailureAtSubtick, secondRack?.lastFailureAtSubtick);
	assert.deepEqual(first, second);
});

test("higher maintenance staffing restores repairing racks in fewer subticks", () => {
	const repairingRack = {
		...placement("rack-1", "C1", 0, 0),
		health: "repairing" as const,
		repairProgressDays: 0,
		lastFailureAtTick: tickValue(1),
	};
	let lowStaffState = makeState({
		tick: tickValue(1),
		datacenters: [
			{
				...makeDatacenter("dc-low", [repairingRack]),
				maintenanceStaff: 0,
			},
		],
	});
	let highStaffState = makeState({
		tick: tickValue(1),
		datacenters: [
			{
				...makeDatacenter("dc-high", [repairingRack]),
				maintenanceStaff: 4,
			},
		],
	});

	for (let day = 0; day < 2; day += 1) {
		lowStaffState = advanceSubtick(lowStaffState);
		highStaffState = advanceSubtick(highStaffState);
	}

	assert.equal(lowStaffState.datacenters[0]?.placements[0]?.health, "repairing");
	assert.equal(highStaffState.datacenters[0]?.placements[0]?.health, "healthy");
	lowStaffState = advanceSubtick(lowStaffState);
	assert.equal(lowStaffState.datacenters[0]?.placements[0]?.health, "healthy");
});

test("repairing racks do not roll a second failure while already down", () => {
	const state = makeState({
		tick: tickValue(59),
		rngState: 99,
		datacenters: [
			{
				...makeDatacenter("dc-1", [
					{
						...placement("rack-1", "C1", 0, 0),
						health: "repairing" as const,
						repairProgressDays: 0,
						lastFailureAtTick: tickValue(58),
						lastFailureAtSubtick: 12,
					},
				]),
			},
		],
	});

	const nextState = advanceSubtick(state);
	const rack = nextState.datacenters[0]?.placements[0];
	assert.equal(rack?.health, "repairing");
	assert.equal(rack?.lastFailureAtTick, 58);
	assert.equal(rack?.lastFailureAtSubtick, 12);
});

test("a short late-life outage can recover before month-end settlement", () => {
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
	const settledDatacenter = nextState.datacenters[0]!;
	const opex = tickOpex(settledDatacenter, TEST_REGION, state.activeContracts).total;

	assert.equal(nextState.datacenters[0]?.placements[0]?.health, "healthy");
	assert.equal(nextState.activeContracts[0]?.status, "active");
	assert.equal(nextState.player.cash, state.player.cash - opex + contract.monthlyPayment);
	assert.deepEqual(
		nextState.ledger.map((entry) => ({ type: entry.type, amount: entry.amount })),
		[
			{ type: "opex", amount: -opex },
			{ type: "revenue", amount: contract.monthlyPayment },
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

test("tick from mid-month advances remaining subticks and settles exactly one month", () => {
	const start = makeState({ subtick: 5 });
	let advancedBySubticks = start;
	for (let day = start.subtick; day < DAYS_PER_TICK; day += 1) {
		advancedBySubticks = advanceSubtick(advancedBySubticks);
	}

	const viaTick = tick(start);

	assert.deepEqual(viaTick, advancedBySubticks);
	assert.equal(viaTick.tick, start.tick + 1);
	assert.equal(viaTick.subtick, 0);
});

test("tick matches day-by-day subtick progression for a seeded medium performance fixture", () => {
	const fixture = createPerformanceFixture("medium", { seed: 20260518 });
	let viaSubticks = fixture.state;
	for (let day = fixture.state.subtick; day < DAYS_PER_TICK; day += 1) {
		viaSubticks = advanceSubtick(viaSubticks);
	}

	const viaTick = tick(fixture.state);

	assert.deepEqual(viaTick, viaSubticks);
	assert.equal(viaTick.tick, fixture.state.tick + 1);
	assert.equal(viaTick.subtick, 0);
});

test("stress fixture tick keeps ledger ids, reliability, and repair transitions deterministic", () => {
	const fixture = createPerformanceFixture("stress", { seed: 20260518 });
	const first = tick(fixture.state);
	const second = tick(fixture.state);
	const newLedgerEntries = first.ledger.slice(fixture.state.ledger.length);
	const firstRepairSnapshot = first.datacenters.flatMap((datacenter) =>
		datacenter.placements.map((placement) => ({
			dcId: datacenter.id,
			placementId: placement.id,
			health: placement.health,
			repairProgressDays: placement.repairProgressDays,
			lastFailureAtTick: placement.lastFailureAtTick,
			lastFailureAtSubtick: placement.lastFailureAtSubtick,
		})),
	);
	const secondRepairSnapshot = second.datacenters.flatMap((datacenter) =>
		datacenter.placements.map((placement) => ({
			dcId: datacenter.id,
			placementId: placement.id,
			health: placement.health,
			repairProgressDays: placement.repairProgressDays,
			lastFailureAtTick: placement.lastFailureAtTick,
			lastFailureAtSubtick: placement.lastFailureAtSubtick,
		})),
	);

	assert.deepEqual(first, second);
	assert.ok(newLedgerEntries.length > 0);
	assert.ok(newLedgerEntries.every((entry) => entry.tick === first.tick));
	assert.deepEqual(
		newLedgerEntries.map((entry) => entry.id),
		second.ledger.slice(fixture.state.ledger.length).map((entry) => entry.id),
	);
	assert.deepEqual(first.player.reliability, second.player.reliability);
	assert.deepEqual(firstRepairSnapshot, secondRepairSnapshot);
	assert.ok(first.contracts.every((contract) => contract.lifecycleState !== "market_open" || contract.offeredAtTick <= first.tick));
	assert.ok(first.contracts.every((contract) => contract.closedAtTick === undefined || contract.closedAtTick <= first.tick));
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
