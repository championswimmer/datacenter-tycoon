import assert from "node:assert/strict";
import test from "node:test";

import { DATACENTER_CATALOG } from "../catalog/datacenters.js";
import { RACK_CATALOG } from "../catalog/racks.js";
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
	Tick,
} from "../types.js";

const contractId = (value: string): ContractId => value as ContractId;
const datacenterId = (value: string): DatacenterId => value as DatacenterId;
const playerId = (value: string): PlayerId => value as PlayerId;
const rackPlacementId = (value: string): RackPlacementId => value as RackPlacementId;
const tickValue = (value: number): Tick => value as Tick;

function placement(id: string, specId: keyof typeof RACK_CATALOG, row: number, position: number): RackPlacement {
	const spec = RACK_CATALOG[specId];
	return {
		id: rackPlacementId(id),
		specId: spec.id,
		kind: spec.kind,
		installedAtTick: tickValue(0),
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
		offeredAtTick: tickValue(0),
		expiresAtTick: tickValue(3),
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
		player: {
			id: playerId("player-1"),
			name: "Player One",
			cash: 500_000,
		},
		datacenters: [],
		contractMarket: [],
		activeContracts: [],
		ledger: [],
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
	const opex = tickOpex(datacenter).total;

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

test("tick cancels breached contracts when their term ends and records penalties", () => {
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
	const opex = tickOpex(weakDatacenter).total;

	const nextState = tick(state);

	assert.equal(nextState.activeContracts[0]?.status, "cancelled");
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
	assert.equal(firstRun.contractMarket.length, MARKET_REFRESH_SIZE);
});
