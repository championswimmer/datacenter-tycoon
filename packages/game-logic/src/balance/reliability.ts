import { MARKET_REFRESH_SIZE } from "../economy/constants.js";
import type { ReliabilityBand } from "../types.js";

export interface ReliabilityMarketPolicy {
	band: ReliabilityBand;
	offerCount: number;
	longTermBias: number;
	shortTermBias: number;
}

export const RELIABILITY_MIN_SCORE = 0;
export const RELIABILITY_MAX_SCORE = 100;
export const RELIABILITY_BASELINE_SCORE = 50;

export const RELIABILITY_DELTA_FULFILLED = 3;
export const RELIABILITY_DELTA_BREACHED = -8;
export const RELIABILITY_DELTA_CANCELLED = -12;

export const RELIABILITY_BAND_THRESHOLDS = {
	bronzeMax: 19,
	silverMax: 39,
	goldMax: 59,
	platinumMax: 79,
} as const;

export const RELIABILITY_RECENT_OUTCOME_LIMIT = 6;

export const RELIABILITY_MARKET_OFFER_COUNT: Readonly<Record<ReliabilityBand, number>> = {
	bronze: 3,
	silver: 5,
	gold: MARKET_REFRESH_SIZE,
	platinum: 8,
	diamond: 10,
};

export interface ReliabilityTermBias {
	longTermBias: number;
	shortTermBias: number;
}

export const RELIABILITY_TERM_BIAS: Readonly<Record<ReliabilityBand, ReliabilityTermBias>> = {
	bronze: {
		longTermBias: 0.6,
		shortTermBias: 1.4,
	},
	silver: {
		longTermBias: 0.85,
		shortTermBias: 1.15,
	},
	gold: {
		longTermBias: 1,
		shortTermBias: 1,
	},
	platinum: {
		longTermBias: 1.2,
		shortTermBias: 0.85,
	},
	diamond: {
		longTermBias: 1.4,
		shortTermBias: 0.6,
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

	if (normalizedScore <= RELIABILITY_BAND_THRESHOLDS.bronzeMax) {
		return "bronze";
	}

	if (normalizedScore <= RELIABILITY_BAND_THRESHOLDS.silverMax) {
		return "silver";
	}

	if (normalizedScore <= RELIABILITY_BAND_THRESHOLDS.goldMax) {
		return "gold";
	}

	if (normalizedScore <= RELIABILITY_BAND_THRESHOLDS.platinumMax) {
		return "platinum";
	}

	return "diamond";
}

export function reliabilityMarketPolicyForScore(score: number): ReliabilityMarketPolicy {
	const band = reliabilityBandForScore(score);
	const termBias = RELIABILITY_TERM_BIAS[band];

	return {
		band,
		offerCount: RELIABILITY_MARKET_OFFER_COUNT[band],
		longTermBias: termBias.longTermBias,
		shortTermBias: termBias.shortTermBias,
	};
}
