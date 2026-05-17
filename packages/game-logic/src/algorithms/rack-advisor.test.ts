import assert from "node:assert/strict";
import test from "node:test";

import type { Datacenter, RackPlacement, RackPlacementId, Tick } from "../types.js";
import { recommendRackActions } from "./rack-advisor.js";
import {
	makeDatacenter,
	makeLiveContract,
	makeMarketContract,
	makePlacement,
	makeRequirements,
	makeState,
} from "./test-fixtures.js";

test("rack advisor — returns demand signal aggregated over market + live", () => {
	const dc = makeDatacenter("dc-1");
	const offer = makeMarketContract("offer-1", {
		requirements: makeRequirements({ vCpu: 100, ramGb: 500, storageTb: 0, gpuFlops: 50 }),
	});
	const live = makeLiveContract("live-1", dc.id, {
		requirements: makeRequirements({ vCpu: 200, ramGb: 1_000, storageTb: 0, gpuFlops: 0 }),
	});
	const state = makeState({ datacenters: [dc], contracts: [offer, live] });

	const report = recommendRackActions(state);

	// Market contributes full, live contributes half
	assert.equal(report.demandSignal.vCpu, 100 + 100);
	assert.equal(report.demandSignal.ramGb, 500 + 500);
});

test("rack advisor — recommends storage rack when market demands more storage than DC offers", () => {
	// Build a DC with no storage rack so storage headroom is small
	const dc: Datacenter = makeDatacenter("dc-1", [
		makePlacement("dc-1-r1", "C2", 0, 0),
		makePlacement("dc-1-r2", "M2", 0, 1),
	]);
	// Cold-storage offer requiring 1000 TB — DC can't fit
	const offer = makeMarketContract("offer-cold", {
		requirements: makeRequirements({ vCpu: 16, ramGb: 256, storageTb: 1_000, gpuFlops: 0 }),
		monthlyPayment: 25_000,
		termMonths: 24,
	});
	const state = makeState({ datacenters: [dc], contracts: [offer] });

	const report = recommendRackActions(state);

	const buyRecs = report.recommendations.filter((rec) => rec.kind === "buy");
	const storageBuys = buyRecs.filter((rec) => rec.kind === "buy" && rec.rackKind === "storage");
	assert.ok(storageBuys.length > 0, "expected at least one storage rack buy recommendation");
	const first = storageBuys[0]!;
	if (first.kind === "buy") {
		assert.ok(first.paybackMonths > 0 && first.paybackMonths <= 18);
		assert.ok(first.action.type === "PlaceRack");
	}
});

test("rack advisor — recommends replacing a rack under repair", () => {
	const repairingRack: RackPlacement = {
		...makePlacement("rack-broken", "C2", 0, 0),
		health: "repairing",
	};
	const dc = makeDatacenter("dc-1", [repairingRack]);
	const state = makeState({ datacenters: [dc] });

	const report = recommendRackActions(state);

	const replace = report.recommendations.find((rec) => rec.kind === "replace");
	assert.ok(replace, "expected at least one replace recommendation for repairing rack");
	if (replace?.kind === "replace") {
		assert.equal(replace.oldPlacementId, "rack-broken" as RackPlacementId);
		assert.equal(replace.actions.length, 2);
		assert.equal(replace.actions[0]!.type, "RemoveRack");
		assert.equal(replace.actions[1]!.type, "PlaceRack");
	}
});

test("rack advisor — recommendations are deterministic given same inputs", () => {
	const dc = makeDatacenter("dc-1", [
		makePlacement("dc-1-r1", "C2", 0, 0),
		makePlacement("dc-1-r2", "M2", 0, 1),
	]);
	const offer = makeMarketContract("offer-1", {
		requirements: makeRequirements({ vCpu: 16, ramGb: 256, storageTb: 1_000, gpuFlops: 0 }),
		monthlyPayment: 25_000,
		termMonths: 24,
	});
	const state = makeState({ datacenters: [dc], contracts: [offer], tick: 5 as Tick });

	const first = recommendRackActions(state);
	const second = recommendRackActions(state);

	assert.deepEqual(first.recommendations, second.recommendations);
	assert.deepEqual(first.demandSignal, second.demandSignal);
});

