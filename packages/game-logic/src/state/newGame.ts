import { DEFAULT_DIFFICULTY, DIFFICULTY_CONFIG } from "../balance/difficulty.js";
import { RELIABILITY_BASELINE_SCORE } from "../balance/reliability.js";
import { withDerivedContractViews } from "../contracts/lifecycle.js";
import { refreshContractMarket } from "../contracts/market.js";
import { generateMap } from "../sim/mapgen.js";
import type { Difficulty, GameId, GameState, Money, PlayerId, Tick } from "../types.js";

export interface NewGameOptions {
	seed?: number;
	difficulty?: Difficulty;
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
	const difficulty = options.difficulty ?? DEFAULT_DIFFICULTY;
	const startingCash = options.startingCash ?? DIFFICULTY_CONFIG[difficulty].startingCash;

	if (!Number.isFinite(startingCash) || startingCash < 0) {
		throw new Error(`Invalid starting cash: ${startingCash}`);
	}

	const initialState: GameState = {
		gameId: crypto.randomUUID() as GameId,
		game: {
			speed: 1,
			paused: false,
		},
		tick: INITIAL_TICK,
		seed: effectiveSeed,
		rngState: effectiveSeed,
		difficulty,
		player: {
			id: DEFAULT_PLAYER_ID,
			name: options.playerName ?? "Player",
			cash: startingCash,
			reliability: {
				score: RELIABILITY_BASELINE_SCORE,
				recentOutcomes: [],
			},
		},
		datacenters: [],
		contracts: [],
		contractMarket: [],
		activeContracts: [],
		ledger: [],
		audioEnabled: true,
		audioSettings: {
			master: true,
			music: true,
			sfx: true,
			money: true,
			ambient: true,
		},
		map: generateMap(effectiveSeed),
	};

	return withDerivedContractViews(refreshContractMarket(initialState));
}
