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

test("reliabilityBandForScore maps score thresholds to stability bands", () => {
	assert.equal(reliabilityBandForScore(RELIABILITY_BAND_THRESHOLDS.atRiskMax), "at-risk");
	assert.equal(reliabilityBandForScore(RELIABILITY_BASELINE_SCORE), "baseline");
	assert.equal(reliabilityBandForScore(RELIABILITY_BAND_THRESHOLDS.trustedMin), "trusted");
});

test("baseline reliability preserves current offer volume while trusted and at-risk bands skew market policy", () => {
	assert.equal(RELIABILITY_MARKET_OFFER_COUNT.baseline, MARKET_REFRESH_SIZE);
	assert.ok(RELIABILITY_MARKET_OFFER_COUNT.trusted > RELIABILITY_MARKET_OFFER_COUNT.baseline);
	assert.ok(RELIABILITY_MARKET_OFFER_COUNT["at-risk"] < RELIABILITY_MARKET_OFFER_COUNT.baseline);
	assert.ok(RELIABILITY_TERM_BIAS.trusted.longTermBias > RELIABILITY_TERM_BIAS.baseline.longTermBias);
	assert.ok(RELIABILITY_TERM_BIAS["at-risk"].shortTermBias > RELIABILITY_TERM_BIAS.baseline.shortTermBias);
});
