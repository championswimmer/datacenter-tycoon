import { DAYS_PER_TICK } from "../balance/index.js";
import type { Datacenter, GameState, RackPlacement, Subtick } from "../types.js";
import { advanceRackRepair } from "./maintenance.js";
import { settleMonthlyTick } from "./tick.js";

function advanceDatacenterRepairs(state: GameState): Datacenter[] {
	return state.datacenters.map((datacenter): Datacenter => ({
		...datacenter,
		placements: datacenter.placements.map((placement): RackPlacement =>
			placement.health === "repairing"
				? advanceRackRepair(placement, datacenter.maintenanceStaff, state.difficulty)
				: placement,
		),
	}));
}

export function advanceSubtick(state: GameState): GameState {
	const nextSubtick = (state.subtick + 1) as Subtick;
	const maintenanceState: GameState = {
		...state,
		datacenters: advanceDatacenterRepairs(state),
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
