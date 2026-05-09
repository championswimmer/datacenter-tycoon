import assert from "node:assert/strict";
import test from "node:test";

import {
	RELIABILITY_BASELINE_SCORE,
	RELIABILITY_MAX_SCORE,
	RELIABILITY_MIN_SCORE,
	RELIABILITY_RECENT_OUTCOME_LIMIT,
} from "../balance/reliability.js";
import {
	applyReliabilityDelta,
	calculateReliabilityDelta,
	classifyContractSlaOutcomeKind,
	collectContractSlaOutcomes,
	updatePlayerReliability,
} from "../contracts/index.js";
import type { Contract, ContractId, ContractSlaOutcome, Tick } from "../types.js";

const contractId = (value: string): ContractId => value as ContractId;
const tick = (value: number): Tick => value as Tick;

function makeContract(id: string, overrides: Partial<Contract> = {}): Contract {
	return {
		id: contractId(id),
		name: `Contract ${id}`,
		requirements: {
			vCpu: 128,
			ramGb: 2_048,
			storageTb: 250,
			gpuFlops: 0,
		},
		monthlyPayment: 20_000,
		penaltyPerMonth: 8_000,
		termMonths: 6,
		status: "active",
		urgency: "standard",
		tier: 1,
		offeredAtTick: tick(0),
		expiresAtTick: tick(6),
		startedAtTick: tick(0),
		...overrides,
	};
}

function makeOutcome(index: number, kind: ContractSlaOutcome["kind"]): ContractSlaOutcome {
	return {
		contractId: contractId(`contract-${index}`),
		contractName: `Contract ${index}`,
		tick: tick(index),
		kind,
	};
}

test("classifyContractSlaOutcomeKind treats active and clean expiry months as fulfilled", () => {
	assert.equal(
		classifyContractSlaOutcomeKind(makeContract("active-month", { status: "active" }), makeContract("active-month", { status: "active" })),
		"fulfilled",
	);
	assert.equal(
		classifyContractSlaOutcomeKind(makeContract("expired-month", { status: "active" }), makeContract("expired-month", { status: "expired" })),
		"fulfilled",
	);
});

test("classifyContractSlaOutcomeKind distinguishes repeated breaches from explicit cancellation", () => {
	assert.equal(
		classifyContractSlaOutcomeKind(makeContract("breach", { status: "active" }), makeContract("breach", { status: "breached" })),
		"breached",
	);
	assert.equal(
		classifyContractSlaOutcomeKind(makeContract("repeat-breach", { status: "breached" }), makeContract("repeat-breach", { status: "breached" })),
		"breached",
	);
	assert.equal(
		classifyContractSlaOutcomeKind(makeContract("explicit-cancel", { status: "active" }), makeContract("explicit-cancel", { status: "cancelled" })),
		"cancelled",
	);
	assert.equal(
		classifyContractSlaOutcomeKind(makeContract("breached-expiry", { status: "breached" }), makeContract("breached-expiry", { status: "expired" })),
		undefined,
	);
});

test("collectContractSlaOutcomes preserves contract order and ignores contracts without a prior state", () => {
	const previousContracts = [
		makeContract("alpha", { status: "active" }),
		makeContract("beta", { status: "breached" }),
	];
	const nextContracts = [
		makeContract("alpha", { status: "expired" }),
		makeContract("beta", { status: "expired" }),
		makeContract("gamma", { status: "active" }),
	];

	assert.deepEqual(collectContractSlaOutcomes(previousContracts, nextContracts, tick(7)), [
		{ contractId: contractId("alpha"), contractName: "Contract alpha", tick: 7, kind: "fulfilled" },
	]);
});

test("calculateReliabilityDelta sums fulfilled, breached, and cancelled outcomes deterministically", () => {
	const outcomes = [makeOutcome(1, "fulfilled"), makeOutcome(2, "fulfilled"), makeOutcome(3, "breached"), makeOutcome(4, "cancelled")];

	assert.equal(calculateReliabilityDelta(outcomes), -14);
});

test("applyReliabilityDelta clamps score movement to configured min and max", () => {
	assert.equal(applyReliabilityDelta(RELIABILITY_MIN_SCORE, -50), RELIABILITY_MIN_SCORE);
	assert.equal(applyReliabilityDelta(RELIABILITY_MAX_SCORE, 50), RELIABILITY_MAX_SCORE);
	assert.equal(applyReliabilityDelta(RELIABILITY_BASELINE_SCORE, 6), 56);
});

test("updatePlayerReliability appends outcomes, records last delta, and trims history", () => {
	const seededHistory = Array.from({ length: RELIABILITY_RECENT_OUTCOME_LIMIT }, (_, index) => makeOutcome(index, "fulfilled"));
	const reliability = {
		score: RELIABILITY_BASELINE_SCORE,
		lastDelta: 3,
		recentOutcomes: seededHistory,
	};
	const newOutcomes = [makeOutcome(10, "fulfilled"), makeOutcome(11, "breached")];

	const updated = updatePlayerReliability(reliability, newOutcomes);

	assert.equal(updated.score, 45);
	assert.equal(updated.lastDelta, -5);
	assert.equal(updated.recentOutcomes.length, RELIABILITY_RECENT_OUTCOME_LIMIT);
	assert.deepEqual(updated.recentOutcomes.at(-2), newOutcomes[0]);
	assert.deepEqual(updated.recentOutcomes.at(-1), newOutcomes[1]);
});

test("updatePlayerReliability is a no-op when there are no SLA outcomes this tick", () => {
	const reliability = {
		score: RELIABILITY_BASELINE_SCORE,
		recentOutcomes: [],
	};

	assert.equal(updatePlayerReliability(reliability, []), reliability);
});
