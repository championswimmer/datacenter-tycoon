import {
	BASE_REPAIR_DAYS,
	BASE_REPAIR_SPEED_MULTIPLIER,
	DAYS_PER_TICK,
	MAX_REPAIR_SPEED_MULTIPLIER,
	RACK_FAILURE_MAX_AGE_MONTHS,
	RACK_FAILURE_MAX_CHANCE,
	REPAIR_SPEED_BONUS_PER_MAINTENANCE_STAFF,
} from "../balance/index.js";
import type { Rack, RackPlacement, Tick } from "../types.js";

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

export function rackAgeMonths(currentTick: Tick, rack: Pick<Rack, "installedAtTick">): number {
	return Math.max(0, currentTick - rack.installedAtTick);
}

export function rackFailureChance(ageMonths: number): number {
	const normalizedAge = clamp(ageMonths, 0, RACK_FAILURE_MAX_AGE_MONTHS);
	return (normalizedAge / RACK_FAILURE_MAX_AGE_MONTHS) * RACK_FAILURE_MAX_CHANCE;
}

export function repairSpeedMultiplier(maintenanceStaff: number): number {
	const extraStaff = Math.max(0, maintenanceStaff);
	return clamp(
		BASE_REPAIR_SPEED_MULTIPLIER + extraStaff * REPAIR_SPEED_BONUS_PER_MAINTENANCE_STAFF,
		BASE_REPAIR_SPEED_MULTIPLIER,
		MAX_REPAIR_SPEED_MULTIPLIER,
	);
}

export function repairProgressPerTick(maintenanceStaff: number): number {
	return DAYS_PER_TICK * repairSpeedMultiplier(maintenanceStaff);
}

export function advanceRackRepair(rack: RackPlacement, maintenanceStaff: number): RackPlacement {
	if (rack.health !== "repairing") {
		return rack;
	}

	const nextRepairProgressDays = (rack.repairProgressDays ?? 0) + repairProgressPerTick(maintenanceStaff);
	if (nextRepairProgressDays < BASE_REPAIR_DAYS) {
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
