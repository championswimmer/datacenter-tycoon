import { DATACENTER_CATALOG } from "../catalog/datacenters.js";
import { RACK_CATALOG } from "../catalog/racks.js";
import { REGION_CATALOG } from "../catalog/regions.js";
import {
	BASE_CONTRACT_MONTHLY_FEE,
	DEFAULT_CONTRACT_PRICING,
	contractMarginalPriceMultiplier,
	generateContract,
	monthlyPaymentForRequirements,
	type ContractPricingConfig,
} from "../contracts/generator.js";
import {
	BANDWIDTH_USD_PER_GBPS_MONTH,
	COOLING_OVERHEAD_RATIO,
	HOURS_PER_MONTH,
} from "../economy/constants.js";
import { createRng } from "../sim/rng.js";
import type {
	ContractRequirements,
	DatacenterSpecId,
	Money,
	RackKind,
	RackSpec,
	RackSpecId,
	RackTier,
	Region,
	RegionId,
} from "../types.js";

export type UnitEconomicsResource = keyof ContractRequirements;
export type UnitEconomicsBreakdown = Record<UnitEconomicsResource, number | null>;

export interface FacilitySlotEconomicsSnapshot {
	datacenterId: DatacenterSpecId;
	regionId: RegionId;
	slotCount: number;
	staffMonthlyOpex: Money;
	bandwidthMonthlyOpex: Money;
	totalMonthlyOpex: Money;
	monthlyOpexPerSlot: Money;
}

export interface ContractPricingAuditSnapshot {
	sampleSeed: number;
	difficulties: readonly number[];
	samplesPerDifficulty: number;
	totalSamples: number;
	baseMonthlyFee: Money;
	averageMarginalMultiplier: number;
	averageMarginalPayoutPerUnit: Record<UnitEconomicsResource, number>;
	averageMonthlyPayment: Money;
}

export interface RackUnitEconomicsSnapshot {
	rackId: RackSpecId;
	kind: RackKind;
	tier: RackTier;
	primaryResource: UnitEconomicsResource;
	primaryCapacity: number;
	capexCost: Money;
	monthlyMaintenance: Money;
	capexPerUnit: UnitEconomicsBreakdown;
	cheapestRackOnlyRegionId: RegionId;
	rackOnlyMonthlyOpex: Money;
	rackOnlyOpexPerUnit: UnitEconomicsBreakdown;
	facilityBaseline: FacilitySlotEconomicsSnapshot;
	facilityLoadedMonthlyOpex: Money;
	facilityLoadedOpexPerUnit: UnitEconomicsBreakdown;
	averageMarginalPayoutPerPrimaryUnit: number;
	grossMarginPerPrimaryUnit: number;
	grossMarginPerRack: Money;
	paybackMonths: number | null;
}

export interface UnitEconomicsAuditSnapshot {
	pricing: ContractPricingAuditSnapshot;
	cheapestFacilitySlotBaseline: FacilitySlotEconomicsSnapshot;
	racks: RackUnitEconomicsSnapshot[];
}

export interface UnitEconomicsTargetBands {
	minimumGrossMarginPerPrimaryUnit: Record<Exclude<RackKind, "gpu">, number>;
	maximumPaybackMonths: {
		compute: number;
		memory: number;
	};
	minimumStoragePaybackMonths: number;
	minimumStorageToFastestNonStoragePaybackRatio: number;
}

export interface UnitEconomicsTargetEvaluation {
	allSatisfied: boolean;
	sameTierStorageCapexBelowMemory: Record<RackTier, boolean>;
	storageCheapestCapexPerTbByTier: Record<RackTier, boolean>;
	storageCheapestRackOnlyOpexPerTbByTier: Record<RackTier, boolean>;
	storageCheapestFacilityLoadedOpexPerTbByTier: Record<RackTier, boolean>;
	minimumGrossMarginPerPrimaryUnitMet: Record<Exclude<RackKind, "gpu">, boolean>;
	maximumPaybackMonthsMet: {
		compute: boolean;
		memory: boolean;
	};
	minimumStoragePaybackMonthsMet: boolean;
	storagePaybackVsFastestNonStorageRatio: number;
	storagePaybackRatioMet: boolean;
}

