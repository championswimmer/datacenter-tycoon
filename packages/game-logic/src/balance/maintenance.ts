import { applyRepairDurationMultiplier } from "./easier.js";
import type { RackKind } from "../types.js";

export const RACK_FAILURE_YEAR_ONE_AGE_MONTHS = 12;
export const RACK_FAILURE_YEAR_ONE_CHANCE = 0.02;
export const RACK_FAILURE_MAX_CHANCE = 0.6;
export const RACK_FAILURE_MAX_AGE_MONTHS = 72;
export const RACK_FAILURE_CURVE_EXPONENT = 1.5;

// Repair progress stays in days even though one simulation tick equals one month.
// This is also the canonical number of subticks in one monthly tick.
export const DAYS_PER_TICK = 30;
export const SUBTICKS_PER_TICK = DAYS_PER_TICK;
export const BASE_REPAIR_DAYS_BY_RACK_KIND: Readonly<Record<RackKind, number>> = {
	compute: applyRepairDurationMultiplier(6),
	memory: applyRepairDurationMultiplier(8),
	storage: applyRepairDurationMultiplier(10),
	gpu: applyRepairDurationMultiplier(18),
};

export const DEFAULT_MAINTENANCE_STAFF = 0;
export const MAX_MAINTENANCE_STAFF = 8;

export const BASE_REPAIR_SPEED_MULTIPLIER = 1;
export const REPAIR_SPEED_BONUS_PER_MAINTENANCE_STAFF = 0.25;
export const MAX_REPAIR_SPEED_MULTIPLIER = 3;

export function repairBaseDaysForRackKind(kind: RackKind): number {
	return BASE_REPAIR_DAYS_BY_RACK_KIND[kind];
}