test("rack advisor — empty state returns empty recommendations", () => {
	const dc = makeDatacenter("empty-dc", []);
	const state = makeState({ datacenters: [dc] });

	const report = recommendRackActions(state);

	// May have buy recommendations (DC has open slots, baseline demand exists)
	// but no replacements and no upgrades.
	assert.equal(report.recommendations.filter((r) => r.kind === "replace").length, 0);
	assert.equal(report.recommendations.filter((r) => r.kind === "upgrade").length, 0);
});

test("rack advisor — respects limit option", () => {
	const dc = makeDatacenter("dc-1", []);
	const offer = makeMarketContract("offer-1", {
		requirements: makeRequirements({ vCpu: 16, ramGb: 256, storageTb: 1_000, gpuFlops: 0 }),
		monthlyPayment: 25_000,
		termMonths: 24,
	});
	const state = makeState({ datacenters: [dc], contracts: [offer] });

	const report = recommendRackActions(state, { limit: 2 });

	assert.ok(report.recommendations.length <= 2);
});

test("rack advisor — forecast mix weights market higher than live (forward-looking)", () => {
	const dc = makeDatacenter("dc-1");
	// Live mix is mostly compute, but the market is heavily memory — forecast should lean memory.
	const live = makeLiveContract("live-compute", dc.id, {
		requirements: makeRequirements({ vCpu: 500, ramGb: 100, storageTb: 0, gpuFlops: 0 }),
	});
	const offer = makeMarketContract("offer-memory", {
		requirements: makeRequirements({ vCpu: 50, ramGb: 4_000, storageTb: 0, gpuFlops: 0 }),
	});
	const state = makeState({ datacenters: [dc], contracts: [live, offer] });

	const report = recommendRackActions(state);

	assert.ok(report.marketDemandMix.memory > report.liveDemandMix.memory, "market mix should show more memory than live mix");
	assert.ok(report.forecastDemandMix.memory > report.liveDemandMix.memory, "forecast should be shifted toward market memory share");
});

test("rack advisor — recommends rebalancing when demand has shifted toward an under-represented kind", () => {
	// DC over-equipped on storage and starved for memory; the market is now
	// memory-heavy with no GPU demand and modest compute. Algorithm should
	// surface storage→memory and compute→memory swaps and the top swap
	// should land on a memory rack.
	const dc: Datacenter = makeDatacenter("dc-1", [
		makePlacement("dc-1-s1", "S2", 0, 0),
		makePlacement("dc-1-s2", "S2", 0, 1),
		makePlacement("dc-1-c1", "C2", 1, 0),
		makePlacement("dc-1-m1", "M2", 1, 1),
	]);
	// Strong memory-heavy market signal (no GPU demand, low storage, low compute)
	const memoryOffers = Array.from({ length: 3 }, (_, i) =>
		makeMarketContract(`mem-${i}`, {
			requirements: makeRequirements({ vCpu: 50, ramGb: 6_000, storageTb: 5, gpuFlops: 0 }),
			monthlyPayment: 35_000,
			termMonths: 8,
		}),
	);
	const state = makeState({
		datacenters: [dc],
		contracts: memoryOffers,
		tick: 4 as Tick,
	});

	const report = recommendRackActions(state);
	const rebalances = report.recommendations.filter((rec) => rec.kind === "rebalance");

	assert.ok(rebalances.length > 0, "expected at least one rebalance recommendation");
	// Top recommendation should swap toward the dominant-demand kind.
	const first = rebalances[0]!;
	if (first.kind === "rebalance") {
		assert.equal(first.newRackKind, "memory", "should swap in toward the dominant memory demand");
		assert.ok(first.expectedMonthlyNet > 0);
		assert.ok(first.paybackMonths > 0 && first.paybackMonths <= 18);
		assert.equal(first.actions.length, 2);
		assert.equal(first.actions[0]!.type, "RemoveRack");
		assert.equal(first.actions[1]!.type, "PlaceRack");
	}
	// The storage→memory swap the user specifically asked about must also surface.
	const storageToMemory = rebalances.some(
		(rec) => rec.kind === "rebalance" && rec.oldRackKind === "storage" && rec.newRackKind === "memory",
	);
	assert.ok(storageToMemory, "expected a storage→memory swap among the rebalance suggestions");
});

