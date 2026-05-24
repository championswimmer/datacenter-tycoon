import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_DIFFICULTY, DIFFICULTY_CONFIG } from "./difficulty.js";

test("difficulty config provides the updated Easy and Hard starting cash values", () => {
	assert.equal(DEFAULT_DIFFICULTY, "hard");
	assert.equal(DIFFICULTY_CONFIG.hard.startingCash, 4_000_000);
	assert.equal(DIFFICULTY_CONFIG.easy.startingCash, 8_000_000);
	assert.ok(DIFFICULTY_CONFIG.easy.startingCash > DIFFICULTY_CONFIG.hard.startingCash);
	assert.ok(DIFFICULTY_CONFIG.hard.startingCash > 2_500_000);
	assert.ok(DIFFICULTY_CONFIG.easy.startingCash > 5_000_000);
	assert.equal(DIFFICULTY_CONFIG.easy.repairTimeMultiplier, 0.75);
	assert.equal(DIFFICULTY_CONFIG.hard.breachPenaltyMultiplier, 1);
});
