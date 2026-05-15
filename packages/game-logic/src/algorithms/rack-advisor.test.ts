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
