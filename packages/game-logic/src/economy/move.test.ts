import assert from "node:assert/strict";
import test from "node:test";

import { RACK_CATALOG } from "../catalog/racks.js";
import type { RegionId } from "../types.js";
import {
	calculateMoveCost,
	CROSS_REGION_MOVE_COST_PERCENT,
	SAME_REGION_MOVE_COST_PERCENT,
} from "./move.js";

test("returns 10% of capex for same-region move", () => {
	const c1 = RACK_CATALOG.C1;
	const region = "us-east-1" as RegionId;
	const cost = calculateMoveCost(c1, region, region);
	assert.equal(cost, Math.round(c1.capexCost * SAME_REGION_MOVE_COST_PERCENT));
});

test("returns 25% of capex for cross-region move", () => {
	const c1 = RACK_CATALOG.C1;
	const source = "us-east-1" as RegionId;
	const target = "eu-west-1" as RegionId;
	const cost = calculateMoveCost(c1, source, target);
	assert.equal(cost, Math.round(c1.capexCost * CROSS_REGION_MOVE_COST_PERCENT));
});

test("same-region cost is cheaper than cross-region for same spec", () => {
	const g3 = RACK_CATALOG.G3;
	const source = "us-east-1" as RegionId;
	const target = "eu-west-1" as RegionId;
	const sameRegionCost = calculateMoveCost(g3, source, source);
	const crossRegionCost = calculateMoveCost(g3, source, target);
	assert.ok(sameRegionCost < crossRegionCost);
});
