import { DIFFICULTY_CONFIG, type DifficultyConfig } from "../balance/difficulty.js";
import { RACK_IDLE_BASELINE_POWER_KW } from "../balance/power.js";
import { DATACENTER_CATALOG } from "../catalog/datacenters.js";
import { RACK_CATALOG } from "../catalog/racks.js";
import { REGION_CATALOG } from "../catalog/regions.js";
import { allocateRackActivitySnapshot, rackDemandByKindFromRequirements } from "../economy/rack-activity.js";
import {
	BANDWIDTH_USD_PER_GBPS_MONTH,
	COOLING_OVERHEAD_RATIO,
	HOURS_PER_MONTH,
	STARTING_CASH,
} from "../economy/constants.js";
import { monthlyPaymentForRequirements, type ContractPricingConfig } from "../contracts/generator.js";
import type {
	ContractRequirements,
	ContractUrgency,
	DatacenterSpecId,
	Difficulty,
	Money,
	RackKind,
	RackPlacementId,
	RackSpec,
	RackSpecId,
	RegionId,
} from "../types.js";

export interface ScenarioValidationDefinition {
	id: string;
	label: string;
	datacenterId: DatacenterSpecId;
	regionId: RegionId;
	rackSpecIds: readonly RackSpecId[];
	requirements: ContractRequirements;
	difficulty: number;
	termMonths: number;
	urgency: ContractUrgency;
}

export interface ScenarioValidationOutcome {
	startingCash: Money;
	totalCapex: Money;
	rackCapex: Money;
	activeOpex: Money;
	idleOpex: Money;
	monthlyRevenue: Money;
	activeMargin: Money;
	paybackMonths: number | null;
	cashAfterBuild: Money;
	cashAfterOneIdleMonth: Money;
	idleRunwayMonths: number;
}

export interface DifficultyRunwayValidationOutcome extends ScenarioValidationOutcome {
	difficulty: Difficulty;
}

export interface ScenarioValidationComparison {
	scenario: ScenarioValidationDefinition;
	legacy: ScenarioValidationOutcome;
	rebalanced: ScenarioValidationOutcome;
}

export interface ScenarioValidationReport {
	legacyPricing: ContractPricingConfig;
	rebalancedPricing: ContractPricingConfig;
	scenarios: ScenarioValidationComparison[];
}

export interface EarlyGameRunwayValidationComparison {
	scenario: ScenarioValidationDefinition;
	hard: DifficultyRunwayValidationOutcome;
	easy: DifficultyRunwayValidationOutcome;
}

export interface EarlyGameRunwayValidationReport {
	pricing: ContractPricingConfig;
	scenarios: EarlyGameRunwayValidationComparison[];
}

export const LEGACY_PRE_REBALANCE_PRICING: ContractPricingConfig = {
	baseMonthlyFee: 5_000,
	weights: {
		vCpu: 40,
		ramGb: 1.8,
		storageTb: 25,
		gpuFlops: 35,
	},
};

export const REBALANCED_SCENARIO_PRICING: ContractPricingConfig = {
	baseMonthlyFee: 5_000,
	weights: {
		vCpu: 50,
		ramGb: 2.1,
		storageTb: 24,
		gpuFlops: 39,
	},
};

const LEGACY_STORAGE_RACK_OVERRIDES = {
	S0: { capexCost: 40_000, monthlyMaintenance: 320 },
	S1: { capexCost: 80_000, monthlyMaintenance: 640 },
	S2: { capexCost: 200_000, monthlyMaintenance: 1_600 },
	S3: { capexCost: 450_000, monthlyMaintenance: 3_600 },
} as const;

