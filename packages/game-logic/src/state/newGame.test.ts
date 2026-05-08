import assert from "node:assert/strict";
import test from "node:test";

import { MARKET_REFRESH_SIZE, STARTING_CASH } from "../economy/constants.js";
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
	assert.equal(first.player.cash, STARTING_CASH);
	assert.deepEqual(first.player.reliability, {
		score: 50,
		recentOutcomes: [],
	});
	assert.equal(first.datacenters.length, 0);
	assert.equal(first.contractMarket.length, MARKET_REFRESH_SIZE);
	assert.equal(first.activeContracts.length, 0);
	assert.equal(first.ledger.length, 0);
	assert.ok(first.contractMarket.every((contract) => contract.status === "offered"));
});

test("newGame accepts option overrides", () => {
	const state = newGame(7, {
		seed: 99,
		startingCash: 123_456,
		playerName: "Alex",
	});

	assert.equal(state.seed, 99);
	assert.equal(state.player.name, "Alex");
	assert.equal(state.player.cash, 123_456);
	assert.deepEqual(state.player.reliability, {
		score: 50,
		recentOutcomes: [],
	});
	assert.equal(state.contractMarket.length, MARKET_REFRESH_SIZE);
});

test("newGame rejects invalid starting cash", () => {
	assert.throws(() => newGame(1, { startingCash: -1 }), {
		message: /Invalid starting cash/,
	});
});
