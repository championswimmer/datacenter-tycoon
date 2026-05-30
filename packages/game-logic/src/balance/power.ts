import { HOURS_PER_MONTH } from "../economy/constants.js";

// All installed racks consume a small always-on baseline even when no workload is assigned.
// This stays flat across rack types by design so balancing usage-based billing has one global knob.
export const RACK_IDLE_BASELINE_POWER_KW = 0.8;

// Active-rack opex power draw multiplier (0.6 means 40% reduction in billed power draw)
export const ACTIVE_RACK_POWER_MULTIPLIER = 0.6;


// Active-rack draw still comes from each rack spec's `powerDrawKw`; this helper constant only
// captures the conversion between instantaneous kW and monthly energy billing.
export const KWH_PER_KW_PER_MONTH = HOURS_PER_MONTH;

export function idleBaselinePowerForRackCount(rackCount: number): number {
	if (!Number.isFinite(rackCount) || rackCount <= 0) {
		return 0;
	}

	return rackCount * RACK_IDLE_BASELINE_POWER_KW;
}

export function monthlyKwhFromPowerKw(powerKw: number): number {
	if (!Number.isFinite(powerKw) || powerKw <= 0) {
		return 0;
	}

	return powerKw * KWH_PER_KW_PER_MONTH;
}
