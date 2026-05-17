import assert from "node:assert/strict";
import test from "node:test";

import { DIFFICULTY_CONFIG } from "../balance/difficulty.js";
import { RELIABILITY_BASELINE_SCORE } from "../balance/reliability.js";
import { MARKET_REFRESH_SIZE } from "../economy/constants.js";
import { newGame } from "./newGame.js";

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
	});

	assert.equal(state.seed, 99);
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

	assert.equal(easyState.player.cash, DIFFICULTY_CONFIG.easy.startingCash);
	assert.equal(hardState.player.cash, DIFFICULTY_CONFIG.hard.startingCash);
});

test("newGame rejects invalid starting cash", () => {
	assert.throws(() => newGame(1, { startingCash: -1 }), {
		message: /Invalid starting cash/,
	});
});
