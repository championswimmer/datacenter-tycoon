import type { GameId, GameState, Region } from "../types.js";
import { generateMap } from "../sim/mapgen.js";

export const SAVE_VERSION = 2;

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
	let current = envelope;
	const state = current.state as any;

	// Ensure gameId exists for all save versions
	if (!state.gameId) {
		state.gameId = crypto.randomUUID() as GameId;
	}

	// Ensure game metadata exists
	if (!state.game) {
		state.game = {
			speed: 1,
			paused: false,
		};
	}

	if (current.saveVersion === SAVE_VERSION) {
		return current;
	}

	if (current.saveVersion === 0) {
		for (const contract of [...state.activeContracts, ...state.contractMarket]) {
			const c = contract as unknown as Record<string, unknown>;
			if (!("urgency" in c)) c.urgency = "standard";
			if (!("tier" in c)) c.tier = 1;
		}
		// Fall through to v1→v2 migration below by updating version
		current = { saveVersion: 1, state: current.state };
	}

	if (current.saveVersion === 1) {
		// Migrate v1 -> v2: generate a real map and assign legacy datacenters to the first region
		if (!state.map) {
			state.map = generateMap(state.seed ?? 42);
		}
		const firstRegion = state.map.regions[0] as Region | undefined;
		if (firstRegion && state.datacenters && Array.isArray(state.datacenters)) {
			for (const dc of state.datacenters) {
				if (!dc.regionId) {
					dc.regionId = firstRegion.id;
				}
			}
			// Update first region powerUsed and staffUsed based on existing datacenters
			firstRegion.powerUsed = state.datacenters.reduce(
				(total: number, dc: { spec: { powerCapacityKw: number } }) => total + dc.spec.powerCapacityKw,
				0,
			);
			firstRegion.staffUsed = state.datacenters.reduce(
				(total: number, dc: { spec: { staffCount: number } }) => total + dc.spec.staffCount,
				0,
			);
		}
		return { saveVersion: SAVE_VERSION, state: current.state };
	}

	throw new Error(`Unsupported save version: ${current.saveVersion}`);
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