export interface UnitEconomicsAuditOptions {
	pricing?: ContractPricingConfig;
	sampleSeed?: number;
	difficulties?: readonly number[];
	samplesPerDifficulty?: number;
}

export const DEFAULT_UNIT_ECONOMICS_SAMPLE_SEED = 40_040;
export const DEFAULT_UNIT_ECONOMICS_DIFFICULTIES = [0.2, 0.35, 0.5, 0.65, 0.8] as const;
export const DEFAULT_UNIT_ECONOMICS_SAMPLES_PER_DIFFICULTY = 24;
export const UNIT_ECONOMICS_TARGET_BANDS: UnitEconomicsTargetBands = {
	minimumGrossMarginPerPrimaryUnit: {
		compute: 15,
		memory: 0.7,
		storage: 12,
	},
	maximumPaybackMonths: {
		compute: 24,
		memory: 45,
	},
	minimumStoragePaybackMonths: 10,
	minimumStorageToFastestNonStoragePaybackRatio: 0.7,
};

export const PRIMARY_RESOURCE_BY_RACK_KIND: Record<RackKind, UnitEconomicsResource> = {
	compute: "vCpu",
	memory: "ramGb",
	storage: "storageTb",
	gpu: "gpuFlops",
};

function roundMoney(value: number): Money {
	return Math.round(value * 100) / 100;
}

function roundRatio(value: number): number {
	return Math.round(value * 1000) / 1000;
}

function perUnit(amount: number, capacity: number): number | null {
	if (capacity <= 0) {
		return null;
	}

	return roundRatio(amount / capacity);
}

function metricBreakdown(spec: RackSpec, amount: number): UnitEconomicsBreakdown {
	return {
		vCpu: perUnit(amount, spec.vCpu),
		ramGb: perUnit(amount, spec.ramGb),
		storageTb: perUnit(amount, spec.storageTb),
		gpuFlops: perUnit(amount, spec.gpuFlops),
	};
}

function primaryCapacity(spec: RackSpec): number {
	return spec[PRIMARY_RESOURCE_BY_RACK_KIND[spec.kind]];
}

export function rackOnlyMonthlyOpex(spec: RackSpec, region: Pick<Region, "powerCostPerKwh">): Money {
	const monthlyPower = spec.powerDrawKw * HOURS_PER_MONTH * region.powerCostPerKwh;
	return roundMoney(spec.monthlyMaintenance + monthlyPower * (1 + COOLING_OVERHEAD_RATIO));
}

export function facilitySlotBaselineOpex(
	datacenter: (typeof DATACENTER_CATALOG)[keyof typeof DATACENTER_CATALOG],
	region: Pick<Region, "id" | "staffWage">,
): FacilitySlotEconomicsSnapshot {
	const slotCount = datacenter.rows * datacenter.positionsPerRow;
	const staffMonthlyOpex = roundMoney(datacenter.staffCount * region.staffWage);
	const bandwidthMonthlyOpex = roundMoney(datacenter.bandwidthGbps * BANDWIDTH_USD_PER_GBPS_MONTH);
	const totalMonthlyOpex = roundMoney(staffMonthlyOpex + bandwidthMonthlyOpex);
	return {
		datacenterId: datacenter.id,
		regionId: region.id,
		slotCount,
		staffMonthlyOpex,
		bandwidthMonthlyOpex,
		totalMonthlyOpex,
		monthlyOpexPerSlot: roundMoney(totalMonthlyOpex / slotCount),
	};
}

