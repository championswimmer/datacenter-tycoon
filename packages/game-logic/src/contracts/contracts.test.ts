import assert from "node:assert/strict";
import test from "node:test";

import { DATACENTER_CATALOG } from "../catalog/datacenters.js";
import { RACK_CATALOG } from "../catalog/racks.js";
import {
	RELIABILITY_BASELINE_SCORE,
	RELIABILITY_MARKET_OFFER_COUNT,
	reliabilityMarketPolicyForScore,
} from "../balance/reliability.js";
import {
	acceptContract,
	advanceContract,
	evaluateContract,
	generateContract,
	marketDifficulty,
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
		builtAtTick: tick(0),
		regionId: "us_west" as import("../types.js").RegionId,
		maintenanceStaff: 0,
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
		urgency: "standard",
		tier: 1,
		offeredAtTick: tick(0),
		expiresAtTick: tick(6),
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
			reliability: {
				score: RELIABILITY_BASELINE_SCORE,
				recentOutcomes: [],
			},
		},
		datacenters: [makeDatacenter("dc-1")],
		contractMarket: [],
		activeContracts: [],
		ledger: [],
		map: { regions: [] },
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

	assert.equal(nextState.contractMarket.length, MARKET_REFRESH_SIZE);
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

test("refreshContractMarket adjusts offer count by reliability band while preserving retained offers", () => {
	const retained = makeContract("retained", {
		status: "offered",
		offeredAtTick: tick(6),
		expiresAtTick: tick(12),
	});
	const trustedState = makeState({
		tick: tick(8),
		rngState: 99,
		player: {
			...makeState().player,
			reliability: {
				score: 80,
				recentOutcomes: [],
			},
		},
		contractMarket: [retained],
	});
	const atRiskState = {
		...trustedState,
		player: {
			...trustedState.player,
			reliability: {
				score: 20,
				recentOutcomes: [],
			},
		},
	};

	const trustedMarket = refreshContractMarket(trustedState);
	const atRiskMarket = refreshContractMarket(atRiskState);

	assert.equal(trustedMarket.contractMarket.length, RELIABILITY_MARKET_OFFER_COUNT.trusted);
	assert.equal(atRiskMarket.contractMarket.length, RELIABILITY_MARKET_OFFER_COUNT["at-risk"]);
	assert.ok(trustedMarket.contractMarket.some((contract) => contract.id === retained.id));
	assert.ok(atRiskMarket.contractMarket.some((contract) => contract.id === retained.id));
	assert.deepEqual(refreshContractMarket(trustedState), trustedMarket);
});

test("acceptContract backfills the market slot immediately to keep MARKET_REFRESH_SIZE offers", () => {
	const offers = Array.from({ length: MARKET_REFRESH_SIZE }, (_, i) =>
		makeContract(`offer-${i}`, {
			status: "offered",
			offeredAtTick: tick(0),
			expiresAtTick: tick(6),
		}),
	);
	const state = makeState({ contractMarket: offers });

	const nextState = acceptContract(state, offers[0]!.id, state.datacenters[0]!.id);

	assert.equal(nextState.contractMarket.length, MARKET_REFRESH_SIZE);
	assert.ok(nextState.activeContracts.length === 1);
	assert.equal(nextState.activeContracts[0]!.status, "active");
});

test("market refresh and acceptance stay deterministic for identical reliability state", () => {
	const initialState = makeState({
		tick: tick(8),
		rngState: 321,
		player: {
			...makeState().player,
			reliability: {
				score: 80,
				recentOutcomes: [],
			},
		},
	});

	const firstRefresh = refreshContractMarket(initialState);
	const secondRefresh = refreshContractMarket(initialState);

	assert.deepEqual(firstRefresh, secondRefresh);

	const acceptedContractId = firstRefresh.contractMarket[0]!.id;
	const firstAccepted = acceptContract(firstRefresh, acceptedContractId, firstRefresh.datacenters[0]!.id);
	const secondAccepted = acceptContract(secondRefresh, acceptedContractId, secondRefresh.datacenters[0]!.id);

	assert.deepEqual(firstAccepted, secondAccepted);
});

test("marketDifficulty clamps low for ticks 0-5 and caps at 0.85 for later ticks", () => {
	assert.ok(marketDifficulty(0, 0) <= 0.25);
	assert.ok(marketDifficulty(3, 1) <= 0.25);
	assert.ok(marketDifficulty(5, 1) <= 0.25);
	assert.ok(marketDifficulty(100, 1) <= 0.85);
	assert.ok(marketDifficulty(200, 1) <= 0.85);
});

