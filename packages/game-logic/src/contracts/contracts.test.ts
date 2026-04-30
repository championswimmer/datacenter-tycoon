import assert from "node:assert/strict";
import test from "node:test";

import { DATACENTER_CATALOG } from "../catalog/datacenters.js";
import { RACK_CATALOG } from "../catalog/racks.js";
import {
	acceptContract,
	advanceContract,
	evaluateContract,
	generateContract,
	refreshContractMarket,
} from "../contracts/index.js";
import { MARKET_REFRESH_SIZE } from "../economy/constants.js";
import { createRng } from "../sim/rng.js";
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
const tick = (value: number): Tick => value as Tick;

function placement(id: string, specId: keyof typeof RACK_CATALOG, row: number, position: number): RackPlacement {
	const spec = RACK_CATALOG[specId];
	return {
		id: rackPlacementId(id),
		specId: spec.id,
		kind: spec.kind,
		installedAtTick: tick(0),
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
		builtAtTick: tick(0),
	};
}

function makeContract(id: string, overrides: Partial<Contract> = {}): Contract {
	return {
		id: contractId(id),
		name: `Contract ${id}`,
		requirements: {
			vCpu: 128,
			ramGb: 2_048,
			storageTb: 250,
			gpuFlops: 200,
		},
		monthlyPayment: 20_000,
		penaltyPerMonth: 8_000,
		termMonths: 6,
		status: "offered",
		offeredAtTick: tick(0),
		expiresAtTick: tick(3),
		...overrides,
	};
}

function makeState(overrides: Partial<GameState> = {}): GameState {
	return {
		tick: tick(2),
		seed: 42,
		rngState: 42,
		player: {
			id: playerId("player-1"),
			name: "Player One",
			cash: 250_000,
		},
		datacenters: [makeDatacenter("dc-1")],
		contractMarket: [],
		activeContracts: [],
		ledger: [],
		...overrides,
	};
}

test("generateContract is deterministic for the same seed and difficulty", () => {
	const first = generateContract(createRng(12345), 0.45);
	const second = generateContract(createRng(12345), 0.45);

	assert.deepEqual(first, second);
	assert.equal(first.status, "offered");
	assert.ok(first.monthlyPayment > first.penaltyPerMonth);
	assert.ok(first.requirements.vCpu > 0 || first.requirements.ramGb > 0 || first.requirements.storageTb > 0);
});

test("refreshContractMarket is deterministic, removes expired offers, and tops up to the configured size", () => {
	const retained = makeContract("retained", {
		status: "offered",
		offeredAtTick: tick(1),
		expiresAtTick: tick(4),
	});
	const expired = makeContract("expired", {
		status: "offered",
		offeredAtTick: tick(0),
		expiresAtTick: tick(2),
	});
	const input = makeState({
		tick: tick(2),
		rngState: 99,
		contractMarket: [retained, expired],
	});

	const first = refreshContractMarket(input);
	const second = refreshContractMarket(input);

	assert.deepEqual(first, second);
	assert.equal(first.contractMarket.length, MARKET_REFRESH_SIZE);
	assert.ok(first.contractMarket.some((contract) => contract.id === retained.id));
	assert.ok(first.contractMarket.every((contract) => contract.id !== expired.id));
	assert.notEqual(first.rngState, input.rngState);
});

test("acceptContract moves an offered contract into the active list with assignment metadata", () => {
	const offeredContract = makeContract("market-1");
	const state = makeState({ contractMarket: [offeredContract] });

	const nextState = acceptContract(state, offeredContract.id, state.datacenters[0]!.id);

	assert.equal(nextState.contractMarket.length, 0);
	assert.equal(nextState.activeContracts.length, 1);
	assert.deepEqual(nextState.activeContracts[0], {
		...offeredContract,
		status: "active",
		startedAtTick: state.tick,
		assignedDcId: state.datacenters[0]!.id,
	});
});

test("acceptContract rejects unknown datacenters and already active contracts", () => {
	const offeredContract = makeContract("market-1");
	const state = makeState({
		contractMarket: [offeredContract],
		activeContracts: [
			makeContract("active-1", {
				id: contractId("active-1"),
				status: "active",
				startedAtTick: tick(1),
				assignedDcId: datacenterId("dc-1"),
			}),
		],
	});

	assert.throws(() => acceptContract(state, offeredContract.id, datacenterId("missing-dc")), {
		message: /Unknown datacenter/,
	});
	assert.throws(() => acceptContract(state, contractId("active-1"), datacenterId("dc-1")), {
		message: /Contract already active/,
	});
});

test("evaluateContract reports whether a datacenter can satisfy a contract", () => {
	const healthyDatacenter = makeDatacenter("dc-1");
	const constrainedDatacenter = makeDatacenter("dc-2", [placement("rack-1", "C1", 0, 0)]);
	const contract = makeContract("workload-1", {
		requirements: { vCpu: 200, ramGb: 3_000, storageTb: 400, gpuFlops: 200 },
	});

	assert.equal(evaluateContract(healthyDatacenter, contract), "fulfilled");
	assert.equal(evaluateContract(constrainedDatacenter, contract), "breached");
});

test("advanceContract transitions between active, breached, completed, and cancelled states", () => {
	const datacenter = makeDatacenter("dc-1");
	const breachedDatacenter = makeDatacenter("dc-2", [placement("rack-1", "C1", 0, 0)]);
	const baseContract = makeContract("lifecycle-1", {
		status: "active",
		startedAtTick: tick(2),
		assignedDcId: datacenter.id,
		requirements: { vCpu: 200, ramGb: 3_000, storageTb: 400, gpuFlops: 200 },
		termMonths: 6,
	});

	assert.equal(advanceContract(baseContract, datacenter, 5).status, "active");
	assert.equal(advanceContract(baseContract, breachedDatacenter, 5).status, "breached");
	assert.equal(advanceContract(baseContract, datacenter, 8).status, "completed");
	assert.equal(advanceContract(baseContract, breachedDatacenter, 8).status, "cancelled");
});
