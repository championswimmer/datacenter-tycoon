import assert from "node:assert/strict";
import test from "node:test";

import { DATACENTER_CATALOG } from "../catalog/datacenters.js";
import { RACK_CATALOG } from "../catalog/racks.js";
import { DAYS_PER_TICK } from "../balance/maintenance.js";
import { MARKET_REFRESH_SIZE } from "../economy/constants.js";
import { tickOpex } from "../economy/opex.js";
import { withDerivedContractViews } from "../contracts/lifecycle.js";
import { advanceSubtick } from "./subtick.js";
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
	id: "us_east" as Region["id"],
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
	fabric: { memberDcIds: [] },
};

function placement(id: string, specId: keyof typeof RACK_CATALOG, row = 0, position = 0): RackPlacement {
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

function makeDatacenter(id: string, placements: RackPlacement[] = [placement("rack-1", "C1")]): Datacenter {
	return {
		id: datacenterId(id),
		name: `Datacenter ${id}`,
		spec: DATACENTER_CATALOG.garage,
		placements,
		builtAtTick: tickValue(0),
		regionId: TEST_REGION.id,
		maintenanceStaff: 0,
	};
}

function makeContract(id: string, datacenter: Datacenter, overrides: Partial<Contract> = {}): Contract {
	return {
		id: contractId(id),
		name: `Contract ${id}`,
		requirements: { vCpu: 64, ramGb: 128, storageTb: 8, gpuFlops: 0 },
		monthlyPayment: 5_000,
		penaltyPerMonth: 2_000,
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
		acceptedAtTick: tickValue(0),
		assignedDcId: datacenter.id,
		...overrides,
	};
}

function makeState(overrides: Partial<GameState> = {}): GameState {
	return withDerivedContractViews({
		gameId: "game-1" as GameState["gameId"],
		game: { speed: 1, paused: false },
		tick: tickValue(0),
		subtick: 0,
		seed: 123,
		rngState: 123,
		difficulty: "hard",
		player: {
			id: playerId("player-1"),
			name: "Player One",
			cash: 500_000,
			reliability: { score: 50, recentOutcomes: [] },
		},
		datacenters: [],
		contracts: [],
		contractMarket: [],
		activeContracts: [],
		ledger: [],
		audioEnabled: true,
		audioSettings: { master: true, music: true, sfx: true, money: true, ambient: true },
		map: { regions: [TEST_REGION] },
		...overrides,
	});
}

test("30 subticks from month start equal one compatible Tick for month-level outcomes", () => {
	const datacenter = makeDatacenter("dc-1");
	const contract = makeContract("contract-1", datacenter);
	const start = makeState({
		datacenters: [datacenter],
		contracts: [contract],
		activeContracts: [contract],
	});

	let viaSubticks = start;
	for (let day = 0; day < DAYS_PER_TICK; day += 1) {
		viaSubticks = advanceSubtick(viaSubticks);
	}
	const viaTick = tick(start);

	assert.deepEqual(viaSubticks, viaTick);
	assert.equal(viaSubticks.tick, 1);
	assert.equal(viaSubticks.subtick, 0);
	assert.equal(viaSubticks.player.reliability.recentOutcomes.at(-1)?.kind, "fulfilled");
});

test("subticks before month boundary do not append ledger entries or refresh the market", () => {
	const datacenter = makeDatacenter("dc-1");
	const activeContract = makeContract("contract-live", datacenter);
	const marketOffer: Contract = {
		...makeContract("contract-market", datacenter, {
			assignedDcId: undefined,
			startedAtTick: undefined,
			acceptedAtTick: undefined,
			lifecycleState: "market_open",
			status: "offered",
		}),
		expiresAtTick: tickValue(0),
	};
	let state = makeState({
		datacenters: [datacenter],
		contracts: [activeContract, marketOffer],
		activeContracts: [activeContract],
		contractMarket: [marketOffer],
	});
	const cashBefore = state.player.cash;

	for (let day = 0; day < DAYS_PER_TICK - 1; day += 1) {
		state = advanceSubtick(state);
	}

	assert.equal(state.tick, 0);
	assert.equal(state.subtick, DAYS_PER_TICK - 1);
	assert.equal(state.player.cash, cashBefore);
	assert.equal(state.ledger.length, 0);
	assert.equal(state.contractMarket[0]?.offeredAtTick, 0);
	assert.equal(state.contractMarket.length, 1);
	assert.equal(state.activeContracts[0]?.currentSlaWindow.sampledDays, DAYS_PER_TICK - 1);
});

test("the boundary subtick performs monthly settlement exactly once", () => {
	const datacenter = makeDatacenter("dc-1");
	const activeContract = makeContract("contract-live", datacenter);
	const marketOffer: Contract = {
		...makeContract("contract-market", datacenter, {
			assignedDcId: undefined,
			startedAtTick: undefined,
			acceptedAtTick: undefined,
			lifecycleState: "market_open",
			status: "offered",
		}),
		expiresAtTick: tickValue(0),
	};
	let nearBoundary = makeState({
		datacenters: [datacenter],
		contracts: [activeContract, marketOffer],
		activeContracts: [activeContract],
		contractMarket: [marketOffer],
	});
	for (let day = 0; day < DAYS_PER_TICK - 1; day += 1) {
		nearBoundary = advanceSubtick(nearBoundary);
	}

	const settled = advanceSubtick(nearBoundary);

	assert.equal(settled.tick, 1);
	assert.equal(settled.subtick, 0);
	assert.equal(nearBoundary.tick, 0);
	assert.equal(nearBoundary.ledger.length, 0);
	assert.ok(settled.ledger.length > 0);
	assert.ok(settled.player.cash !== nearBoundary.player.cash);
	assert.equal(settled.activeContracts[0]?.currentSlaWindow.sampledDays, 0);
	assert.equal(settled.contractMarket.length, MARKET_REFRESH_SIZE);
	assert.ok(settled.contractMarket.every((contract) => contract.offeredAtTick === 1));
});

test("mid-month repair can recover in time to save a 90% SLA month", () => {
	const datacenter = {
		...makeDatacenter("dc-1", [
			{
				...placement("rack-1", "C1"),
				health: "repairing" as const,
				repairProgressDays: 4,
				lastFailureAtTick: tickValue(0),
				lastFailureAtSubtick: 0,
			},
		]),
	};
	const contract = makeContract("contract-1", datacenter);
	const start = makeState({
		datacenters: [datacenter],
		contracts: [contract],
		activeContracts: [contract],
	});

	let state = start;
	for (let day = 0; day < DAYS_PER_TICK; day += 1) {
		state = advanceSubtick(state);
	}

	const settledContract = state.activeContracts[0]!;
	const settledDatacenter = state.datacenters[0]!;
	const opex = tickOpex(settledDatacenter, TEST_REGION, [settledContract]).total;

	assert.equal(state.tick, 1);
	assert.equal(settledDatacenter.placements[0]?.health, "healthy");
	assert.equal(settledContract.status, "active");
	assert.deepEqual(settledContract.currentSlaWindow, { sampledDays: 0, servedDays: 0, failedDays: 0 });
	assert.equal(state.player.cash, start.player.cash - opex + contract.monthlyPayment);
	assert.equal(state.player.reliability.recentOutcomes.at(-1)?.kind, "fulfilled");
});