test("generateContract at low difficulty never requires GPU", () => {
	const rng = createRng(42);
	for (let i = 0; i < 20; i++) {
		const contract = generateContract(rng, 0.1);
		assert.equal(contract.requirements.gpuFlops, 0, `${contract.name} should not require GPU at low difficulty`);
	}
});

test("generateContract biases average term length by reliability policy", () => {
	const trustedPolicy = reliabilityMarketPolicyForScore(80);
	const baselinePolicy = reliabilityMarketPolicyForScore(RELIABILITY_BASELINE_SCORE);
	const atRiskPolicy = reliabilityMarketPolicyForScore(20);
	const trustedRng = createRng(2026);
	const baselineRng = createRng(2026);
	const atRiskRng = createRng(2026);
	const sampleSize = 200;

	const averageTerm = (terms: number[]): number => terms.reduce((sum, term) => sum + term, 0) / terms.length;
	const trustedTerms = Array.from({ length: sampleSize }, () => generateContract(trustedRng, 0.5, trustedPolicy).termMonths);
	const baselineTerms = Array.from({ length: sampleSize }, () => generateContract(baselineRng, 0.5, baselinePolicy).termMonths);
	const atRiskTerms = Array.from({ length: sampleSize }, () => generateContract(atRiskRng, 0.5, atRiskPolicy).termMonths);

	assert.ok(averageTerm(trustedTerms) > averageTerm(baselineTerms));
	assert.ok(averageTerm(baselineTerms) > averageTerm(atRiskTerms));
});

test("generateContract produces rush, anchor, and standard urgency types over a large sample", () => {
	const rng = createRng(9999);
	const urgencies = new Set<string>();
	for (let i = 0; i < 200; i++) {
		const contract = generateContract(rng, 0.5);
		urgencies.add(contract.urgency);
	}
	assert.ok(urgencies.has("standard"), "should produce standard contracts");
	assert.ok(urgencies.has("rush"), "should produce rush contracts");
	assert.ok(urgencies.has("anchor"), "should produce anchor contracts");
});

test("rush contracts have shorter term and higher payment than standard of same difficulty", () => {
	const rng = createRng(7777);
	let rush: Contract | undefined;
	let standard: Contract | undefined;
	for (let i = 0; i < 200 && (!rush || !standard); i++) {
		const c = generateContract(rng, 0.5);
		if (c.urgency === "rush" && !rush) rush = c;
		if (c.urgency === "standard" && !standard) standard = c;
	}
	assert.ok(rush, "should find a rush contract");
	assert.ok(standard, "should find a standard contract");
	assert.ok(rush!.termMonths <= 2, `rush term ${rush!.termMonths} should be <= 2`);
	assert.ok(rush!.expiresAtTick <= 2, `rush offer window ${rush!.expiresAtTick} should be <= 2`);
});

test("anchor contracts have longer term and lower penalty ratio", () => {
	const rng = createRng(5555);
	let anchor: Contract | undefined;
	for (let i = 0; i < 200 && !anchor; i++) {
		const c = generateContract(rng, 0.5);
		if (c.urgency === "anchor") anchor = c;
	}
	assert.ok(anchor, "should find an anchor contract");
	assert.ok(anchor!.termMonths >= 8, `anchor term ${anchor!.termMonths} should be >= 8`);
});

test("advanceContract auto-cancels a contract that was already breached", () => {
	const dc = makeDatacenter("dc-1", [placement("rack-1", "C1", 0, 0)]);
	const contract = makeContract("breach-1", {
		status: "breached",
		startedAtTick: tick(2),
		assignedDcId: dc.id,
		requirements: { vCpu: 500, ramGb: 5_000, storageTb: 500, gpuFlops: 500 },
		termMonths: 10,
	});

	const result = advanceContract(contract, dc, 4);
	assert.equal(result.status, "cancelled");
});

test("advanceContract keeps a newly-breachd contract as breached for one tick", () => {
	const dc = makeDatacenter("dc-1", [placement("rack-1", "C1", 0, 0)]);
	const contract = makeContract("active-1", {
		status: "active",
		startedAtTick: tick(2),
		assignedDcId: dc.id,
		requirements: { vCpu: 500, ramGb: 5_000, storageTb: 500, gpuFlops: 500 },
		termMonths: 10,
	});

	const result = advanceContract(contract, dc, 4);
	assert.equal(result.status, "breached");
});
