import assert from "node:assert/strict";
import test from "node:test";

import { generateMap } from "./mapgen.js";

test("generateMap returns a non-empty list of regions", () => {
	const map = generateMap(42);
	assert.ok(map.regions.length > 0);
	// Should contain all catalog regions (no synthetic global region)
	assert.ok(map.regions.length >= 10);
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

	assert.ok(names.includes("Silicon Valley"));
	assert.ok(names.includes("Iowa"));
	assert.ok(ids.includes("silicon_valley"));
	assert.ok(ids.includes("iowa"));
});
