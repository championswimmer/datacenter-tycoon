import {
	RELIABILITY_BASELINE_SCORE,
	reliabilityMarketPolicyForScore,
	type ReliabilityMarketPolicy,
} from "../balance/reliability.js";
import {
	CONTRACT_TERM_DISCOUNT_BASELINE_MONTHS,
	CONTRACT_TERM_DISCOUNT_FLOOR,
	CONTRACT_TERM_DISCOUNT_PER_EXTRA_MONTH,
} from "../economy/constants.js";
import type { Contract, ContractId, ContractRequirements, ContractTier, ContractUrgency, Money } from "../types.js";
import type { Rng } from "../sim/rng.js";

type TermRange = readonly [minMonths: number, maxMonths: number];

interface ContractTheme {
	id: string;
	label: string;
	deliverables: readonly string[];
	standardTermRange: TermRange;
	anchorTermRange: TermRange;
	rushTermRange: TermRange;
	weights: {
		vCpu: number;
		ramGb: number;
		storageTb: number;
		gpuFlops: number;
	};
}

const COMPANY_PREFIXES = [
	"Apex",
	"Blue",
	"Cobalt",
	"Global",
	"Helix",
	"Nimbus",
	"Northstar",
	"Nova",
	"Orbital",
	"Quantum",
	"Vertex",
] as const;

const COMPANY_SUFFIXES = [
	"Cloud",
	"Compute",
	"Dynamics",
	"Industries",
	"Labs",
	"Networks",
	"Platforms",
	"Systems",
	"Technologies",
	"Works",
] as const;

const PROJECT_CODENAMES = [
	"Atlas",
	"Aurora",
	"Beacon",
	"Catalyst",
	"Helios",
	"Meridian",
	"Nova",
	"Orion",
	"Signal",
	"Vector",
] as const;

const CONTRACT_THEMES: readonly ContractTheme[] = [
	{
		id: "ai_training",
		label: "AI Training",
		deliverables: ["LLM Cluster", "Foundation Model Pod", "Training Fabric"],
		standardTermRange: [4, 10],
		anchorTermRange: [10, 18],
		rushTermRange: [1, 2],
		weights: { vCpu: 0.2, ramGb: 0.45, storageTb: 0.15, gpuFlops: 1 },
	},
	{
		id: "ai_inference",
		label: "AI Inference",
		deliverables: ["Inference Mesh", "Serving Fleet", "Vector Gateway"],
		standardTermRange: [2, 6],
		anchorTermRange: [6, 12],
		rushTermRange: [1, 2],
		weights: { vCpu: 0.45, ramGb: 0.4, storageTb: 0.15, gpuFlops: 0.55 },
	},
	{
		id: "hpc_simulation",
		label: "HPC Simulation",
		deliverables: ["Simulation Grid", "Compute Sweep", "Monte Carlo Farm"],
		standardTermRange: [3, 8],
		anchorTermRange: [8, 14],
		rushTermRange: [1, 2],
		weights: { vCpu: 1, ramGb: 0.7, storageTb: 0.2, gpuFlops: 0.3 },
	},
	{
		id: "enterprise_db",
		label: "Enterprise OLTP",
		deliverables: ["OLTP Failover Ring", "Transactional Core", "Business Continuity Stack"],
		standardTermRange: [9, 18],
		anchorTermRange: [18, 30],
		rushTermRange: [1, 2],
		weights: { vCpu: 0.55, ramGb: 1, storageTb: 0.45, gpuFlops: 0 },
	},
	{
		id: "cold_storage",
		label: "Cold Storage",
		deliverables: ["Archive Vault", "Compliance Repository", "Deep Backup Lake"],
		standardTermRange: [12, 24],
		anchorTermRange: [24, 36],
		rushTermRange: [1, 2],
		weights: { vCpu: 0.05, ramGb: 0.08, storageTb: 1, gpuFlops: 0 },
	},
	{
		id: "cdn_edge",
		label: "CDN Edge",
		deliverables: ["Edge POP Rollout", "Caching Mesh", "Regional Delivery Grid"],
		standardTermRange: [4, 9],
		anchorTermRange: [9, 16],
		rushTermRange: [1, 2],
		weights: { vCpu: 0.8, ramGb: 0.3, storageTb: 0.55, gpuFlops: 0 },
	},
	{
		id: "video_render",
		label: "Video Transcoding",
		deliverables: ["Render Pipeline", "Transcode Swarm", "Streaming Encode Farm"],
		standardTermRange: [1, 4],
		anchorTermRange: [4, 6],
		rushTermRange: [1, 2],
		weights: { vCpu: 0.45, ramGb: 0.35, storageTb: 0.25, gpuFlops: 0.7 },
	},
];

const REQUIREMENT_UNITS = {
	vCpu: 256,
	ramGb: 4_096,
	storageTb: 1_200,
	gpuFlops: 1_100,
} as const;

export const PRICING_WEIGHTS = {
	vCpu: 40,
	ramGb: 1.8,
	storageTb: 25,
	gpuFlops: 35,
} as const;

export const OFFER_DURATION_TICKS = 6;

export interface ContractGenerationPolicy extends Pick<ReliabilityMarketPolicy, "longTermBias" | "shortTermBias"> {}

