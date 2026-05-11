import type { GameState } from "../types.js";

export const SAVE_VERSION = 7;

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

	throw new Error(`Outdated save version: ${envelope.saveVersion}. Start a new game with save version ${SAVE_VERSION}.`);
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