export function auditContractPricing(options: UnitEconomicsAuditOptions = {}): ContractPricingAuditSnapshot {
	const pricing = options.pricing ?? DEFAULT_CONTRACT_PRICING;
	const sampleSeed = options.sampleSeed ?? DEFAULT_UNIT_ECONOMICS_SAMPLE_SEED;
	const difficulties = options.difficulties ?? DEFAULT_UNIT_ECONOMICS_DIFFICULTIES;
	const samplesPerDifficulty = options.samplesPerDifficulty ?? DEFAULT_UNIT_ECONOMICS_SAMPLES_PER_DIFFICULTY;
	const rng = createRng(sampleSeed);

	let totalSamples = 0;
	let totalMarginalMultiplier = 0;
	let totalMonthlyPayment = 0;

	for (const difficulty of difficulties) {
		for (let index = 0; index < samplesPerDifficulty; index += 1) {
			const contract = generateContract(rng, difficulty);
			totalSamples += 1;
			totalMarginalMultiplier += contractMarginalPriceMultiplier(difficulty, contract.termMonths, contract.urgency);
			totalMonthlyPayment += monthlyPaymentForRequirements(
				contract.requirements,
				difficulty,
				contract.termMonths,
				contract.urgency,
				pricing,
			);
		}
	}

	const averageMarginalMultiplier = totalMarginalMultiplier / totalSamples;
	return {
		sampleSeed,
		difficulties: [...difficulties],
		samplesPerDifficulty,
		totalSamples,
		baseMonthlyFee: pricing.baseMonthlyFee,
		averageMarginalMultiplier: roundRatio(averageMarginalMultiplier),
		averageMarginalPayoutPerUnit: {
			vCpu: roundRatio(pricing.weights.vCpu * averageMarginalMultiplier),
			ramGb: roundRatio(pricing.weights.ramGb * averageMarginalMultiplier),
			storageTb: roundRatio(pricing.weights.storageTb * averageMarginalMultiplier),
			gpuFlops: roundRatio(pricing.weights.gpuFlops * averageMarginalMultiplier),
		},
		averageMonthlyPayment: roundMoney(totalMonthlyPayment / totalSamples),
	};
}

export function createUnitEconomicsAudit(options: UnitEconomicsAuditOptions = {}): UnitEconomicsAuditSnapshot {
	const pricing = auditContractPricing(options);
	const facilityCandidates = Object.values(DATACENTER_CATALOG)
		.flatMap((datacenter) =>
			Object.values(REGION_CATALOG).map((region) => facilitySlotBaselineOpex(datacenter, region)),
		)
		.sort((left, right) => left.monthlyOpexPerSlot - right.monthlyOpexPerSlot);
	const cheapestFacilitySlotBaseline = facilityCandidates[0]!;

	const racks = Object.values(RACK_CATALOG)
		.slice()
		.sort((left, right) => left.id.localeCompare(right.id))
		.map<RackUnitEconomicsSnapshot>((spec) => {
			const cheapestRackOnly = Object.values(REGION_CATALOG)
				.map((region) => ({ regionId: region.id, monthlyOpex: rackOnlyMonthlyOpex(spec, region) }))
				.sort((left, right) => left.monthlyOpex - right.monthlyOpex)[0]!;
			const facilityLoadedMonthlyOpex = roundMoney(
				cheapestRackOnly.monthlyOpex + cheapestFacilitySlotBaseline.monthlyOpexPerSlot,
			);
			const primaryResource = PRIMARY_RESOURCE_BY_RACK_KIND[spec.kind];
			const primaryUnitPayout = pricing.averageMarginalPayoutPerUnit[primaryResource];
			const primaryUnitFacilityOpex = perUnit(facilityLoadedMonthlyOpex, primaryCapacity(spec)) ?? 0;
			const grossMarginPerPrimaryUnit = roundRatio(primaryUnitPayout - primaryUnitFacilityOpex);
			const grossMarginPerRack = roundMoney(grossMarginPerPrimaryUnit * primaryCapacity(spec));
			const paybackMonths = grossMarginPerRack > 0 ? roundRatio(spec.capexCost / grossMarginPerRack) : null;

			return {
				rackId: spec.id,
				kind: spec.kind,
				tier: spec.tier,
				primaryResource,
				primaryCapacity: primaryCapacity(spec),
				capexCost: spec.capexCost,
				monthlyMaintenance: spec.monthlyMaintenance,
				capexPerUnit: metricBreakdown(spec, spec.capexCost),
				cheapestRackOnlyRegionId: cheapestRackOnly.regionId,
				rackOnlyMonthlyOpex: cheapestRackOnly.monthlyOpex,
				rackOnlyOpexPerUnit: metricBreakdown(spec, cheapestRackOnly.monthlyOpex),
				facilityBaseline: cheapestFacilitySlotBaseline,
				facilityLoadedMonthlyOpex,
				facilityLoadedOpexPerUnit: metricBreakdown(spec, facilityLoadedMonthlyOpex),
				averageMarginalPayoutPerPrimaryUnit: primaryUnitPayout,
				grossMarginPerPrimaryUnit,
				grossMarginPerRack,
				paybackMonths,
			};
		});

	return {
		pricing,
		cheapestFacilitySlotBaseline,
		racks,
	};
}

