import assert from "node:assert/strict";
import test from "node:test";

import { DIFFICULTY_CONFIG } from "../balance/difficulty.js";
import { RELIABILITY_BASELINE_SCORE } from "../balance/reliability.js";
import { MARKET_REFRESH_SIZE } from "../economy/constants.js";
import { createVerifiedGenesisState, newGame } from "./newGame.js";

test("newGame creates a deterministic initial state with a primed contract market", () => {
	const first = newGame(42);
	const second = newGame(42);

	// gameId is random, so we compare everything else
	const { gameId: id1, ...firstRest } = first;
	const { gameId: id2, ...secondRest } = second;

	assert.deepEqual(firstRest, secondRest);
	assert.ok(id1);
	assert.ok(id2);
	assert.notEqual(id1, id2); // Should be unique
	assert.equal(first.seed, 42);
	assert.equal(first.rngState !== first.seed, true);
	assert.equal(first.tick, 0);
	assert.equal(first.subtick, 0);
	assert.equal(first.player.name, "Player");
	assert.equal(first.difficulty, "hard");
	assert.equal(first.player.cash, DIFFICULTY_CONFIG.hard.startingCash);
	assert.deepEqual(first.player.reliability, {
		score: RELIABILITY_BASELINE_SCORE,
		recentOutcomes: [],
	});
	assert.equal(first.datacenters.length, 0);
	assert.equal(first.contractMarket.length, MARKET_REFRESH_SIZE);
	assert.equal(first.activeContracts.length, 0);
	assert.equal(first.ledger.length, 0);
	assert.ok(first.contractMarket.every((contract) => contract.status === "offered"));
	assert.ok(first.map.regions.every((region) => region.fabric?.memberDcIds.length === 0));
});

test("newGame accepts option overrides", () => {
	const state = newGame(7, {
		seed: 99,
		difficulty: "easy",
		startingCash: 123_456,
		playerName: "Alex",
		gameId: "game-fixed" as import("../types.js").GameId,
	});

	assert.equal(state.seed, 99);
	assert.equal(state.gameId, "game-fixed");
	assert.equal(state.difficulty, "easy");
	assert.equal(state.player.name, "Alex");
	assert.equal(state.player.cash, 123_456);
	assert.deepEqual(state.player.reliability, {
		score: RELIABILITY_BASELINE_SCORE,
		recentOutcomes: [],
	});
	assert.equal(state.contractMarket.length, MARKET_REFRESH_SIZE);
});

test("newGame uses difficulty-based starting cash by default", () => {
	const easyState = newGame(1, { difficulty: "easy" });
	const hardState = newGame(1, { difficulty: "hard" });

	assert.equal(DIFFICULTY_CONFIG.easy.startingCash, 8_000_000);
	assert.equal(DIFFICULTY_CONFIG.hard.startingCash, 4_000_000);
	assert.equal(easyState.player.cash, DIFFICULTY_CONFIG.easy.startingCash);
	assert.equal(hardState.player.cash, DIFFICULTY_CONFIG.hard.startingCash);
	assert.ok(easyState.player.cash > hardState.player.cash);
	assert.ok(hardState.player.cash > 2_500_000);
});

test("newGame rejects invalid starting cash", () => {
	assert.throws(() => newGame(1, { startingCash: -1 }), {
		message: /Invalid starting cash/,
	});
});

test("createVerifiedGenesisState is deterministic for the same descriptor", () => {
	const descriptor = {
		seed: 42,
		difficulty: "easy",
		gameId: "verified-game-1" as import("../types.js").GameId,
		playerName: "Verifier",
	} as const;

	const first = createVerifiedGenesisState(descriptor);
	const second = createVerifiedGenesisState(descriptor);

	assert.deepEqual(first, second);
	assert.equal(first.gameId, descriptor.gameId);
	assert.equal(first.player.name, descriptor.playerName);
	assert.equal(first.player.cash, DIFFICULTY_CONFIG.easy.startingCash);
});

test("createVerifiedGenesisState always uses canonical difficulty starting cash", () => {
	const descriptor = {
		seed: 9,
		difficulty: "hard",
		gameId: "verified-game-2" as import("../types.js").GameId,
		playerName: "Verifier",
	} as const;
	const customCashState = newGame(descriptor.seed, {
		difficulty: descriptor.difficulty,
		gameId: descriptor.gameId,
		playerName: descriptor.playerName,
		startingCash: 99_999_999,
	});
	const verifiedState = createVerifiedGenesisState(descriptor);

	assert.equal(customCashState.player.cash, 99_999_999);
	assert.equal(verifiedState.player.cash, DIFFICULTY_CONFIG.hard.startingCash);
	assert.notDeepEqual(verifiedState, customCashState);
});
