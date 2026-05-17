const STORAGE_KEY = "datacenter-tycoon:autopilot-v1";

export interface AutopilotPreferences {
	enabled: boolean;
	cashBufferMonths: number;
	minNpvDelta: number;
	maxActionsPerTick: number;
}

export const DEFAULT_AUTOPILOT_PREFERENCES: AutopilotPreferences = {
	enabled: false,
	cashBufferMonths: 2,
	minNpvDelta: 1,
	maxActionsPerTick: 4,
};

export function loadAutopilotPreferences(): AutopilotPreferences {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return DEFAULT_AUTOPILOT_PREFERENCES;
		const parsed = JSON.parse(raw) as Partial<AutopilotPreferences>;
		return {
			enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULT_AUTOPILOT_PREFERENCES.enabled,
			cashBufferMonths: typeof parsed.cashBufferMonths === "number" ? parsed.cashBufferMonths : DEFAULT_AUTOPILOT_PREFERENCES.cashBufferMonths,
			minNpvDelta: typeof parsed.minNpvDelta === "number" ? parsed.minNpvDelta : DEFAULT_AUTOPILOT_PREFERENCES.minNpvDelta,
			maxActionsPerTick: typeof parsed.maxActionsPerTick === "number" ? parsed.maxActionsPerTick : DEFAULT_AUTOPILOT_PREFERENCES.maxActionsPerTick,
		};
	} catch {
		return DEFAULT_AUTOPILOT_PREFERENCES;
	}
}

export function saveAutopilotPreferences(prefs: AutopilotPreferences): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
	} catch {
		// Quota or disabled storage — silently ignore. The autopilot still works
		// for the current session; preference just won't persist.
	}
}