function rackForKindAndTier(
	audit: UnitEconomicsAuditSnapshot,
	kind: Exclude<RackKind, "gpu">,
	tier: RackTier,
): RackUnitEconomicsSnapshot {
	const rack = audit.racks.find((candidate) => candidate.kind === kind && candidate.tier === tier);
	if (!rack) {
		throw new Error(`Missing ${kind} rack for tier ${tier} in economics audit`);
	}

	return rack;
}

export function evaluateUnitEconomicsTargets(
	audit: UnitEconomicsAuditSnapshot,
	targets: UnitEconomicsTargetBands = UNIT_ECONOMICS_TARGET_BANDS,
): UnitEconomicsTargetEvaluation {
	const tiers = [0, 1, 2, 3] as const;
	const paybackTiers = [1, 2, 3] as const;

	const sameTierStorageCapexBelowMemory = Object.fromEntries(
		tiers.map((tier) => [tier, rackForKindAndTier(audit, "storage", tier).capexCost < rackForKindAndTier(audit, "memory", tier).capexCost]),
	) as Record<RackTier, boolean>;
	const storageCheapestCapexPerTbByTier = Object.fromEntries(
		tiers.map((tier) => {
			const storage = rackForKindAndTier(audit, "storage", tier);
			const compute = rackForKindAndTier(audit, "compute", tier);
			const memory = rackForKindAndTier(audit, "memory", tier);
			return [
				tier,
				(storage.capexPerUnit.storageTb ?? Infinity) < (compute.capexPerUnit.storageTb ?? Infinity) &&
					(storage.capexPerUnit.storageTb ?? Infinity) < (memory.capexPerUnit.storageTb ?? Infinity),
			];
		}),
	) as Record<RackTier, boolean>;
	const storageCheapestRackOnlyOpexPerTbByTier = Object.fromEntries(
		tiers.map((tier) => {
			const storage = rackForKindAndTier(audit, "storage", tier);
			const compute = rackForKindAndTier(audit, "compute", tier);
			const memory = rackForKindAndTier(audit, "memory", tier);
			return [
				tier,
				(storage.rackOnlyOpexPerUnit.storageTb ?? Infinity) < (compute.rackOnlyOpexPerUnit.storageTb ?? Infinity) &&
					(storage.rackOnlyOpexPerUnit.storageTb ?? Infinity) < (memory.rackOnlyOpexPerUnit.storageTb ?? Infinity),
			];
		}),
	) as Record<RackTier, boolean>;
	const storageCheapestFacilityLoadedOpexPerTbByTier = Object.fromEntries(
		tiers.map((tier) => {
			const storage = rackForKindAndTier(audit, "storage", tier);
			const compute = rackForKindAndTier(audit, "compute", tier);
			const memory = rackForKindAndTier(audit, "memory", tier);
			return [
				tier,
				(storage.facilityLoadedOpexPerUnit.storageTb ?? Infinity) <
					(compute.facilityLoadedOpexPerUnit.storageTb ?? Infinity) &&
					(storage.facilityLoadedOpexPerUnit.storageTb ?? Infinity) <
						(memory.facilityLoadedOpexPerUnit.storageTb ?? Infinity),
			];
		}),
	) as Record<RackTier, boolean>;
	const minimumGrossMarginPerPrimaryUnitMet = {
		compute: paybackTiers.every(
			(tier) => rackForKindAndTier(audit, "compute", tier).grossMarginPerPrimaryUnit >= targets.minimumGrossMarginPerPrimaryUnit.compute,
		),
		memory: paybackTiers.every(
			(tier) => rackForKindAndTier(audit, "memory", tier).grossMarginPerPrimaryUnit >= targets.minimumGrossMarginPerPrimaryUnit.memory,
		),
		storage: paybackTiers.every(
			(tier) => rackForKindAndTier(audit, "storage", tier).grossMarginPerPrimaryUnit >= targets.minimumGrossMarginPerPrimaryUnit.storage,
		),
	};
	const maximumPaybackMonthsMet = {
		compute: paybackTiers.every(
			(tier) => (rackForKindAndTier(audit, "compute", tier).paybackMonths ?? Infinity) <= targets.maximumPaybackMonths.compute,
		),
		memory: paybackTiers.every(
			(tier) => (rackForKindAndTier(audit, "memory", tier).paybackMonths ?? Infinity) <= targets.maximumPaybackMonths.memory,
		),
	};
	const storagePaybacks = paybackTiers.map((tier) => rackForKindAndTier(audit, "storage", tier).paybackMonths ?? Infinity);
	const nonStoragePaybacks = paybackTiers.flatMap((tier) => [
		rackForKindAndTier(audit, "compute", tier).paybackMonths ?? Infinity,
		rackForKindAndTier(audit, "memory", tier).paybackMonths ?? Infinity,
	]);
	const minimumStoragePaybackMonthsMet = storagePaybacks.every((payback) => payback >= targets.minimumStoragePaybackMonths);
	const storagePaybackVsFastestNonStorageRatio = roundRatio(
		Math.min(...storagePaybacks) / Math.min(...nonStoragePaybacks),
	);
	const storagePaybackRatioMet =
		storagePaybackVsFastestNonStorageRatio >= targets.minimumStorageToFastestNonStoragePaybackRatio;
	const allSatisfied =
		Object.values(sameTierStorageCapexBelowMemory).every(Boolean) &&
		Object.values(storageCheapestCapexPerTbByTier).every(Boolean) &&
		Object.values(storageCheapestRackOnlyOpexPerTbByTier).every(Boolean) &&
		Object.values(storageCheapestFacilityLoadedOpexPerTbByTier).every(Boolean) &&
		Object.values(minimumGrossMarginPerPrimaryUnitMet).every(Boolean) &&
		Object.values(maximumPaybackMonthsMet).every(Boolean) &&
		minimumStoragePaybackMonthsMet &&
		storagePaybackRatioMet;

	return {
		allSatisfied,
		sameTierStorageCapexBelowMemory,
		storageCheapestCapexPerTbByTier,
		storageCheapestRackOnlyOpexPerTbByTier,
		storageCheapestFacilityLoadedOpexPerTbByTier,
		minimumGrossMarginPerPrimaryUnitMet,
		maximumPaybackMonthsMet,
		minimumStoragePaybackMonthsMet,
		storagePaybackVsFastestNonStorageRatio,
		storagePaybackRatioMet,
	};
}

export function defaultUnitEconomicsAudit(): UnitEconomicsAuditSnapshot {
	return createUnitEconomicsAudit({
		sampleSeed: DEFAULT_UNIT_ECONOMICS_SAMPLE_SEED,
		difficulties: DEFAULT_UNIT_ECONOMICS_DIFFICULTIES,
		samplesPerDifficulty: DEFAULT_UNIT_ECONOMICS_SAMPLES_PER_DIFFICULTY,
		pricing: {
			...DEFAULT_CONTRACT_PRICING,
			baseMonthlyFee: BASE_CONTRACT_MONTHLY_FEE,
		},
	});
}