export const REBALANCE_VALIDATION_SCENARIOS: readonly ScenarioValidationDefinition[] = [
	{
		id: "starter-garage-mixed",
		label: "Starter garage with a mixed C1/M1/S1 footprint",
		datacenterId: DATACENTER_CATALOG.garage!.id,
		regionId: REGION_CATALOG.sa_east!.id,
		rackSpecIds: [RACK_CATALOG.C1!.id, RACK_CATALOG.M1!.id, RACK_CATALOG.S1!.id],
		requirements: {
			vCpu: 192,
			ramGb: 2_560,
			storageTb: 150,
			gpuFlops: 0,
		},
		difficulty: 0.65,
		termMonths: 3,
		urgency: "standard",
	},
	{
		id: "warehouse-storage-heavy",
		label: "Storage-heavy early warehouse build",
		datacenterId: DATACENTER_CATALOG.warehouse!.id,
		regionId: REGION_CATALOG.sa_east!.id,
		rackSpecIds: [
			RACK_CATALOG.S1!.id,
			RACK_CATALOG.S1!.id,
			RACK_CATALOG.S1!.id,
			RACK_CATALOG.S1!.id,
			RACK_CATALOG.S1!.id,
			RACK_CATALOG.S1!.id,
			RACK_CATALOG.S1!.id,
			RACK_CATALOG.S1!.id,
		],
		requirements: {
			vCpu: 192,
			ramGb: 2_048,
			storageTb: 4_000,
			gpuFlops: 0,
		},
		difficulty: 0.65,
		termMonths: 3,
		urgency: "standard",
	},
	{
		id: "garage-oltp-edge",
		label: "Mixed compute+memory build for OLTP / edge contracts",
		datacenterId: DATACENTER_CATALOG.garage!.id,
		regionId: REGION_CATALOG.us_west!.id,
		rackSpecIds: [RACK_CATALOG.C1!.id, RACK_CATALOG.C1!.id, RACK_CATALOG.M1!.id, RACK_CATALOG.M1!.id],
		requirements: {
			vCpu: 320,
			ramGb: 4_800,
			storageTb: 60,
			gpuFlops: 0,
		},
		difficulty: 0.65,
		termMonths: 3,
		urgency: "standard",
	},
] as const;

const EARLY_GAME_RUNWAY_REQUIREMENTS: ContractRequirements = {
	vCpu: 320,
	ramGb: 4_800,
	storageTb: 60,
	gpuFlops: 0,
};

const EARLY_GAME_RUNWAY_RACK_SPEC_IDS: readonly RackSpecId[] = [
	RACK_CATALOG.C1!.id,
	RACK_CATALOG.C1!.id,
	RACK_CATALOG.M1!.id,
	RACK_CATALOG.M1!.id,
];

export const EARLY_GAME_RUNWAY_VALIDATION_SCENARIOS: readonly ScenarioValidationDefinition[] = [
	{
		id: "starter-garage-us-east",
		label: "Starter garage runway in US East",
		datacenterId: DATACENTER_CATALOG.garage!.id,
		regionId: REGION_CATALOG.us_east!.id,
		rackSpecIds: EARLY_GAME_RUNWAY_RACK_SPEC_IDS,
		requirements: EARLY_GAME_RUNWAY_REQUIREMENTS,
		difficulty: 0.65,
		termMonths: 3,
		urgency: "standard",
	},
	{
		id: "starter-garage-us-west",
		label: "Starter garage runway in US West",
		datacenterId: DATACENTER_CATALOG.garage!.id,
		regionId: REGION_CATALOG.us_west!.id,
		rackSpecIds: EARLY_GAME_RUNWAY_RACK_SPEC_IDS,
		requirements: EARLY_GAME_RUNWAY_REQUIREMENTS,
		difficulty: 0.65,
		termMonths: 3,
		urgency: "standard",
	},
	{
		id: "starter-garage-eu-west",
		label: "Starter garage runway in EU West",
		datacenterId: DATACENTER_CATALOG.garage!.id,
		regionId: REGION_CATALOG.eu_west!.id,
		rackSpecIds: EARLY_GAME_RUNWAY_RACK_SPEC_IDS,
		requirements: EARLY_GAME_RUNWAY_REQUIREMENTS,
		difficulty: 0.65,
		termMonths: 3,
		urgency: "standard",
	},
	{
		id: "starter-garage-ap-southeast",
		label: "Starter garage runway in AP Southeast",
		datacenterId: DATACENTER_CATALOG.garage!.id,
		regionId: REGION_CATALOG.ap_southeast!.id,
		rackSpecIds: EARLY_GAME_RUNWAY_RACK_SPEC_IDS,
		requirements: EARLY_GAME_RUNWAY_REQUIREMENTS,
		difficulty: 0.65,
		termMonths: 3,
		urgency: "standard",
	},
	{
		id: "starter-garage-sa-east",
		label: "Starter garage runway in SA East",
		datacenterId: DATACENTER_CATALOG.garage!.id,
		regionId: REGION_CATALOG.sa_east!.id,
		rackSpecIds: EARLY_GAME_RUNWAY_RACK_SPEC_IDS,
		requirements: EARLY_GAME_RUNWAY_REQUIREMENTS,
		difficulty: 0.65,
		termMonths: 3,
		urgency: "standard",
	},
	{
		id: "starter-garage-me-central",
		label: "Starter garage runway in ME Central",
		datacenterId: DATACENTER_CATALOG.garage!.id,
		regionId: REGION_CATALOG.me_central!.id,
		rackSpecIds: EARLY_GAME_RUNWAY_RACK_SPEC_IDS,
		requirements: EARLY_GAME_RUNWAY_REQUIREMENTS,
		difficulty: 0.65,
		termMonths: 3,
		urgency: "standard",
	},
] as const;

