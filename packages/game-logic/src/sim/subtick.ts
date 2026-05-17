import { DAYS_PER_TICK } from "../balance/index.js";
import type { GameState, Subtick } from "../types.js";
import { settleMonthlyTick } from "./tick.js";

export function advanceSubtick(state: GameState): GameState {
	const nextSubtick = (state.subtick + 1) as Subtick;
	if (nextSubtick < DAYS_PER_TICK) {
		return {
			...state,
			subtick: nextSubtick,
		};
	}

	return settleMonthlyTick({
		...state,
		subtick: 0,
	});
}
