export const RACK_FAILURE_MAX_CHANCE = 0.5;
export const RACK_FAILURE_MAX_AGE_MONTHS = 36;

// Repair progress stays in days even though one simulation tick equals one month,
// so tick-time maintenance can remain deterministic without converting the whole sim to daily turns.
export const DAYS_PER_TICK = 30;
export const BASE_REPAIR_DAYS = DAYS_PER_TICK * 3;

export const DEFAULT_MAINTENANCE_STAFF = 0;

export const BASE_REPAIR_SPEED_MULTIPLIER = 1;
export const REPAIR_SPEED_BONUS_PER_MAINTENANCE_STAFF = 0.25;
export const MAX_REPAIR_SPEED_MULTIPLIER = 3;
