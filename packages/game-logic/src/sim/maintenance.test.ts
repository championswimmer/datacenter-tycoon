import assert from "node:assert/strict";
import test from "node:test";

import {
	BASE_REPAIR_DAYS_BY_RACK_KIND,
	DAYS_PER_TICK,
	DIFFICULTY_CONFIG,
	MAX_REPAIR_SPEED_MULTIPLIER,
} from "../balance/index.js";
import {
	advanceRackRepair,
	rackAgeMonths,
	rackDailyFailureChance,
	rackFailureChance,
	rackFailureRiskView,
	repairDurationDays,
	repairProgressPerSubtick,
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

test("rackFailureChance halves the yearly failure curve in easy mode", () => {
	assert.equal(rackFailureChance(12, "easy"), DIFFICULTY_CONFIG.easy.failureCurvePct[1]! / 100);
	assert.equal(rackFailureChance(24, "easy"), DIFFICULTY_CONFIG.easy.failureCurvePct[2]! / 100);
	assert.equal(rackFailureChance(60, "easy"), DIFFICULTY_CONFIG.easy.failureCurvePct.at(-1)! / 100);
	assert.equal(rackFailureChance(24, "easy"), rackFailureChance(24, "hard") / 2);
});

test("rackDailyFailureChance preserves the equivalent monthly hazard", () => {
	const monthlyChance = 0.32;
	const dailyChance = rackDailyFailureChance(monthlyChance);
	const recomposedMonthlyChance = 1 - (1 - dailyChance) ** DAYS_PER_TICK;

	assert.ok(dailyChance > 0);
	assert.ok(dailyChance < monthlyChance);
	assert.ok(Math.abs(recomposedMonthlyChance - monthlyChance) < 1e-12);
	assert.equal(rackDailyFailureChance(0), 0);
	assert.equal(rackDailyFailureChance(1), 1);
});

test("repair speed scales with maintenance staff and clamps at the configured max", () => {
	assert.equal(repairSpeedMultiplier(0), 1);
	assert.equal(repairSpeedMultiplier(4), 2);
	assert.equal(repairSpeedMultiplier(40), MAX_REPAIR_SPEED_MULTIPLIER);

	assert.equal(repairProgressPerSubtick(0), 1);
	assert.equal(repairProgressPerSubtick(4), 2);
	assert.equal(repairProgressPerSubtick(40), MAX_REPAIR_SPEED_MULTIPLIER);
	assert.equal(repairProgressPerTick(0), DAYS_PER_TICK);
	assert.equal(repairProgressPerTick(4), DAYS_PER_TICK * 2);
	assert.equal(repairProgressPerTick(40), DAYS_PER_TICK * MAX_REPAIR_SPEED_MULTIPLIER);
});

test("advanceRackRepair uses current staffing and clears repair progress when complete", () => {
	const inProgress = advanceRackRepair(repairingRack({ repairProgressDays: 1 }), 1);
	assert.equal(inProgress.health, "repairing");
	assert.equal(inProgress.repairProgressDays, 2.25);

	const completed = advanceRackRepair(repairingRack({ repairProgressDays: BASE_REPAIR_DAYS_BY_RACK_KIND.compute - 1 }), 1);
	assert.equal(completed.health, "healthy");
	assert.equal("repairProgressDays" in completed, false);
});

test("repairDurationDays now varies by rack kind while keeping non-GPU repairs to a few days", () => {
	assert.deepEqual(BASE_REPAIR_DAYS_BY_RACK_KIND, {
		compute: 3,
		memory: 4,
		storage: 5,
		gpu: 9,
	});
	assert.equal(repairDurationDays("compute", "hard"), BASE_REPAIR_DAYS_BY_RACK_KIND.compute);
	assert.equal(repairDurationDays("memory", "hard"), BASE_REPAIR_DAYS_BY_RACK_KIND.memory);
	assert.equal(repairDurationDays("storage", "hard"), BASE_REPAIR_DAYS_BY_RACK_KIND.storage);
	assert.equal(repairDurationDays("gpu", "hard"), BASE_REPAIR_DAYS_BY_RACK_KIND.gpu);
	assert.equal(repairDurationDays("compute", "easy"), BASE_REPAIR_DAYS_BY_RACK_KIND.compute * DIFFICULTY_CONFIG.easy.repairTimeMultiplier);
	assert.equal(repairDurationDays("gpu", "easy"), BASE_REPAIR_DAYS_BY_RACK_KIND.gpu * DIFFICULTY_CONFIG.easy.repairTimeMultiplier);

	const easyRepair = advanceRackRepair(repairingRack({ repairProgressDays: 1.5 }), 0, "easy");
	const hardRepair = advanceRackRepair(repairingRack({ repairProgressDays: 1.5 }), 0, "hard");
	assert.equal(easyRepair.health, "healthy");
	assert.equal(hardRepair.health, "repairing");
});

test("advanceRackRepair completes compute repairs in roughly 2-3 subticks at baseline staffing", () => {
	let hardRack = repairingRack({ kind: "compute" });
	let easyRack = repairingRack();
	for (let day = 0; day < 2; day += 1) {
		hardRack = advanceRackRepair(hardRack, 0, "hard");
		easyRack = advanceRackRepair(easyRack, 0, "easy");
	}
	assert.equal(hardRack.health, "repairing");
	assert.equal(easyRack.health, "repairing");

	const hardOnDayThree = advanceRackRepair(hardRack, 0, "hard");
	const easyOnDayThree = advanceRackRepair(easyRack, 0, "easy");
	assert.equal(hardOnDayThree.health, "healthy");
	assert.equal(easyOnDayThree.health, "healthy");
});

test("advanceRackRepair keeps GPU racks down materially longer than compute racks at baseline staffing", () => {
	let gpuRack = repairingRack({ kind: "gpu", specId: rackSpecId("G1") });
	for (let day = 0; day < 8; day += 1) {
		gpuRack = advanceRackRepair(gpuRack, 0, "hard");
	}
	assert.equal(gpuRack.health, "repairing");

	gpuRack = advanceRackRepair(gpuRack, 0, "hard");
	assert.equal(gpuRack.health, "healthy");
});

test("extra maintenance staff reduces GPU repair time as well as compute repair time", () => {
	let baselineGpuRack = repairingRack({ kind: "gpu", specId: rackSpecId("G1") });
	let staffedGpuRack = repairingRack({ kind: "gpu", specId: rackSpecId("G1") });
	for (let day = 0; day < 5; day += 1) {
		baselineGpuRack = advanceRackRepair(baselineGpuRack, 0, "hard");
		staffedGpuRack = advanceRackRepair(staffedGpuRack, 4, "hard");
	}
	assert.equal(baselineGpuRack.health, "repairing");
	assert.equal(staffedGpuRack.health, "healthy");
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
