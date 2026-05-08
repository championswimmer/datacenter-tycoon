import assert from "node:assert/strict";
import test from "node:test";

import { MARKET_REFRESH_SIZE } from "../economy/constants.js";
import {
	RELIABILITY_BAND_THRESHOLDS,
	RELIABILITY_BASELINE_SCORE,
	RELIABILITY_MARKET_OFFER_COUNT,
	RELIABILITY_MAX_SCORE,
	RELIABILITY_MIN_SCORE,
	RELIABILITY_TERM_BIAS,
	clampReliabilityScore,
	reliabilityBandForScore,
} from "./reliability.js";

test("clampReliabilityScore enforces the configured score bounds", () => {
	assert.equal(clampReliabilityScore(Number.NaN), RELIABILITY_BASELINE_SCORE);
	assert.equal(clampReliabilityScore(RELIABILITY_MIN_SCORE - 5), RELIABILITY_MIN_SCORE);
	assert.equal(clampReliabilityScore(RELIABILITY_MAX_SCORE + 5), RELIABILITY_MAX_SCORE);
	assert.equal(clampReliabilityScore(62.6), 63);
});

test("reliabilityBandForScore maps score thresholds to tier bands", () => {
	assert.equal(reliabilityBandForScore(RELIABILITY_BAND_THRESHOLDS.bronzeMax), "bronze");
	assert.equal(reliabilityBandForScore(RELIABILITY_BAND_THRESHOLDS.silverMax), "silver");
	assert.equal(reliabilityBandForScore(RELIABILITY_BASELINE_SCORE), "gold");
	assert.equal(reliabilityBandForScore(RELIABILITY_BAND_THRESHOLDS.platinumMax), "platinum");
	assert.equal(reliabilityBandForScore(RELIABILITY_BAND_THRESHOLDS.platinumMax + 1), "diamond");
});

test("gold tier preserves current offer volume while higher and lower tiers skew market policy", () => {
	assert.equal(RELIABILITY_MARKET_OFFER_COUNT.gold, MARKET_REFRESH_SIZE);
	assert.ok(RELIABILITY_MARKET_OFFER_COUNT.diamond > RELIABILITY_MARKET_OFFER_COUNT.gold);
	assert.ok(RELIABILITY_MARKET_OFFER_COUNT.bronze < RELIABILITY_MARKET_OFFER_COUNT.gold);
	assert.ok(RELIABILITY_TERM_BIAS.diamond.longTermBias > RELIABILITY_TERM_BIAS.gold.longTermBias);
	assert.ok(RELIABILITY_TERM_BIAS.bronze.shortTermBias > RELIABILITY_TERM_BIAS.gold.shortTermBias);
});