test("rack advisor — refuses to rebalance away capacity that live contracts depend on", () => {
	// DC with one storage rack and a live storage-heavy contract that needs
	// most of that capacity. Even if memory demand is rising, swapping the
	// storage rack would breach the live contract. Advisor must skip.
	const dc: Datacenter = makeDatacenter("dc-1", [
		makePlacement("dc-1-s1", "S2", 0, 0),
		makePlacement("dc-1-c1", "C2", 0, 1),
		makePlacement("dc-1-m1", "M2", 1, 0),
		makePlacement("dc-1-g1", "G1", 1, 1),
	]);
	const liveStorage = makeLiveContract("live-storage", dc.id, {
		requirements: makeRequirements({ vCpu: 16, ramGb: 64, storageTb: 1_100, gpuFlops: 0 }),
		termMonths: 24,
		startedAtTick: 0 as Tick,
	});
	const memoryOffer = makeMarketContract("offer-mem", {
		requirements: makeRequirements({ vCpu: 50, ramGb: 5_000, storageTb: 5, gpuFlops: 0 }),
		monthlyPayment: 40_000,
		termMonths: 8,
	});
	const state = makeState({
		datacenters: [dc],
		contracts: [liveStorage, memoryOffer],
		tick: 1 as Tick,
	});

	const report = recommendRackActions(state);
	const rebalances = report.recommendations.filter(
		(rec) => rec.kind === "rebalance" && rec.oldRackKind === "storage",
	);

	assert.equal(
		rebalances.length,
		0,
		"must not propose swapping out the storage rack that the live contract depends on",
	);
});

test("rack advisor — rebalance suggestion reports the demand drift in the reason", () => {
	const dc: Datacenter = makeDatacenter("dc-1", [
		makePlacement("dc-1-s1", "S2", 0, 0),
		makePlacement("dc-1-c1", "C2", 0, 1),
		makePlacement("dc-1-m1", "M2", 1, 0),
		makePlacement("dc-1-g1", "G1", 1, 1),
	]);
	const memoryOffers = Array.from({ length: 3 }, (_, i) =>
		makeMarketContract(`mem-${i}`, {
			requirements: makeRequirements({ vCpu: 50, ramGb: 6_000, storageTb: 5, gpuFlops: 0 }),
			monthlyPayment: 35_000,
			termMonths: 8,
		}),
	);
	const state = makeState({ datacenters: [dc], contracts: memoryOffers });

	const report = recommendRackActions(state);
	const rebalance = report.recommendations.find((rec) => rec.kind === "rebalance");

	assert.ok(rebalance, "expected a rebalance recommendation");
	if (rebalance?.kind === "rebalance") {
		assert.match(rebalance.reason, /MEMORY|STORAGE/, "reason should call out the kinds involved");
		assert.match(rebalance.reason, /\/mo/, "reason should quantify monthly impact");
		assert.match(rebalance.reason, /payback/, "reason should include payback");
	}
});

test("rack advisor — unmet demand reflects oversized contracts", () => {
	const dc = makeDatacenter("dc-1", [
		makePlacement("dc-1-r1", "C2", 0, 0),
		makePlacement("dc-1-r2", "M2", 0, 1),
	]);
	// Huge storage requirement, no storage rack in DC
	const offer = makeMarketContract("offer-cold", {
		requirements: makeRequirements({ vCpu: 16, ramGb: 256, storageTb: 5_000, gpuFlops: 0 }),
	});
	const state = makeState({ datacenters: [dc], contracts: [offer] });

	const report = recommendRackActions(state);

	assert.ok(report.unmetDemand.storageTb > 0, "expected unmet storage demand to be non-zero");
});
