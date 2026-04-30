import type { Contract, ContractId, ContractRequirements, Money } from "../types.js";
import type { Rng } from "../sim/rng.js";

interface ContractTheme {
	name: string;
	weights: {
		vCpu: number;
		ramGb: number;
		storageTb: number;
		gpuFlops: number;
	};
}

const CONTRACT_THEMES: readonly ContractTheme[] = [
	{
		name: "AI Model Training Job",
		weights: { vCpu: 0.45, ramGb: 0.65, storageTb: 0.2, gpuFlops: 1 },
	},
	{
		name: "Realtime Analytics Cluster",
		weights: { vCpu: 0.4, ramGb: 1, storageTb: 0.2, gpuFlops: 0.1 },
	},
	{
		name: "Edge Compute Burst",
		weights: { vCpu: 1, ramGb: 0.35, storageTb: 0.1, gpuFlops: 0 },
	},
	{
		name: "Small Data Storage Startup",
		weights: { vCpu: 0.1, ramGb: 0.15, storageTb: 1, gpuFlops: 0 },
	},
	{
		name: "Rendering Farm",
		weights: { vCpu: 0.5, ramGb: 0.4, storageTb: 0.2, gpuFlops: 0.8 },
	},
	{
		name: "In-Memory Database Migration",
		weights: { vCpu: 0.35, ramGb: 0.8, storageTb: 0.35, gpuFlops: 0 },
	},
];

const REQUIREMENT_UNITS = {
	vCpu: 256,
	ramGb: 4_096,
	storageTb: 1_200,
	gpuFlops: 1_100,
} as const;

const PRICING_WEIGHTS = {
	vCpu: 40,
	ramGb: 1.8,
	storageTb: 25,
	gpuFlops: 35,
} as const;

const OFFER_DURATION_TICKS = 3;

function clampDifficulty(difficulty: number): number {
	return Math.min(1, Math.max(0, difficulty));
}

function contractId(value: string): ContractId {
	return value as ContractId;
}

function pickOne<T>(rng: Rng, values: readonly T[]): T {
	const index = Math.floor(rng.next() * values.length);
	return values[Math.min(index, values.length - 1)] as T;
}

function roundToMultiple(value: number, multiple: number): number {
	return Math.max(multiple, Math.round(value / multiple) * multiple);
}

function roundMoney(value: number): Money {
	return Math.round(value * 100) / 100;
}

function roundMoneyToNearest(value: number, multiple: number): Money {
	return roundMoney(Math.round(value / multiple) * multiple);
}

function generateRequirement(rng: Rng, unit: number, weight: number, difficulty: number, multiple: number): number {
	if (weight === 0) {
		return 0;
	}

	const magnitude = 0.55 + difficulty * 1.1;
	const jitter = 0.85 + rng.next() * 0.35;
	return roundToMultiple(unit * magnitude * weight * jitter, multiple);
}

function createRequirements(rng: Rng, theme: ContractTheme, difficulty: number): ContractRequirements {
	return {
		vCpu: generateRequirement(rng, REQUIREMENT_UNITS.vCpu, theme.weights.vCpu, difficulty, 16),
		ramGb: generateRequirement(rng, REQUIREMENT_UNITS.ramGb, theme.weights.ramGb, difficulty, 64),
		storageTb: generateRequirement(rng, REQUIREMENT_UNITS.storageTb, theme.weights.storageTb, difficulty, 10),
		gpuFlops: generateRequirement(rng, REQUIREMENT_UNITS.gpuFlops, theme.weights.gpuFlops, difficulty, 50),
	};
}

function contractValue(requirements: ContractRequirements): number {
	return (
		requirements.vCpu * PRICING_WEIGHTS.vCpu +
		requirements.ramGb * PRICING_WEIGHTS.ramGb +
		requirements.storageTb * PRICING_WEIGHTS.storageTb +
		requirements.gpuFlops * PRICING_WEIGHTS.gpuFlops
	);
}

export function generateContract(rng: Rng, difficulty: number): Contract {
	const normalizedDifficulty = clampDifficulty(difficulty);
	const theme = pickOne(rng, CONTRACT_THEMES);
	const requirements = createRequirements(rng, theme, normalizedDifficulty);
	const weightedValue = contractValue(requirements);
	const monthlyPayment = roundMoneyToNearest(
		5_000 + weightedValue * (0.8 + normalizedDifficulty * 0.25),
		100,
	);
	const penaltyPerMonth = roundMoneyToNearest(
		Math.max(1_000, monthlyPayment * (0.4 + rng.next() * 0.15)),
		100,
	);
	const termMonths = 3 + Math.floor(normalizedDifficulty * 8) + Math.floor(rng.next() * 4);
	const idSuffix = Math.floor(rng.next() * 1_000_000)
		.toString(16)
		.padStart(5, "0");

	return {
		id: contractId(`contract-${theme.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}-${idSuffix}`),
		name: theme.name,
		requirements,
		monthlyPayment,
		penaltyPerMonth,
		termMonths,
		status: "offered",
		offeredAtTick: 0,
		expiresAtTick: OFFER_DURATION_TICKS,
	};
}
