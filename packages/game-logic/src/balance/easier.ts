import type { Money } from "../types.js";

/**
 * The global easier-balance pass treats rack `monthlyMaintenance` as the
 * canonical rack-side recurring opex lever because rack specs do not carry a
 * separate per-rack staffing field today.
 */
export const RACK_RECURRING_OPEX_MULTIPLIER = 0.8;

/**
 * Only extra maintenance staffing gets the easier-pass wage discount.
 * Baseline datacenter staffing remains tied to the region's base wage.
 */
export const EXTRA_MAINTENANCE_STAFF_WAGE_MULTIPLIER = 0.8;

/** Use 50% of tier-1 hardware to define the new starter tier. */
export const STARTER_TIER_RATIO = 0.5;

/** Global easier-pass target: halve the pre-difficulty repair baseline. */
export const REPAIR_DURATION_MULTIPLIER = 0.5;

function roundMoney(value: number): Money {
	return Math.round(value * 100) / 100;
}

export function applyRackRecurringOpexMultiplier(monthlyMaintenance: Money): Money {
	return roundMoney(monthlyMaintenance * RACK_RECURRING_OPEX_MULTIPLIER);
}

export function maintenanceStaffWagePerHead(baseStaffWage: Money): Money {
	return roundMoney(baseStaffWage * EXTRA_MAINTENANCE_STAFF_WAGE_MULTIPLIER);
}

export function applyRepairDurationMultiplier(baseRepairDays: number): number {
	return baseRepairDays * REPAIR_DURATION_MULTIPLIER;
}
