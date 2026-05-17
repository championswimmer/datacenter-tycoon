import assert from "node:assert/strict";
import test from "node:test";

import type { Tick } from "../types.js";
import { recommendContractActions } from "./contract-advisor.js";
import {
	makeDatacenter,
	makeLiveContract,
	makeMarketContract,
	makeRequirements,
	makeState,
} from "./test-fixtures.js";

test("advisor — empty state returns no recommendations", () => {
	const state = makeState();
	const report = recommendContractActions(state);
	assert.deepEqual(report.recommendations, []);
	assert.equal(report.totalExpectedDelta, 0);
});

test("advisor — surfaces accept recommendation for a profitable market contract", () => {
	const dc = makeDatacenter("dc-1");
	const offer = makeMarketContract("offer-good", {
		monthlyPayment: 30_000,
		termMonths: 6,
		requirements: makeRequirements({ vCpu: 32, ramGb: 128, storageTb: 5, gpuFlops: 25 }),
	});
	const state = makeState({ datacenters: [dc], contracts: [offer] });

	const report = recommendContractActions(state);

	assert.equal(report.recommendations.length, 1);
	const rec = report.recommendations[0]!;
	assert.equal(rec.kind, "accept");
	if (rec.kind === "accept") {
		assert.equal(rec.contractId, "offer-good");
		assert.equal(rec.dcId, dc.id);
		assert.ok(rec.expectedDelta > 0);
	}
});

test("advisor — recommendations sorted by expectedDelta descending", () => {
	const dc = makeDatacenter("dc-1");
	const smallOffer = makeMarketContract("small", {
		monthlyPayment: 8_000,
		termMonths: 3,
		requirements: makeRequirements({ vCpu: 16, ramGb: 64, storageTb: 2, gpuFlops: 10 }),
	});
	const bigOffer = makeMarketContract("big", {
		monthlyPayment: 40_000,
		termMonths: 12,
		requirements: makeRequirements({ vCpu: 32, ramGb: 128, storageTb: 5, gpuFlops: 25 }),
	});
	const state = makeState({ datacenters: [dc], contracts: [smallOffer, bigOffer] });

	const report = recommendContractActions(state);

	assert.equal(report.recommendations.length, 2);
	assert.ok(report.recommendations[0]!.expectedDelta >= report.recommendations[1]!.expectedDelta);
	if (report.recommendations[0]!.kind === "accept") {
		assert.equal(report.recommendations[0]!.contractId, "big");
	}
});

test("advisor — recommends swap when megacontract needs space and a small live contract is in the way", () => {
	const dc = makeDatacenter("dc-1");
	// Live contract eating most of the vCpu budget (DC cap ≈ 416 vCpu), low value.
	const live = makeLiveContract("live-small", dc.id, {
		monthlyPayment: 4_000,
		penaltyPerMonth: 1_000,
		termMonths: 10,
		startedAtTick: 0 as Tick,
		requirements: makeRequirements({ vCpu: 250, ramGb: 700, storageTb: 20, gpuFlops: 100 }),
	});
	// Market contract that fits alone but not with live (250 + 250 > 416 vCpu),
	// with payment large enough to dominate the cancel reliability cost.
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

	const report = recommendContractActions(state);
	const swap = report.recommendations.find((rec) => rec.kind === "swap");

	assert.ok(swap, "expected at least one swap recommendation");
	if (swap?.kind === "swap") {
		assert.equal(swap.dropContractId, "live-small");
		assert.equal(swap.acceptContractId, "huge");
		assert.ok(swap.expectedDelta > 0);
	}
});

test("advisor — does not recommend swap when cancel cost exceeds the gain", () => {
	const dc = makeDatacenter("dc-1");
	// High-value live contract — cancelling it would be a net loss
	const live = makeLiveContract("live-anchor", dc.id, {
		monthlyPayment: 50_000,
		penaltyPerMonth: 5_000,
		termMonths: 18,
		startedAtTick: 0 as Tick,
		requirements: makeRequirements({ vCpu: 250, ramGb: 700, storageTb: 20, gpuFlops: 100 }),
	});
	const mediocre = makeMarketContract("mediocre", {
		monthlyPayment: 30_000,
		termMonths: 4,
		requirements: makeRequirements({ vCpu: 250, ramGb: 700, storageTb: 20, gpuFlops: 100 }),
	});
	const state = makeState({
		datacenters: [dc],
		contracts: [live, mediocre],
		tick: 1 as Tick,
	});

	const report = recommendContractActions(state);
	const swap = report.recommendations.find((rec) => rec.kind === "swap");

	assert.equal(swap, undefined, "swapping a long anchor for a short mediocre offer should not be recommended");
});

test("advisor — recommendations include a clear human-readable reason", () => {
	const dc = makeDatacenter("dc-1");
	const offer = makeMarketContract("offer-1", {
		monthlyPayment: 20_000,
		termMonths: 6,
		requirements: makeRequirements({ vCpu: 16, ramGb: 64, storageTb: 2, gpuFlops: 10 }),
	});
	const state = makeState({ datacenters: [dc], contracts: [offer] });

	const report = recommendContractActions(state);

	assert.equal(report.recommendations.length, 1);
	const reason = report.recommendations[0]!.reason;
	assert.ok(reason.length > 10);
	assert.match(reason, /NPV/);
});
