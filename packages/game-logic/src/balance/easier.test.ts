import assert from "node:assert/strict";
import test from "node:test";

import {
	applyRackRecurringOpexMultiplier,
	applyRepairDurationMultiplier,
	EXTRA_MAINTENANCE_STAFF_WAGE_MULTIPLIER,
	maintenanceStaffWagePerHead,
	RACK_RECURRING_OPEX_MULTIPLIER,
	REPAIR_DURATION_MULTIPLIER,
	STARTER_TIER_RATIO,
} from "./easier.js";

test("easier balance helpers centralize the requested global discounts", () => {
	assert.equal(RACK_RECURRING_OPEX_MULTIPLIER, 0.8);
	assert.equal(EXTRA_MAINTENANCE_STAFF_WAGE_MULTIPLIER, 0.8);
	assert.equal(STARTER_TIER_RATIO, 0.5);
	assert.equal(REPAIR_DURATION_MULTIPLIER, 0.5);

	assert.equal(applyRackRecurringOpexMultiplier(1_000), 800);
	assert.equal(maintenanceStaffWagePerHead(6_000), 4_800);
	assert.equal(applyRepairDurationMultiplier(90), 45);
});
