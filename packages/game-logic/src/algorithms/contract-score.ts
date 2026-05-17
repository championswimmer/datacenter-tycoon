import { DIFFICULTY_CONFIG } from "../balance/difficulty.js";
import {
	RELIABILITY_DELTA_BREACHED,
	RELIABILITY_DELTA_CANCELLED,
	RELIABILITY_DELTA_FULFILLED,
} from "../balance/reliability.js";
import { contractsFromState, isLiveContract, selectLiveContracts } from "../contracts/lifecycle.js";
import {
	datacenterCommittedContractDemand,
	datacenterContractCapacitySummary,
	datacenterRackPowerSummary,
} from "../entities/datacenter.js";
import { COOLING_OVERHEAD_RATIO, HOURS_PER_MONTH } from "../economy/constants.js";
import type {
	Capacity,
	Contract,
	ContractRequirements,
	Datacenter,
	DatacenterId,
	GameState,
	Money,
	Region,
} from "../types.js";

export const DEFAULT_DISCOUNT_PER_MONTH = 0.995;

// Cash-equivalent value of one reliability point. Calibrated against the
// average $/month that one additional offer-slot brings (bronze=3 → diamond=10
// offers; ~7 extra slots over 80 reliability points → ~$2k per reliability
// point as a starting baseline). Tunable via options without code change.
export const DEFAULT_RELIABILITY_CASH_PER_POINT = 2_000;

export interface ContractScoreOptions {
	/** Per-month discount factor, e.g. 0.995. */
	discountPerMonth?: number;
	/** $ per reliability point used to convert ΔRel into cash. */
	reliabilityCashPerPoint?: number;
	/** Horizon cap, in months, for valuing remaining term. Defaults to the term itself. */
	horizonMonthsCap?: number;
}

export interface ContractValueBreakdown {
	dcId: DatacenterId;
	monthsValued: number;
	grossRevenue: Money;
	expectedPenalty: Money;
	marginalOpex: Money;
	reliabilityValue: Money;
	cancelCost: Money;
	/** Net present value in $ — sum of all components above (signs included). */
	npv: Money;
	fits: boolean;
}

interface ResolvedOptions {
	discountPerMonth: number;
	reliabilityCashPerPoint: number;
	horizonMonthsCap: number;
}

const DEFAULT_HORIZON_CAP = 36;

function resolveOptions(options?: ContractScoreOptions): ResolvedOptions {
	return {
		discountPerMonth: options?.discountPerMonth ?? DEFAULT_DISCOUNT_PER_MONTH,
		reliabilityCashPerPoint: options?.reliabilityCashPerPoint ?? DEFAULT_RELIABILITY_CASH_PER_POINT,
		horizonMonthsCap: options?.horizonMonthsCap ?? DEFAULT_HORIZON_CAP,
	};
}

function discountedAnnuityFactor(months: number, discountPerMonth: number): number {
	if (months <= 0) {
		return 0;
	}

	if (discountPerMonth >= 1) {
		return months;
	}

	// Σ_{t=1..T} γ^t  =  γ (1 − γ^T) / (1 − γ)
	const numerator = discountPerMonth * (1 - Math.pow(discountPerMonth, months));
	return numerator / (1 - discountPerMonth);
}

function addRequirements(a: ContractRequirements, b: ContractRequirements): ContractRequirements {
	return {
		vCpu: a.vCpu + b.vCpu,
		ramGb: a.ramGb + b.ramGb,
		storageTb: a.storageTb + b.storageTb,
		gpuFlops: a.gpuFlops + b.gpuFlops,
	};
}

function canCoverRequirements(capacity: Capacity, requirements: ContractRequirements): boolean {
	return (
		capacity.vCpu >= requirements.vCpu &&
		capacity.ramGb >= requirements.ramGb &&
		capacity.storageTb >= requirements.storageTb &&
		capacity.gpuFlops >= requirements.gpuFlops
	);
}

function getRegionOrThrow(state: Pick<GameState, "map">, datacenter: Datacenter): Region {
	const region = state.map.regions.find((candidate) => candidate.id === datacenter.regionId);
	if (!region) {
		throw new Error(`Unknown region ${datacenter.regionId} for datacenter ${datacenter.id}`);
	}

	return region;
}

