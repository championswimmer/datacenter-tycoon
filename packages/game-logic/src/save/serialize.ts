import type { GameState } from "../types.js";

export interface SaveEnvelope {
	saveVersion: number;
	state: GameState;
}

export function serialize(_state: GameState): string {
	throw new Error("serialize is not implemented yet.");
}

export function deserialize(_json: string): GameState {
	throw new Error("deserialize is not implemented yet.");
}
