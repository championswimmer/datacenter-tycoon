import type { GameState } from "../types.js";

export const SAVE_VERSION = 1;

export interface SaveEnvelope {
	saveVersion: number;
	state: GameState;
}

function isSaveEnvelope(value: unknown): value is SaveEnvelope {
	if (!value || typeof value !== "object") {
		return false;
	}

	return "saveVersion" in value && "state" in value;
}

export function migrate(envelope: SaveEnvelope): SaveEnvelope {
	if (envelope.saveVersion === SAVE_VERSION) {
		return envelope;
	}

	if (envelope.saveVersion === 0) {
		const state = envelope.state as GameState;
		for (const contract of [...state.activeContracts, ...state.contractMarket]) {
			const c = contract as unknown as Record<string, unknown>;
			if (!("urgency" in c)) c.urgency = "standard";
			if (!("tier" in c)) c.tier = 1;
		}
		return { saveVersion: SAVE_VERSION, state: envelope.state };
	}

	throw new Error(`Unsupported save version: ${envelope.saveVersion}`);
}

export function serialize(state: GameState): string {
	return JSON.stringify({
		saveVersion: SAVE_VERSION,
		state,
	});
}

export function deserialize(json: string): GameState {
	const parsed = JSON.parse(json) as unknown;
	if (!isSaveEnvelope(parsed)) {
		throw new Error("Invalid save envelope.");
	}

	return migrate(parsed).state;
}