/**
 * Shapley-correct marginal monthly opex for serving `additionalDemand` on top
 * of the DC's currently-assigned demand. Computes the delta in billed power
 * (idle baseline + active load), then prices it via the region's $/kWh and the
 * cooling overhead ratio.
 *
 * Bandwidth, staff, maintenance, and upgrade costs are unaffected by accepting
 * a single contract, so they fall out of the delta — only power-driven costs
 * remain.
 */
function marginalMonthlyOpex(
	datacenter: Datacenter,
	region: Region,
	currentDemand: ContractRequirements,
	additionalDemand: ContractRequirements,
): Money {
	const baselineKw = datacenterRackPowerSummary(datacenter, currentDemand).billedPowerKw;
	const withContractKw = datacenterRackPowerSummary(
		datacenter,
		addRequirements(currentDemand, additionalDemand),
	).billedPowerKw;
	const deltaKw = Math.max(0, withContractKw - baselineKw);
	const monthlyKwh = deltaKw * HOURS_PER_MONTH;
	const power = monthlyKwh * region.powerCostPerKwh;
	const cooling = power * COOLING_OVERHEAD_RATIO;
	return power + cooling;
}

interface CoreScoreArgs {
	contract: Contract;
	datacenter: Datacenter;
	region: Region;
	currentDemand: ContractRequirements;
	headroom: Capacity;
	monthsRemaining: number;
	breachPenaltyMultiplier: number;
	reliabilityDelta: number;
	cancelReliabilityCost: number;
}

function computeScore(args: CoreScoreArgs, resolved: ResolvedOptions): ContractValueBreakdown {
	const months = Math.max(0, Math.min(args.monthsRemaining, resolved.horizonMonthsCap));
	const annuityFactor = discountedAnnuityFactor(months, resolved.discountPerMonth);
	const fits = canCoverRequirements(args.headroom, args.contract.requirements);

	// Single-contract breach probability heuristic for M1:
	//   0 when the contract fits cleanly in current headroom,
	//   1 when it does not. Future layers refine this with a per-tick failure
	//   model and rack-failure probabilities.
	const probBreach = fits ? 0 : 1;

	const grossRevenue = args.contract.monthlyPayment * annuityFactor * (1 - probBreach);
	const penaltyDollars = args.contract.penaltyPerMonth * args.breachPenaltyMultiplier;
	const expectedPenalty = -penaltyDollars * annuityFactor * probBreach;
	const marginal = fits
		? marginalMonthlyOpex(args.datacenter, args.region, args.currentDemand, args.contract.requirements)
		: 0;
	const marginalOpex = -marginal * annuityFactor;
	const reliabilityValue = args.reliabilityDelta * resolved.reliabilityCashPerPoint;
	const cancelCost = args.cancelReliabilityCost * resolved.reliabilityCashPerPoint;

	const npv = grossRevenue + expectedPenalty + marginalOpex + reliabilityValue - cancelCost;

	return {
		dcId: args.datacenter.id,
		monthsValued: months,
		grossRevenue,
		expectedPenalty,
		marginalOpex,
		reliabilityValue,
		cancelCost,
		npv,
		fits,
	};
}

/**
 * Score a market contract against a specific datacenter. Returns the expected
 * NPV (in $) of accepting this contract on that DC for its full term.
 *
 * `fits === false` means the DC doesn't currently have enough free capacity;
 * the score will be heavily negative due to expected breaches. Callers wanting
 * to know "would this fit if I dropped contract X first" should remove X from
 * live contracts before calling.
 */
export function scoreMarketContractForDatacenter(
	state: Pick<GameState, "contracts" | "contractMarket" | "activeContracts" | "datacenters" | "map" | "difficulty">,
	contract: Contract,
	datacenter: Datacenter,
	options?: ContractScoreOptions,
): ContractValueBreakdown {
	const resolved = resolveOptions(options);
	const region = getRegionOrThrow(state, datacenter);
	const liveContracts = selectLiveContracts(contractsFromState(state));
	const summary = datacenterContractCapacitySummary(datacenter, liveContracts);
	const breachPenaltyMultiplier = DIFFICULTY_CONFIG[state.difficulty].breachPenaltyMultiplier;

	return computeScore(
		{
			contract,
			datacenter,
			region,
			currentDemand: summary.committed,
			headroom: summary.available,
			monthsRemaining: contract.termMonths,
			breachPenaltyMultiplier,
			reliabilityDelta: RELIABILITY_DELTA_FULFILLED,
			cancelReliabilityCost: 0,
		},
		resolved,
	);
}

