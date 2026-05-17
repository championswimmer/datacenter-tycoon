import assert from "node:assert/strict";
import test from "node:test";

import {
	cancelReliabilityCashCost,
	DEFAULT_RELIABILITY_CASH_PER_POINT,
	scoreLiveContract,
	scoreMarketContract,
	scoreMarketContractForDatacenter,
} from "./contract-score.js";
import type { RegionId, Tick } from "../types.js";
import {
	makeDatacenter,
	makeLiveContract,
	makeMarketContract,
	makePlacement,
	makeRequirements,
	makeState,
} from "./test-fixtures.js";

test("scoreMarketContractForDatacenter — well-fitting contract has positive NPV close to undiscounted revenue", () => {
	const dc = makeDatacenter("dc-1");
	const contract = makeMarketContract("c-fit", {
		monthlyPayment: 30_000,
		termMonths: 6,
		requirements: makeRequirements({ vCpu: 64, ramGb: 256, storageTb: 10, gpuFlops: 50 }),
	});
	const state = makeState({ datacenters: [dc] });

	const breakdown = scoreMarketContractForDatacenter(state, contract, dc);

	assert.equal(breakdown.fits, true);
	assert.ok(breakdown.npv > 0, `expected positive NPV, got ${breakdown.npv}`);
	// 6 months × $30k = $180k gross before discounting + opex
	assert.ok(breakdown.grossRevenue > 150_000 && breakdown.grossRevenue < 180_000);
	assert.ok(breakdown.marginalOpex < 0, "marginal opex should be a negative cost");
	assert.ok(breakdown.expectedPenalty === 0, "no penalty risk when fitting");
});

test("scoreMarketContractForDatacenter — oversized contract has fits=false and large negative NPV", () => {
	const dc = makeDatacenter("dc-1");
	const contract = makeMarketContract("c-huge", {
		monthlyPayment: 30_000,
		penaltyPerMonth: 50_000,
		termMonths: 12,
		// Way past anything the seed DC can serve
		requirements: makeRequirements({ vCpu: 100_000, ramGb: 500_000, storageTb: 50_000, gpuFlops: 5_000 }),
	});
	const state = makeState({ datacenters: [dc] });

	const breakdown = scoreMarketContractForDatacenter(state, contract, dc);

	assert.equal(breakdown.fits, false);
	assert.ok(breakdown.npv < 0, `expected negative NPV when contract cannot be served, got ${breakdown.npv}`);
	assert.equal(breakdown.grossRevenue, 0);
	assert.ok(breakdown.expectedPenalty < 0);
});

test("scoreMarketContract — returns candidates sorted by NPV descending, cheapest-power DC wins", () => {
	const dcWest = makeDatacenter("dc-west", undefined, "us_west" as RegionId);
	const dcEast = makeDatacenter("dc-east", [
		makePlacement("dc-east-r1", "C2", 0, 0),
		makePlacement("dc-east-r2", "M2", 0, 1),
		makePlacement("dc-east-r3", "S2", 1, 0),
		makePlacement("dc-east-r4", "G1", 1, 1),
	], "us_east" as RegionId);
	const contract = makeMarketContract("c-x", {
		monthlyPayment: 25_000,
		termMonths: 6,
		requirements: makeRequirements({ vCpu: 64, ramGb: 256, storageTb: 10, gpuFlops: 50 }),
	});
	const state = makeState({ datacenters: [dcWest, dcEast] });

	const candidates = scoreMarketContract(state, contract);

	assert.equal(candidates.length, 2);
	assert.ok(candidates[0]!.npv >= candidates[1]!.npv, "candidates must be sorted by NPV descending");
	// us_west has cheaper power than us_east, so it should win on equal capacity
	assert.equal(candidates[0]!.dcId, "dc-west");
});

test("scoreMarketContractForDatacenter — discount factor reduces NPV for longer terms", () => {
	const dc = makeDatacenter("dc-1");
	const baseReqs = makeRequirements({ vCpu: 32, ramGb: 128, storageTb: 5, gpuFlops: 25 });
	const shortContract = makeMarketContract("c-short", {
		monthlyPayment: 20_000,
		termMonths: 1,
		requirements: baseReqs,
	});
	const longContract = makeMarketContract("c-long", {
		monthlyPayment: 20_000,
		termMonths: 12,
		requirements: baseReqs,
	});
	const state = makeState({ datacenters: [dc] });

	const shortBreakdown = scoreMarketContractForDatacenter(state, shortContract, dc);
	const longBreakdown = scoreMarketContractForDatacenter(state, longContract, dc);

	// 12 months of revenue at the same monthly should be > 1 month, but per-month
	// value of last month is discounted (≈ 0.995^12 ≈ 0.94×). Long contract still
	// has higher total NPV; we're verifying the discount actually applies.
	assert.ok(longBreakdown.grossRevenue > shortBreakdown.grossRevenue);
	assert.ok(longBreakdown.grossRevenue / 12 < shortBreakdown.grossRevenue, "later months must be discounted");
});

test("scoreLiveContract — healthy live contract has positive remaining NPV", () => {
	const dc = makeDatacenter("dc-1");
	const live = makeLiveContract("live-1", dc.id, {
		monthlyPayment: 30_000,
		termMonths: 6,
		startedAtTick: 0 as Tick,
		requirements: makeRequirements({ vCpu: 64, ramGb: 256, storageTb: 10, gpuFlops: 50 }),
	});
	const state = makeState({
		datacenters: [dc],
		contracts: [live],
		tick: 2 as Tick,
	});

	const breakdown = scoreLiveContract(state, live);

	assert.equal(breakdown.fits, true);
	assert.ok(breakdown.npv > 0);
	assert.equal(breakdown.monthsValued, 4, "4 months remaining of 6-month term");
});

test("scoreLiveContract — breached contract reflects negative reliability impact", () => {
	const dc = makeDatacenter("dc-1");
	const live = makeLiveContract("live-breach", dc.id, {
		lifecycleState: "breached",
		status: "breached",
		breachStreakMonths: 1,
	});
	const state = makeState({
		datacenters: [dc],
		contracts: [live],
	});

	const breakdown = scoreLiveContract(state, live);

	assert.ok(breakdown.reliabilityValue < 0, "breached state encodes a reliability hit");
});

test("cancelReliabilityCashCost returns positive cash equivalent of -12 reliability", () => {
	const cost = cancelReliabilityCashCost();
	assert.equal(cost, 12 * DEFAULT_RELIABILITY_CASH_PER_POINT);
});

test("scoring is deterministic — same inputs give same NPV", () => {
	const dc = makeDatacenter("dc-1");
	const contract = makeMarketContract("c-det", { monthlyPayment: 25_000, termMonths: 6 });
	const state = makeState({ datacenters: [dc] });

	const first = scoreMarketContractForDatacenter(state, contract, dc).npv;
	const second = scoreMarketContractForDatacenter(state, contract, dc).npv;

	assert.equal(first, second);
});

test("scoreLiveContract — throws when contract is not live", () => {
	const dc = makeDatacenter("dc-1");
	const marketContract = makeMarketContract("market-only");
	const state = makeState({ datacenters: [dc], contracts: [marketContract] });

	assert.throws(() => scoreLiveContract(state, marketContract), /non-live/);
});

