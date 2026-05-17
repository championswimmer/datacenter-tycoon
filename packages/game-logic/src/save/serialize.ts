import { createEmptyRegionFabric } from "../entities/fabric.js";
import type { GameState } from "../types.js";

export const SAVE_VERSION = 9;

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

function attachEmptyRegionalFabrics(state: GameState): GameState {
	return {
		...state,
		map: {
			...state.map,
			regions: state.map.regions.map((region) => ({
				...region,
				fabric: region.fabric ?? createEmptyRegionFabric(),
			})),
		},
	};
}

export function migrate(envelope: SaveEnvelope): SaveEnvelope {
	if (envelope.saveVersion === SAVE_VERSION) {
		return envelope;
	}

	if (envelope.saveVersion === 8) {
		return {
			saveVersion: SAVE_VERSION,
			state: envelope.state,
		};
	}

	if (envelope.saveVersion === 7) {
		return {
			saveVersion: SAVE_VERSION,
			state: attachEmptyRegionalFabrics(envelope.state),
		};
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
