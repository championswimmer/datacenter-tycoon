import { useEffect, useRef } from "react";
import { planContractAutopilot } from "@datacenter-tycoon/game-logic";
import { autopilotStore } from "./autopilotStore.js";
import { useGameDispatch, useFullGameState } from "./storeContext.js";

/**
 * Drives the contract autopilot. Should be mounted exactly once near the root
 * (we mount it in Shell). When the autopilot preference is enabled, the hook
 * runs `planContractAutopilot` after each game tick and dispatches the
 * resulting actions through the same reducer path a human player would use.
 *
 * Status (last plan + cumulative dispatched count) lands in `autopilotStore`,
 * so pages can read it via `useAutopilotRunnerStatus()` without re-mounting
 * the dispatcher (which would double-dispatch every tick).
 *
 * Determinism: `planContractAutopilot` is a pure function of GameState +
 * preferences. The runner only adds wall-clock-tick edge detection on top.
 */
export function useAutopilotRunner(): void {
	const dispatch = useGameDispatch();
	const state = useFullGameState();
	const lastProcessedTickRef = useRef<number>(state.tick);

	useEffect(() => {
		const prefs = autopilotStore.getPreferences();
		if (!prefs.enabled) {
			lastProcessedTickRef.current = state.tick;
			return;
		}

		if (state.tick === lastProcessedTickRef.current) {
			return;
		}

		lastProcessedTickRef.current = state.tick;
		const plan = planContractAutopilot(state, {
			cashBufferMonths: prefs.cashBufferMonths,
			minNpvDelta: prefs.minNpvDelta,
			maxActions: prefs.maxActionsPerTick,
		});

		for (const step of plan.actions) {
			dispatch(step.action);
		}

		const previous = autopilotStore.getRunnerStatus();
		autopilotStore.setRunnerStatus({
			lastTickRun: state.tick,
			lastPlan: plan,
			totalActionsDispatched: previous.totalActionsDispatched + plan.actions.length,
		});
	}, [state, dispatch]);
}
