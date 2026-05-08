import { MARKET_REFRESH_SIZE } from "../economy/constants.js";
import type { ReliabilityBand } from "../types.js";

export const RELIABILITY_MIN_SCORE = 0;
export const RELIABILITY_MAX_SCORE = 100;
export const RELIABILITY_BASELINE_SCORE = 50;

export const RELIABILITY_DELTA_FULFILLED = 3;
export const RELIABILITY_DELTA_BREACHED = -8;
export const RELIABILITY_DELTA_CANCELLED = -12;

export const RELIABILITY_BAND_THRESHOLDS = {
	atRiskMax: 34,
	trustedMin: 70,
} as const;

export const RELIABILITY_RECENT_OUTCOME_LIMIT = 6;

export const RELIABILITY_MARKET_OFFER_COUNT: Readonly<Record<ReliabilityBand, number>> = {
	"at-risk": 4,
	baseline: MARKET_REFRESH_SIZE,
	trusted: 8,
};

export interface ReliabilityTermBias {
	longTermBias: number;
	shortTermBias: number;
}

export const RELIABILITY_TERM_BIAS: Readonly<Record<ReliabilityBand, ReliabilityTermBias>> = {
	"at-risk": {
		longTermBias: 0.75,
		shortTermBias: 1.3,
	},
	baseline: {
		longTermBias: 1,
		shortTermBias: 1,
	},
	trusted: {
		longTermBias: 1.3,
		shortTermBias: 0.75,
	},
};

export function clampReliabilityScore(score: number): number {
	if (!Number.isFinite(score)) {
		return RELIABILITY_BASELINE_SCORE;
	}

	return Math.max(RELIABILITY_MIN_SCORE, Math.min(RELIABILITY_MAX_SCORE, Math.round(score)));
}

export function reliabilityBandForScore(score: number): ReliabilityBand {
	const normalizedScore = clampReliabilityScore(score);

	if (normalizedScore <= RELIABILITY_BAND_THRESHOLDS.atRiskMax) {
		return "at-risk";
	}

	if (normalizedScore >= RELIABILITY_BAND_THRESHOLDS.trustedMin) {
		return "trusted";
	}

	return "baseline";
}