function roundMoney(value: number): Money {
	return Math.round(value * 100) / 100;
}

function roundRatio(value: number): number {
	return Math.round(value * 1000) / 1000;
}

function rackPlacementId(value: string): RackPlacementId {
	return value as RackPlacementId;
}

function rackForProfile(specId: RackSpecId, useLegacyStorageEconomics: boolean): RackSpec {
	const current = RACK_CATALOG[specId];
	if (!current) {
		throw new Error(`Unknown rack spec '${specId}' in scenario validation`);
	}

	if (!useLegacyStorageEconomics) {
		return current;
	}

	const override = LEGACY_STORAGE_RACK_OVERRIDES[String(specId) as keyof typeof LEGACY_STORAGE_RACK_OVERRIDES];
	if (!override) {
		return current;
	}

	return {
		...current,
		capexCost: override.capexCost,
		monthlyMaintenance: override.monthlyMaintenance,
	};
}

function serviceUnitsForRack(spec: RackSpec): number {
	switch (spec.kind) {
		case "compute":
			return spec.vCpu;
		case "memory":
			return spec.ramGb;
		case "storage":
			return spec.storageTb;
		case "gpu":
			return spec.gpuFlops;
	}
}

function rackCapex(specs: readonly RackSpec[]): Money {
	return roundMoney(specs.reduce((sum, spec) => sum + spec.capexCost, 0));
}

function rackMaintenance(specs: readonly RackSpec[]): Money {
	return roundMoney(specs.reduce((sum, spec) => sum + spec.monthlyMaintenance, 0));
}

function billedPowerKw(specs: readonly RackSpec[], requirements: ContractRequirements): number {
	const activity = allocateRackActivitySnapshot(
		specs.map((spec, index) => ({
			placementId: rackPlacementId(`scenario-${spec.id}-${index}`),
			specId: spec.id,
			kind: spec.kind,
			powerDrawKw: spec.powerDrawKw,
			serviceUnits: serviceUnitsForRack(spec),
		})),
		rackDemandByKindFromRequirements(requirements),
	);
	return activity.powerSummary.billedPowerKw;
}

function scenarioOpex(
	specs: readonly RackSpec[],
	datacenterId: DatacenterSpecId,
	regionId: RegionId,
	requirements: ContractRequirements,
): Money {
	const datacenter = Object.values(DATACENTER_CATALOG).find((candidate) => candidate.id === datacenterId);
	const region = Object.values(REGION_CATALOG).find((candidate) => candidate.id === regionId);
	if (!datacenter || !region) {
		throw new Error(`Unknown scenario datacenter '${datacenterId}' or region '${regionId}'`);
	}

	const rawPowerCost = billedPowerKw(specs, requirements) * HOURS_PER_MONTH * region.powerCostPerKwh;
	return roundMoney(
		rawPowerCost +
			rawPowerCost * COOLING_OVERHEAD_RATIO +
			datacenter.bandwidthGbps * BANDWIDTH_USD_PER_GBPS_MONTH +
			datacenter.staffCount * region.staffWage +
			rackMaintenance(specs),
	);
}

