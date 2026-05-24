import assert from "node:assert/strict";
import test from "node:test";

import { REGION_CATALOG } from "../catalog/regions.js";
import { generateMap } from "./mapgen.js";

test("generateMap returns a non-empty list of regions", () => {
	const map = generateMap(42);
	assert.ok(map.regions.length > 0);
	// Should contain all catalog regions (no synthetic global region)
	assert.equal(map.regions.length, 8);
});

test("generateMap is deterministic for the same seed", () => {
	const map1 = generateMap(42);
	const map2 = generateMap(42);
	assert.deepEqual(map1, map2);
});

test("generateMap produces different maps for different seeds", () => {
	const map1 = generateMap(42);
	const map2 = generateMap(43);
	// With high probability the maps differ; check at least one region has different power cost
	const differs = map1.regions.some((r, i) => r.powerCostPerKwh !== map2.regions[i].powerCostPerKwh);
	assert.ok(differs, "Expected different seeds to produce different power costs");
});

test("generated regions have valid numeric ranges", () => {
	const map = generateMap(42);
	for (const region of map.regions) {
		assert.ok(region.powerCostPerKwh > 0, `${region.name} power cost must be positive`);
		assert.ok(region.staffWage > 0, `${region.name} staff wage must be positive`);
		assert.ok(region.taxRate >= 0 && region.taxRate <= 1, `${region.name} tax rate must be between 0 and 1`);
		assert.ok(region.totalPowerAvailable > 0, `${region.name} total power must be positive`);
		assert.ok(region.totalStaffAvailable > 0, `${region.name} total staff must be positive`);
		assert.equal(region.powerUsed, 0, `${region.name} powerUsed should start at 0`);
		assert.equal(region.staffUsed, 0, `${region.name} staffUsed should start at 0`);
	}
});

test("generated regions preserve catalog names and ids", () => {
	const map = generateMap(42);
	const names = map.regions.map((r) => r.name);
	const ids = map.regions.map((r) => r.id);

	assert.ok(names.includes("US West"));
	assert.ok(names.includes("US East"));
	assert.ok(ids.includes("us_west"));
	assert.ok(ids.includes("us_east"));
});

test("generated regions stay within deterministic variation bands from the catalog baseline", () => {
	const map = generateMap(42);
	for (const region of map.regions) {
		const baseline = REGION_CATALOG[String(region.id)];
		assert.ok(baseline, `missing catalog baseline for ${String(region.id)}`);
		const minPower = Math.round(baseline.powerCostPerKwh * 0.9 * 100) / 100;
		const maxPower = Math.round(baseline.powerCostPerKwh * 1.1 * 100) / 100;
		const minWage = Math.round(baseline.staffWage * 0.95);
		const maxWage = Math.round(baseline.staffWage * 1.05);
		assert.ok(
			region.powerCostPerKwh >= minPower && region.powerCostPerKwh <= maxPower,
			`${region.name} power cost must stay within ±10% of catalog baseline`,
		);
		assert.ok(
			region.staffWage >= minWage && region.staffWage <= maxWage,
			`${region.name} staff wage must stay within ±5% of catalog baseline`,
		);
	}
});

test("generated regions preserve the intended location-economics clusters", () => {
	const byId = Object.fromEntries(generateMap(42).regions.map((region) => [String(region.id), region]));

	assert.ok(byId.us_west.powerCostPerKwh < byId.us_east.powerCostPerKwh);
	assert.ok(byId.eu_west.powerCostPerKwh > byId.us_east.powerCostPerKwh);
	assert.ok(byId.ap_southeast.powerCostPerKwh > byId.us_east.powerCostPerKwh);
	assert.ok(byId.sa_east.powerCostPerKwh > byId.me_central.powerCostPerKwh);

	assert.ok(byId.us_east.staffWage > byId.eu_west.staffWage);
	assert.ok(byId.eu_central.staffWage > byId.ap_southeast.staffWage);
	assert.ok(byId.ap_northeast.staffWage > byId.me_central.staffWage);
	assert.ok(byId.me_central.staffWage > byId.sa_east.staffWage);
});
