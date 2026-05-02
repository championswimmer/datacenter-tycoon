import { refreshContractMarket } from "../contracts/market.js";
import { STARTING_CASH } from "../economy/constants.js";
import type { GameId, GameState, Money, PlayerId, Tick } from "../types.js";

export interface NewGameOptions {
	seed?: number;
	startingCash?: Money;
	playerName?: string;
}

const DEFAULT_PLAYER_ID = "player-1" as PlayerId;
const INITIAL_TICK = 0 as Tick;

function normalizeSeed(seed: number): number {
	return seed >>> 0;
}

export function newGame(seed: number, options: NewGameOptions = {}): GameState {
	const effectiveSeed = normalizeSeed(options.seed ?? seed);
	const startingCash = options.startingCash ?? STARTING_CASH;

	if (!Number.isFinite(startingCash) || startingCash < 0) {
		throw new Error(`Invalid starting cash: ${startingCash}`);
	}

	const initialState: GameState = {
		gameId: crypto.randomUUID() as GameId,
		tick: INITIAL_TICK,
		seed: effectiveSeed,
		rngState: effectiveSeed,
		player: {
			id: DEFAULT_PLAYER_ID,
			name: options.playerName ?? "Player",
			cash: startingCash,
		},
		datacenters: [],
		contractMarket: [],
		activeContracts: [],
		ledger: [],
		audioEnabled: true,
	};

	return refreshContractMarket(initialState);
}
