import assert from "node:assert/strict";
import test from "node:test";

import {
	BASE_REPAIR_DAYS,
	DAYS_PER_TICK,
	DIFFICULTY_CONFIG,
	MAX_REPAIR_SPEED_MULTIPLIER,
} from "../balance/index.js";
import {
	advanceRackRepair,
	rackAgeMonths,
	rackFailureChance,
	rackFailureRiskView,
	repairDurationDays,
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

test("rackFailureChance uses the configured hard-mode yearly curve and clamps old racks", () => {
	assert.equal(rackFailureChance(0), 0);
	assert.equal(rackFailureChance(11), 0);
	assert.equal(rackFailureChance(12), DIFFICULTY_CONFIG.hard.failureCurvePct[1]! / 100);
	assert.equal(rackFailureChance(24), DIFFICULTY_CONFIG.hard.failureCurvePct[2]! / 100);
	assert.equal(rackFailureChance(60), DIFFICULTY_CONFIG.hard.failureCurvePct.at(-1)! / 100);
	assert.equal(rackFailureChance(84), DIFFICULTY_CONFIG.hard.failureCurvePct.at(-1)! / 100);
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

test("repairDurationDays halves the repair target in easy mode", () => {
	assert.equal(repairDurationDays("hard"), BASE_REPAIR_DAYS);
	assert.equal(repairDurationDays("easy"), BASE_REPAIR_DAYS * DIFFICULTY_CONFIG.easy.repairTimeMultiplier);

	const easyRepair = advanceRackRepair(repairingRack({ repairProgressDays: 10 }), 1, "easy");
	const hardRepair = advanceRackRepair(repairingRack({ repairProgressDays: 10 }), 1, "hard");
	assert.equal(easyRepair.health, "healthy");
	assert.equal(hardRepair.health, "repairing");
});

test("advanceRackRepair leaves healthy racks unchanged", () => {
	const { repairProgressDays: _repairProgressDays, ...healthyRack } = repairingRack({ health: "healthy" });
	assert.deepEqual(advanceRackRepair(healthyRack, 8), healthyRack);
});

test("rackFailureRiskView: healthy rack returns age-curve probability", () => {
	const rack = {
		id: rackPlacementId("rack-rv-1"),
		installedAtTick: tick(0),
		health: "healthy" as const,
	};
	const view = rackFailureRiskView(tick(12), rack);
	assert.equal(view.placementId, rack.id);
	assert.equal(view.ageMonths, 12);
	assert.equal(view.health, "healthy");
	assert.equal(view.failureProbability, rackFailureChance(12));
});

test("rackFailureRiskView: repairing rack returns probability 0", () => {
	const rack = {
		id: rackPlacementId("rack-rv-2"),
		installedAtTick: tick(0),
		health: "repairing" as const,
	};
	const view = rackFailureRiskView(tick(48), rack);
	assert.equal(view.placementId, rack.id);
	assert.equal(view.ageMonths, 48);
	assert.equal(view.health, "repairing");
	assert.equal(view.failureProbability, 0);
});

test("rackFailureRiskView: probability clamps at max-age cap for very old racks", () => {
	const rack = {
		id: rackPlacementId("rack-rv-3"),
		installedAtTick: tick(0),
		health: "healthy" as const,
	};
	const viewAtCap = rackFailureRiskView(tick(60), rack);
	const viewBeyondCap = rackFailureRiskView(tick(84), rack);
	assert.equal(viewAtCap.failureProbability, DIFFICULTY_CONFIG.hard.failureCurvePct.at(-1)! / 100);
	assert.equal(viewBeyondCap.failureProbability, DIFFICULTY_CONFIG.hard.failureCurvePct.at(-1)! / 100);
});

test("rackFailureRiskView: young rack has near-zero failure probability", () => {
	const rack = {
		id: rackPlacementId("rack-rv-4"),
		installedAtTick: tick(0),
		health: "healthy" as const,
	};
	const view = rackFailureRiskView(tick(1), rack);
	assert.equal(view.failureProbability, 0);
});
