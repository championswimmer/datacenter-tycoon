import type { GameId, GameState, Region } from "../types.js";
import { DEFAULT_REGION_ID } from "../types.js";

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

const GLOBAL_REGION: Region = {
	id: DEFAULT_REGION_ID,
	name: "Global",
	powerCostPerKwh: 0.12,
	staffWage: 6_000,
	taxRate: 0.1,
	totalPowerAvailable: 100_000,
	totalStaffAvailable: 10_000,
	powerUsed: 0,
	staffUsed: 0,
};

export function migrate(envelope: SaveEnvelope): SaveEnvelope {
	const state = envelope.state as any;

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

	if (envelope.saveVersion === 1) {
		// Migrate v1 -> v2: add map with default region if missing
		if (!state.map) {
			state.map = { regions: [GLOBAL_REGION] };
		}
		// Assign all existing datacenters to the global region if they lack regionId
		if (state.datacenters && Array.isArray(state.datacenters)) {
			for (const dc of state.datacenters) {
				if (!dc.regionId) {
					dc.regionId = DEFAULT_REGION_ID;
				}
			}
			// Update global region powerUsed and staffUsed based on existing datacenters
			const globalRegion = state.map.regions.find((r: Region) => r.id === DEFAULT_REGION_ID);
			if (globalRegion) {
				globalRegion.powerUsed = state.datacenters.reduce(
					(total: number, dc: { spec: { powerCapacityKw: number } }) => total + dc.spec.powerCapacityKw,
					0,
				);
				globalRegion.staffUsed = state.datacenters.reduce(
					(total: number, dc: { spec: { staffCount: number } }) => total + dc.spec.staffCount,
					0,
				);
			}
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
