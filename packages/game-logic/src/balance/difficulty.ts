import type { Difficulty, Money } from "../types.js";

export interface DifficultyConfig {
	startingCash: Money;
	repairTimeMultiplier: number;
	breachPenaltyMultiplier: number;
	failureCurvePct: readonly number[];
}

export const DEFAULT_DIFFICULTY: Difficulty = "hard";

export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
	easy: {
		startingCash: 5_000_000,
		repairTimeMultiplier: 0.75,
		breachPenaltyMultiplier: 0.5,
		failureCurvePct: [0, 1, 2, 4, 8, 16],
	},
	hard: {
		startingCash: 2_500_000,
		repairTimeMultiplier: 1,
		breachPenaltyMultiplier: 1,
		failureCurvePct: [0, 2, 4, 8, 16, 32],
	},
};
