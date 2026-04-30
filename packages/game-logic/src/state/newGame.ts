import type { GameState, Money } from "../types.js";

export interface NewGameOptions {
	seed?: number;
	startingCash?: Money;
	playerName?: string;
}

export function newGame(_seed: number, _options: NewGameOptions = {}): GameState {
	throw new Error("newGame is not implemented yet.");
}
