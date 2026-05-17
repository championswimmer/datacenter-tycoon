import { useSyncExternalStore } from "react";
import type { AutopilotPlan } from "@datacenter-tycoon/game-logic";
import {
	DEFAULT_AUTOPILOT_PREFERENCES,
	loadAutopilotPreferences,
	saveAutopilotPreferences,
	type AutopilotPreferences,
} from "./autopilotPersist.js";

type Listener = () => void;

export interface AutopilotRunnerStatus {
	lastTickRun: number;
	lastPlan: AutopilotPlan | null;
	totalActionsDispatched: number;
}

const INITIAL_STATUS: AutopilotRunnerStatus = {
	lastTickRun: -1,
	lastPlan: null,
	totalActionsDispatched: 0,
};

interface AutopilotStoreShape {
	preferences: AutopilotPreferences;
	runnerStatus: AutopilotRunnerStatus;
}

interface AutopilotStore {
	getPreferences: () => AutopilotPreferences;
	getRunnerStatus: () => AutopilotRunnerStatus;
	updatePreferences: (patch: Partial<AutopilotPreferences>) => void;
	setRunnerStatus: (next: AutopilotRunnerStatus) => void;
	subscribePreferences: (listener: Listener) => () => void;
	subscribeRunnerStatus: (listener: Listener) => () => void;
}

function createAutopilotStore(): AutopilotStore {
	let state: AutopilotStoreShape = {
		preferences: typeof window === "undefined" ? DEFAULT_AUTOPILOT_PREFERENCES : loadAutopilotPreferences(),
		runnerStatus: INITIAL_STATUS,
	};
	const preferenceListeners = new Set<Listener>();
	const statusListeners = new Set<Listener>();

	const notify = (listeners: Set<Listener>) => {
		for (const listener of [...listeners]) {
			listener();
		}
	};

	return {
		getPreferences: () => state.preferences,
		getRunnerStatus: () => state.runnerStatus,
		updatePreferences: (patch) => {
			state = { ...state, preferences: { ...state.preferences, ...patch } };
			saveAutopilotPreferences(state.preferences);
			notify(preferenceListeners);
		},
		setRunnerStatus: (next) => {
			state = { ...state, runnerStatus: next };
			notify(statusListeners);
		},
		subscribePreferences: (listener) => {
			preferenceListeners.add(listener);
			return () => {
				preferenceListeners.delete(listener);
			};
		},
		subscribeRunnerStatus: (listener) => {
			statusListeners.add(listener);
			return () => {
				statusListeners.delete(listener);
			};
		},
	};
}

export const autopilotStore = createAutopilotStore();

export function useAutopilotPreferences(): AutopilotPreferences {
	return useSyncExternalStore(
		autopilotStore.subscribePreferences,
		autopilotStore.getPreferences,
		() => DEFAULT_AUTOPILOT_PREFERENCES,
	);
}

export function useAutopilotRunnerStatus(): AutopilotRunnerStatus {
	return useSyncExternalStore(
		autopilotStore.subscribeRunnerStatus,
		autopilotStore.getRunnerStatus,
		() => INITIAL_STATUS,
	);
}