/**
 * Score a market contract against every datacenter it could plausibly land
 * on, returning each candidate's breakdown ranked by NPV descending. The best
 * candidate is `result[0]`.
 *
 * Datacenters where the contract cannot fit are still returned (with `fits =
 * false`), so callers can decide whether to consider swaps.
 */
export function scoreMarketContract(
	state: Pick<GameState, "contracts" | "contractMarket" | "activeContracts" | "datacenters" | "map" | "difficulty">,
	contract: Contract,
	options?: ContractScoreOptions,
): ContractValueBreakdown[] {
	const candidates = state.datacenters.map((datacenter) =>
		scoreMarketContractForDatacenter(state, contract, datacenter, options),
	);
	return candidates.sort((a, b) => b.npv - a.npv);
}

/**
 * Score a live contract's *remaining* value to the player given its current
 * assigned datacenter. Used to compare against market alternatives when
 * deciding whether to cancel.
 *
 * The score does NOT subtract the reliability cancel cost — callers add that
 * separately when modelling a cancellation, because the cost is paid against
 * the *gain* of a replacement contract, not against the live contract itself.
 */
export function scoreLiveContract(
	state: Pick<GameState, "contracts" | "contractMarket" | "activeContracts" | "datacenters" | "map" | "difficulty" | "tick">,
	contract: Contract,
	options?: ContractScoreOptions,
): ContractValueBreakdown {
	if (!isLiveContract(contract)) {
		throw new Error(`scoreLiveContract called on non-live contract ${contract.id}`);
	}

	if (!contract.assignedDcId) {
		throw new Error(`Live contract ${contract.id} has no assignedDcId`);
	}

	const resolved = resolveOptions(options);
	const datacenter = state.datacenters.find((candidate) => candidate.id === contract.assignedDcId);
	if (!datacenter) {
		throw new Error(`Live contract ${contract.id} references missing datacenter ${contract.assignedDcId}`);
	}

	const region = getRegionOrThrow(state, datacenter);
	const liveContracts = selectLiveContracts(contractsFromState(state));

	// Marginal opex for an already-live contract is measured by removing it
	// from current demand (what we'd save by cancelling), so the "current"
	// demand baseline excludes this contract.
	const demandWithoutThis = datacenterCommittedContractDemand(
		datacenter,
		liveContracts.filter((candidate) => candidate.id !== contract.id),
	);

	const startedAtTick = contract.startedAtTick ?? state.tick;
	const elapsed = Math.max(0, state.tick - startedAtTick);
	const monthsRemaining = Math.max(0, contract.termMonths - elapsed);
	const breachPenaltyMultiplier = DIFFICULTY_CONFIG[state.difficulty].breachPenaltyMultiplier;
	const isCurrentlyBreached = contract.lifecycleState === "breached";

	const summary = datacenterContractCapacitySummary(datacenter, liveContracts);
	// For a live contract, "headroom" we care about is whether the DC can
	// still serve it. Available capacity already excludes this contract's
	// committed demand, so add it back to test "can the DC serve THIS one?".
	const headroomForThis: Capacity = {
		vCpu: summary.available.vCpu + contract.requirements.vCpu,
		ramGb: summary.available.ramGb + contract.requirements.ramGb,
		storageTb: summary.available.storageTb + contract.requirements.storageTb,
		gpuFlops: summary.available.gpuFlops + contract.requirements.gpuFlops,
	};

	return computeScore(
		{
			contract,
			datacenter,
			region,
			currentDemand: demandWithoutThis,
			headroom: headroomForThis,
			monthsRemaining,
			breachPenaltyMultiplier,
			reliabilityDelta: isCurrentlyBreached ? RELIABILITY_DELTA_BREACHED : RELIABILITY_DELTA_FULFILLED,
			cancelReliabilityCost: 0,
		},
		resolved,
	);
}

/**
 * Cash-equivalent cost of cancelling a live contract, expressed as a positive
 * number. Used by the reshuffler when computing swap-chain net value:
 *
 *     swapDelta = NPV(newContract) − NPV(liveBeingCancelled) − cancelCost(live)
 */
export function cancelReliabilityCashCost(options?: ContractScoreOptions): Money {
	const resolved = resolveOptions(options);
	return Math.abs(RELIABILITY_DELTA_CANCELLED) * resolved.reliabilityCashPerPoint;
}
