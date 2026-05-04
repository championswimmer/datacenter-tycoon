import assert from "node:assert/strict";
import test from "node:test";

import {
	BASE_REPAIR_DAYS,
	DAYS_PER_TICK,
	MAX_REPAIR_SPEED_MULTIPLIER,
	RACK_FAILURE_MAX_CHANCE,
	RACK_FAILURE_MAX_AGE_MONTHS,
} from "../balance/index.js";
import {
	advanceRackRepair,
	rackAgeMonths,
	rackFailureChance,
	repairProgressPerTick,
	repairSpeedMultiplier,
} from "./maintenance.js";
import type { RackPlacement, RackPlacementId, RackSpecId, Tick } from "../types.js";

const rackPlacementId = (value: string): RackPlacementId => value as RackPlacementId;
const rackSpecId = (value: string): RackSpecId => value as RackSpecId;
const tick = (value: number): Tick => value as Tick;

function repairingRack(overrides: Partial<RackPlacement> = {}): RackPlacement {
	return {
		id: rackPlacementId("rack-1"),
		specId: rackSpecId("C1"),
		kind: "compute",
		installedAtTick: tick(0),
		health: "repairing",
		repairProgressDays: 0,
		row: 0,
		position: 0,
		...overrides,
	};
}

test("rackAgeMonths never goes below zero", () => {
	assert.equal(rackAgeMonths(tick(12), { installedAtTick: tick(6) }), 6);
	assert.equal(rackAgeMonths(tick(3), { installedAtTick: tick(6) }), 0);
});

test("rackFailureChance follows the planned linear curve and cap", () => {
	assert.equal(rackFailureChance(0), 0);
	assert.equal(rackFailureChance(18), 0.25);
	assert.equal(rackFailureChance(RACK_FAILURE_MAX_AGE_MONTHS), RACK_FAILURE_MAX_CHANCE);
	assert.equal(rackFailureChance(60), RACK_FAILURE_MAX_CHANCE);
});

test("repair speed scales with maintenance staff and clamps at the configured max", () => {
	assert.equal(repairSpeedMultiplier(0), 1);
	assert.equal(repairSpeedMultiplier(4), 2);
	assert.equal(repairSpeedMultiplier(40), MAX_REPAIR_SPEED_MULTIPLIER);

	assert.equal(repairProgressPerTick(0), DAYS_PER_TICK);
	assert.equal(repairProgressPerTick(4), DAYS_PER_TICK * 2);
	assert.equal(repairProgressPerTick(40), DAYS_PER_TICK * MAX_REPAIR_SPEED_MULTIPLIER);
});

test("advanceRackRepair uses current staffing and clears repair progress when complete", () => {
	const inProgress = advanceRackRepair(repairingRack({ repairProgressDays: 10 }), 1);
	assert.equal(inProgress.health, "repairing");
	assert.equal(inProgress.repairProgressDays, 47.5);

	const completed = advanceRackRepair(repairingRack({ repairProgressDays: BASE_REPAIR_DAYS - 10 }), 1);
	assert.equal(completed.health, "healthy");
	assert.equal("repairProgressDays" in completed, false);
});

test("advanceRackRepair leaves healthy racks unchanged", () => {
	const { repairProgressDays: _repairProgressDays, ...healthyRack } = repairingRack({ health: "healthy" });
	assert.deepEqual(advanceRackRepair(healthyRack, 8), healthyRack);
});