const BASELINE_CONTRACT_GENERATION_POLICY: ContractGenerationPolicy = reliabilityMarketPolicyForScore(
	RELIABILITY_BASELINE_SCORE,
);

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

function availableThemes(difficulty: number): readonly ContractTheme[] {
	if (difficulty < 0.25) {
		return CONTRACT_THEMES.filter((t) => t.weights.gpuFlops === 0);
	}
	return CONTRACT_THEMES;
}

function generateContractName(rng: Rng, theme: ContractTheme): string {
	const company = `${pickOne(rng, COMPANY_PREFIXES)} ${pickOne(rng, COMPANY_SUFFIXES)}`;
	const codename = pickOne(rng, PROJECT_CODENAMES);
	const deliverable = pickOne(rng, theme.deliverables);
	return `${company} ${codename} ${deliverable}`;
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

export function monthlyRateMultiplierForTerm(termMonths: number): number {
	const extraMonths = Math.max(0, Math.round(termMonths) - CONTRACT_TERM_DISCOUNT_BASELINE_MONTHS);
	return Math.max(
		CONTRACT_TERM_DISCOUNT_FLOOR,
		1 - extraMonths * CONTRACT_TERM_DISCOUNT_PER_EXTRA_MONTH,
	);
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

function rollTermMonths(rng: Rng, range: TermRange, difficulty: number): number {
	const [minMonths, maxMonths] = range;
	if (minMonths >= maxMonths) {
		return minMonths;
	}

	const span = maxMonths - minMonths;
	const difficultyFloor = Math.floor(span * clampDifficulty(difficulty) * 0.5);
	const remainingSpan = Math.max(0, span - difficultyFloor);
	return minMonths + difficultyFloor + Math.floor(rng.next() * (remainingSpan + 1));
}

export function urgencyThresholdsForPolicy(policy: ContractGenerationPolicy): {
	rushThreshold: number;
	anchorThreshold: number;
} {
	const rushThreshold = Math.max(0.12, Math.min(0.32, 0.2 * policy.shortTermBias));
	const anchorThreshold = Math.max(
		rushThreshold + 0.05,
		Math.min(0.48, rushThreshold + 0.15 * policy.longTermBias),
	);

	return {
		rushThreshold,
		anchorThreshold,
	};
}

function termBiasOffset(policy: ContractGenerationPolicy): number {
	return Math.round((policy.longTermBias - policy.shortTermBias) * 2);
}

function applyTermBias(termMonths: number, policy: ContractGenerationPolicy): number {
	return Math.max(1, termMonths + termBiasOffset(policy));
}

export function generateContract(
	rng: Rng,
	difficulty: number,
	policy: ContractGenerationPolicy = BASELINE_CONTRACT_GENERATION_POLICY,
): Contract {
	const normalizedDifficulty = clampDifficulty(difficulty);
	const theme = pickOne(rng, availableThemes(normalizedDifficulty));
	const requirements = createRequirements(rng, theme, normalizedDifficulty);
	const contractName = generateContractName(rng, theme);
	const weightedValue = contractValue(requirements);

	const urgencyRoll = rng.next();
	const urgencyThresholds = urgencyThresholdsForPolicy(policy);
	let urgency: ContractUrgency = "standard";
	let offerDuration = OFFER_DURATION_TICKS;
	let termMonths = rollTermMonths(rng, theme.standardTermRange, normalizedDifficulty);
	let paymentMultiplier = 1;
	let penaltyMultiplier = 1;

	// Reliability only reshapes urgency thresholds and final term length. Difficulty,
	// requirements, and pricing inputs still originate from the seeded difficulty roll.
	if (urgencyRoll < urgencyThresholds.rushThreshold) {
		urgency = "rush";
		offerDuration = 2;
		termMonths = rollTermMonths(rng, theme.rushTermRange, normalizedDifficulty);
		paymentMultiplier = 1.4;
		penaltyMultiplier = 1.2;
	} else if (urgencyRoll < urgencyThresholds.anchorThreshold) {
		urgency = "anchor";
		termMonths = rollTermMonths(rng, theme.anchorTermRange, normalizedDifficulty);
		paymentMultiplier = 0.75;
		penaltyMultiplier = 0.6;
	}

	termMonths = applyTermBias(termMonths, policy);

	const tier: ContractTier = normalizedDifficulty < 0.35 ? 1 : normalizedDifficulty < 0.7 ? 2 : 3;

	const termRateMultiplier = monthlyRateMultiplierForTerm(termMonths);
	const monthlyPayment = roundMoneyToNearest(
		(5_000 + weightedValue * (0.8 + normalizedDifficulty * 0.25)) * paymentMultiplier * termRateMultiplier,
		100,
	);
	const penaltyPerMonth = roundMoneyToNearest(
		Math.max(1_000, monthlyPayment * (0.4 + rng.next() * 0.15)) * penaltyMultiplier,
		100,
	);
	const idSuffix = Math.floor(rng.next() * 1_000_000)
		.toString(16)
		.padStart(5, "0");

	return {
		id: contractId(`contract-${theme.id}-${idSuffix}`),
		name: contractName,
		requirements,
		monthlyPayment,
		penaltyPerMonth,
		termMonths,
		lifecycleState: "market_open",
		status: "offered",
		urgency,
		tier,
		offeredAtTick: 0,
		expiresAtTick: offerDuration,
	};
}
