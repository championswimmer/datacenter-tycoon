import { DAYS_PER_TICK } from "../balance/index.js";
import type { Datacenter, GameState, RackPlacement, Subtick } from "../types.js";
import { advanceRackRepair, rackAgeMonths, rackDailyFailureChance, rackFailureChance } from "./maintenance.js";
import { rngFromState } from "./rng.js";
import { settleMonthlyTick } from "./tick.js";

function advanceDatacenterMaintenance(state: GameState): { datacenters: Datacenter[]; rngState: number } {
	const rng = rngFromState(state.rngState);
	const datacenters = state.datacenters.map((datacenter): Datacenter => ({
		...datacenter,
		placements: datacenter.placements.map((placement): RackPlacement => {
			if (placement.health === "repairing") {
				return advanceRackRepair(placement, datacenter.maintenanceStaff, state.difficulty);
			}

			const monthlyFailureChance = rackFailureChance(rackAgeMonths(state.tick, placement), state.difficulty);
			const dailyFailureChance = rackDailyFailureChance(monthlyFailureChance);
			if (rng.next() >= dailyFailureChance) {
				return placement;
			}

			return {
				...placement,
				health: "repairing",
				repairProgressDays: 0,
				lastFailureAtTick: state.tick,
				lastFailureAtSubtick: state.subtick,
			};
		}),
	}));

	return {
		datacenters,
		rngState: rng.state(),
	};
}

export function advanceSubtick(state: GameState): GameState {
	const nextSubtick = (state.subtick + 1) as Subtick;
	const maintenance = advanceDatacenterMaintenance(state);
	const maintenanceState: GameState = {
		...state,
		datacenters: maintenance.datacenters,
		rngState: maintenance.rngState,
	};
	if (nextSubtick < DAYS_PER_TICK) {
		return {
			...maintenanceState,
			subtick: nextSubtick,
		};
	}

	return settleMonthlyTick({
		...maintenanceState,
		subtick: 0,
	});
}
