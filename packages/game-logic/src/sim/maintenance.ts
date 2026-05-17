import {
	BASE_REPAIR_DAYS,
	BASE_REPAIR_SPEED_MULTIPLIER,
	DEFAULT_DIFFICULTY,
	DAYS_PER_TICK,
	DIFFICULTY_CONFIG,
	MAX_REPAIR_SPEED_MULTIPLIER,
	REPAIR_SPEED_BONUS_PER_MAINTENANCE_STAFF,
} from "../balance/index.js";
import type { Difficulty, Rack, RackPlacement, RackHealthStatus, RackPlacementId, Tick } from "../types.js";

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

export function rackAgeMonths(currentTick: Tick, rack: Pick<Rack, "installedAtTick">): number {
	return Math.max(0, currentTick - rack.installedAtTick);
}

export function rackFailureChance(ageMonths: number, difficulty: Difficulty = DEFAULT_DIFFICULTY): number {
	const failureCurve = DIFFICULTY_CONFIG[difficulty].failureCurvePct;
	const clampedYearIndex = clamp(Math.floor(Math.max(0, ageMonths) / 12), 0, failureCurve.length - 1);
	return failureCurve[clampedYearIndex]! / 100;
}

export function rackDailyFailureChance(monthlyChance: number): number {
	if (monthlyChance <= 0) {
		return 0;
	}
	if (monthlyChance >= 1) {
		return 1;
	}

	return 1 - (1 - monthlyChance) ** (1 / DAYS_PER_TICK);
}

export function repairSpeedMultiplier(maintenanceStaff: number): number {
	const extraStaff = Math.max(0, maintenanceStaff);
	return clamp(
		BASE_REPAIR_SPEED_MULTIPLIER + extraStaff * REPAIR_SPEED_BONUS_PER_MAINTENANCE_STAFF,
		BASE_REPAIR_SPEED_MULTIPLIER,
		MAX_REPAIR_SPEED_MULTIPLIER,
	);
}

export function repairProgressPerSubtick(maintenanceStaff: number): number {
	return repairSpeedMultiplier(maintenanceStaff);
}

export function repairProgressPerTick(maintenanceStaff: number): number {
	return DAYS_PER_TICK * repairProgressPerSubtick(maintenanceStaff);
}

export function repairDurationDays(difficulty: Difficulty = DEFAULT_DIFFICULTY): number {
	return BASE_REPAIR_DAYS * DIFFICULTY_CONFIG[difficulty].repairTimeMultiplier;
}

// ── Rack failure-risk view ───────────────────────────────────────────────────

/**
 * A derived, read-only snapshot of a single rack's current age and failure risk.
 * Clients should import this type and `rackFailureRiskView()` instead of
 * composing `rackAgeMonths()` + `rackFailureChance()` by hand — the canonical
 * policy (e.g. how repairing racks are represented) lives here.
 */
export interface RackFailureRiskView {
	/** The rack placement id this view is derived from. */
	placementId: RackPlacementId;
	/** Age of the rack in months (ticks since installation). */
	ageMonths: number;
	/** Current health status from the placement record. */
	health: RackHealthStatus;
	/**
	 * Monthly failure probability in the range [0, 1].
	 * Returns 0 for racks that are currently `repairing` — they have already
	 * failed and cannot newly fail while under repair.
	 */
	failureProbability: number;
}

/**
 * Derive a rack's current failure-risk view from the game state.
 *
 * Use this as the single canonical way to read rack age and monthly failure
 * probability from game state — both CLI and web consumers should call this
 * instead of composing maintenance helpers ad-hoc.
 *
 * @param currentTick - The current game tick (= months elapsed).
 * @param rack        - The rack placement (or any object with the required fields).
 * @returns A stable, serializable `RackFailureRiskView`.
 */
export function rackFailureRiskView(
	currentTick: Tick,
	rack: Pick<Rack, "id" | "installedAtTick" | "health">,
	difficulty: Difficulty = DEFAULT_DIFFICULTY,
): RackFailureRiskView {
	const ageMonths = rackAgeMonths(currentTick, rack);
	return {
		placementId: rack.id,
		ageMonths,
		health: rack.health,
		// Repairing racks have already failed — they cannot newly fail while
		// under repair, so we return 0 rather than the age-curve value.
		failureProbability: rack.health === "repairing" ? 0 : rackFailureChance(ageMonths, difficulty),
	};
}

export function rackDailyFailureRiskView(
	currentTick: Tick,
	rack: Pick<Rack, "id" | "installedAtTick" | "health">,
	difficulty: Difficulty = DEFAULT_DIFFICULTY,
): RackFailureRiskView {
	const monthlyRisk = rackFailureRiskView(currentTick, rack, difficulty);
	return {
		...monthlyRisk,
		failureProbability: rack.health === "repairing" ? 0 : rackDailyFailureChance(monthlyRisk.failureProbability),
	};
}

export function advanceRackRepair(
	rack: RackPlacement,
	maintenanceStaff: number,
	difficulty: Difficulty = DEFAULT_DIFFICULTY,
): RackPlacement {
	if (rack.health !== "repairing") {
		return rack;
	}

	const nextRepairProgressDays = (rack.repairProgressDays ?? 0) + repairProgressPerSubtick(maintenanceStaff);
	if (nextRepairProgressDays < repairDurationDays(difficulty)) {
		return {
			...rack,
			repairProgressDays: nextRepairProgressDays,
		};
	}

	const { repairProgressDays: _repairProgressDays, ...repairedRack } = rack;
	return {
		...repairedRack,
		health: "healthy",
	};
}
