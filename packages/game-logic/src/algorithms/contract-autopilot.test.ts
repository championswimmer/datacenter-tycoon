import assert from "node:assert/strict";
import test from "node:test";

import type { PlayerId, Tick } from "../types.js";
import { planContractAutopilot } from "./contract-autopilot.js";
import {
	makeDatacenter,
	makeLiveContract,
	makeMarketContract,
	makeRequirements,
	makeState,
} from "./test-fixtures.js";

test("autopilot — emits AcceptContract for a profitable market offer", () => {
	const dc = makeDatacenter("dc-1");
	const offer = makeMarketContract("offer-1", {
		monthlyPayment: 30_000,
		termMonths: 6,
		requirements: makeRequirements({ vCpu: 32, ramGb: 128, storageTb: 5, gpuFlops: 25 }),
	});
	const state = makeState({ datacenters: [dc], contracts: [offer] });

	const plan = planContractAutopilot(state);

	assert.equal(plan.actions.length, 1);
	const action = plan.actions[0]!.action;
	assert.equal(action.type, "AcceptContract");
	if (action.type === "AcceptContract") {
		assert.equal(action.contractId, "offer-1");
		assert.equal(action.dcId, dc.id);
	}
	assert.ok(plan.totalExpectedDelta > 0);
});

test("autopilot — emits a swap as Cancel + Accept in correct order", () => {
	const dc = makeDatacenter("dc-1");
	const live = makeLiveContract("live-small", dc.id, {
		monthlyPayment: 4_000,
		penaltyPerMonth: 1_000,
		termMonths: 10,
		startedAtTick: 0 as Tick,
		requirements: makeRequirements({ vCpu: 250, ramGb: 700, storageTb: 20, gpuFlops: 100 }),
	});
	const huge = makeMarketContract("huge", {
		monthlyPayment: 60_000,
		penaltyPerMonth: 20_000,
		termMonths: 12,
		requirements: makeRequirements({ vCpu: 250, ramGb: 700, storageTb: 20, gpuFlops: 100 }),
	});
	const state = makeState({
		datacenters: [dc],
		contracts: [live, huge],
		tick: 1 as Tick,
	});

	const plan = planContractAutopilot(state);

	assert.equal(plan.actions.length, 2);
	assert.equal(plan.actions[0]!.action.type, "CancelContract");
	assert.equal(plan.actions[1]!.action.type, "AcceptContract");

	const cancel = plan.actions[0]!.action;
	const accept = plan.actions[1]!.action;
	if (cancel.type === "CancelContract") assert.equal(cancel.contractId, "live-small");
	if (accept.type === "AcceptContract") assert.equal(accept.contractId, "huge");
});

test("autopilot — does not propose conflicting accepts when capacity only fits one", () => {
	const dc = makeDatacenter("dc-1");
	// Two offers that each fit alone, but not together
	const offerA = makeMarketContract("offer-a", {
		monthlyPayment: 30_000,
		termMonths: 6,
		requirements: makeRequirements({ vCpu: 300, ramGb: 700, storageTb: 20, gpuFlops: 100 }),
	});
	const offerB = makeMarketContract("offer-b", {
		monthlyPayment: 28_000,
		termMonths: 6,
		requirements: makeRequirements({ vCpu: 300, ramGb: 700, storageTb: 20, gpuFlops: 100 }),
	});
	const state = makeState({ datacenters: [dc], contracts: [offerA, offerB] });

	const plan = planContractAutopilot(state);

	// Should accept exactly one, not both (the second one no longer fits after
	// applying the first's effect to the shadow state).
	const accepts = plan.actions.filter((a) => a.action.type === "AcceptContract");
	assert.equal(accepts.length, 1);
});

test("autopilot — respects maxActions cap", () => {
	const dc = makeDatacenter("dc-1");
	const offers = Array.from({ length: 5 }, (_, i) =>
		makeMarketContract(`offer-${i}`, {
			monthlyPayment: 15_000,
			termMonths: 4,
			requirements: makeRequirements({ vCpu: 16, ramGb: 64, storageTb: 2, gpuFlops: 10 }),
		}),
	);
	const state = makeState({ datacenters: [dc], contracts: offers });

	const plan = planContractAutopilot(state, { maxActions: 2 });

	assert.ok(plan.actions.length <= 2);
});

test("autopilot — blocks accepts when below buffer but cash is low (non-strict)", () => {
	const dc = makeDatacenter("dc-1");
	const offer = makeMarketContract("offer-1", {
		monthlyPayment: 30_000,
		termMonths: 6,
		requirements: makeRequirements({ vCpu: 32, ramGb: 128, storageTb: 5, gpuFlops: 25 }),
	});
	const state = makeState({
		datacenters: [dc],
		contracts: [offer],
		player: {
			id: "player-1" as PlayerId,
			name: "Broke",
			cash: 0,
			reliability: { score: 50, recentOutcomes: [] },
		},
	});

	const plan = planContractAutopilot(state);

	// Below buffer & non-strict → no accepts allowed
	assert.equal(plan.actions.filter((a) => a.action.type === "AcceptContract").length, 0);
	assert.ok(plan.skippedReason);
});

test("autopilot — returns empty plan when nothing is worth doing", () => {
	const dc = makeDatacenter("dc-1");
	// Underpriced offer — payment barely covers requirements
	const cheap = makeMarketContract("cheap", {
		monthlyPayment: 100,
		penaltyPerMonth: 50,
		termMonths: 2,
		requirements: makeRequirements({ vCpu: 8, ramGb: 32, storageTb: 1, gpuFlops: 5 }),
	});
	const state = makeState({ datacenters: [dc], contracts: [cheap] });

	const plan = planContractAutopilot(state, { minNpvDelta: 5_000 });

	assert.equal(plan.actions.length, 0);
});

test("autopilot — plan is deterministic given identical inputs", () => {
	const dc = makeDatacenter("dc-1");
	const offers = [
		makeMarketContract("offer-1", { monthlyPayment: 30_000, requirements: makeRequirements({ vCpu: 32 }) }),
		makeMarketContract("offer-2", { monthlyPayment: 20_000, requirements: makeRequirements({ vCpu: 24 }) }),
	];
	const state = makeState({ datacenters: [dc], contracts: offers });

	const plan1 = planContractAutopilot(state);
	const plan2 = planContractAutopilot(state);

	assert.equal(plan1.actions.length, plan2.actions.length);
	assert.deepEqual(
		plan1.actions.map((a) => a.action),
		plan2.actions.map((a) => a.action),
	);
});