function scenarioOutcome(
	scenario: ScenarioValidationDefinition,
	pricing: ContractPricingConfig,
	useLegacyStorageEconomics: boolean,
	startingCash: Money = STARTING_CASH,
): ScenarioValidationOutcome {
	const datacenter = Object.values(DATACENTER_CATALOG).find((candidate) => candidate.id === scenario.datacenterId);
	if (!datacenter) {
		throw new Error(`Unknown datacenter '${scenario.datacenterId}' in scenario validation`);
	}

	const specs = scenario.rackSpecIds.map((specId) => rackForProfile(specId, useLegacyStorageEconomics));
	const totalRackCapex = rackCapex(specs);
	const totalCapex = roundMoney(datacenter.capexCost + totalRackCapex);
	const activeOpex = scenarioOpex(specs, scenario.datacenterId, scenario.regionId, scenario.requirements);
	const idleOpex = scenarioOpex(specs, scenario.datacenterId, scenario.regionId, {
		vCpu: 0,
		ramGb: 0,
		storageTb: 0,
		gpuFlops: 0,
	});
	const monthlyRevenue = monthlyPaymentForRequirements(
		scenario.requirements,
		scenario.difficulty,
		scenario.termMonths,
		scenario.urgency,
		pricing,
	);
	const activeMargin = roundMoney(monthlyRevenue - activeOpex);
	const paybackMonths = activeMargin > 0 ? roundRatio(totalCapex / activeMargin) : null;
	const cashAfterBuild = roundMoney(startingCash - totalCapex);
	const cashAfterOneIdleMonth = roundMoney(cashAfterBuild - idleOpex);
	const idleRunwayMonths = idleOpex > 0 ? roundRatio(cashAfterBuild / idleOpex) : Number.POSITIVE_INFINITY;

	return {
		startingCash,
		totalCapex,
		rackCapex: totalRackCapex,
		activeOpex,
		idleOpex,
		monthlyRevenue,
		activeMargin,
		paybackMonths,
		cashAfterBuild,
		cashAfterOneIdleMonth,
		idleRunwayMonths,
	};
}

export function createRebalanceScenarioValidationReport(): ScenarioValidationReport {
	return {
		legacyPricing: LEGACY_PRE_REBALANCE_PRICING,
		rebalancedPricing: REBALANCED_SCENARIO_PRICING,
		scenarios: REBALANCE_VALIDATION_SCENARIOS.map((scenario) => ({
			scenario,
			legacy: scenarioOutcome(scenario, LEGACY_PRE_REBALANCE_PRICING, true),
			rebalanced: scenarioOutcome(scenario, REBALANCED_SCENARIO_PRICING, false),
		})),
	};
}

function difficultyOutcome(
	scenario: ScenarioValidationDefinition,
	pricing: ContractPricingConfig,
	difficulty: Difficulty,
	config: DifficultyConfig,
): DifficultyRunwayValidationOutcome {
	return {
		difficulty,
		...scenarioOutcome(scenario, pricing, false, config.startingCash),
	};
}

export function createEarlyGameRunwayValidationReport(
	pricing: ContractPricingConfig = REBALANCED_SCENARIO_PRICING,
): EarlyGameRunwayValidationReport {
	return {
		pricing,
		scenarios: EARLY_GAME_RUNWAY_VALIDATION_SCENARIOS.map((scenario) => ({
			scenario,
			hard: difficultyOutcome(scenario, pricing, "hard", DIFFICULTY_CONFIG.hard),
			easy: difficultyOutcome(scenario, pricing, "easy", DIFFICULTY_CONFIG.easy),
		})),
	};
}

export function defaultRebalanceScenarioValidationReport(): ScenarioValidationReport {
	return createRebalanceScenarioValidationReport();
}
