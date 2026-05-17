import { RACK_CATALOG } from "../catalog/racks.js";
import { PRICING_WEIGHTS } from "../contracts/generator.js";
import {
	contractsFromState,
	selectLiveContracts,
	selectOpenMarketContracts,
} from "../contracts/lifecycle.js";
import {
	canPlaceRack,
	datacenterCapacity,
	datacenterCommittedContractDemand,
	datacenterContractCapacitySummary,
	datacenterUsage,
	resolveDatacenterInfrastructure,
	resolveDatacenterUpgradeState,
} from "../entities/datacenter.js";
import { COOLING_OVERHEAD_RATIO, HOURS_PER_MONTH } from "../economy/constants.js";
import type { Action } from "../state/reduce.js";
import type {
	Capacity,
	Contract,
	ContractRequirements,
	Datacenter,
	DatacenterId,
	DatacenterUpgradeTrackId,
	GameState,
	GridPosition,
	Money,
	RackKind,
	RackPlacement,
	RackPlacementId,
	Region,
	RackSpec,
	RackSpecId,
} from "../types.js";

export interface RackAdvisorOptions {
	/** Maximum payback period (months) for a buy recommendation to surface. Default 18. */
	maxPaybackMonths?: number;
	/** Number of recommendations to return per kind/category. Default top 8 overall. */
	limit?: number;
	/** Per-month discount factor used in payback comparisons. Default 0.995. */
	discountPerMonth?: number;
	/**
	 * Minimum monthly net uplift (in $) for a rebalance proposal to surface.
	 * Filters out micro-optimizations that aren't worth the disruption of a swap.
	 * Default $250.
	 */
	minRebalanceMonthlyUplift?: Money;
}

export type RackRecommendationKind = "buy" | "rebalance" | "replace" | "upgrade";

export interface BuyRackRecommendation {
	kind: "buy";
	rackSpecId: RackSpecId;
	rackSpecName: string;
	rackKind: RackKind;
	dcId: DatacenterId;
	dcName: string;
	position: GridPosition;
	capexCost: Money;
	expectedMonthlyNet: Money;
	paybackMonths: number;
	reason: string;
	action: Action;
}

export interface ReplaceRackRecommendation {
	kind: "replace";
	oldPlacementId: RackPlacementId;
	oldRackSpecId: RackSpecId;
	newRackSpecId: RackSpecId;
	newRackSpecName: string;
	dcId: DatacenterId;
	dcName: string;
	position: GridPosition;
	netCapex: Money;
	reason: string;
	actions: Action[];
}

export interface UpgradeTrackRecommendation {
	kind: "upgrade";
	dcId: DatacenterId;
	dcName: string;
	trackId: DatacenterUpgradeTrackId;
	trackLabel: string;
	targetNodeId: string;
	targetNodeLabel: string;
	capexCost: Money;
	reason: string;
	action: Action;
}

/**
 * Swap an existing rack for a different-kind rack in the same slot. Surfaces
 * when demand has shifted toward a kind that the DC is under-equipped for,
 * AND the existing rack's kind is contributing little to current/forecasted
 * income. Net delta accounts for capex of the new rack minus expected monthly
 * uplift.
 */
export interface RebalanceRackRecommendation {
	kind: "rebalance";
	dcId: DatacenterId;
	dcName: string;
	position: GridPosition;
	oldPlacementId: RackPlacementId;
	oldRackSpecId: RackSpecId;
	oldRackName: string;
	oldRackKind: RackKind;
	newRackSpecId: RackSpecId;
	newRackName: string;
	newRackKind: RackKind;
	capexCost: Money;
	/** Projected monthly net uplift (new − old) once the swap is in place. */
	expectedMonthlyNet: Money;
	/** Months to recoup the new rack's capex from the monthly uplift. */
	paybackMonths: number;
	reason: string;
	actions: Action[];
}

export type RackRecommendation =
	| BuyRackRecommendation
	| RebalanceRackRecommendation
	| ReplaceRackRecommendation
	| UpgradeTrackRecommendation;

export interface DemandSignal {
	vCpu: number;
	ramGb: number;
	storageTb: number;
	gpuFlops: number;
}

/**
 * Forward-looking mix of expected demand by rack kind, expressed as fractions
 * that sum to 1. Computed by weighting open market offers (leading indicator)
 * higher than currently-live contracts (trailing — already-priced decisions).
 */
export interface RackKindMix {
	compute: number;
	memory: number;
	storage: number;
	gpu: number;
}

export interface RackAdvisorReport {
	recommendations: RackRecommendation[];
	demandSignal: DemandSignal;
	unmetDemand: DemandSignal;
	/** Mix of currently-live contract requirements by rack kind. */
	liveDemandMix: RackKindMix;
	/** Mix of open market offers by rack kind (leading indicator). */
	marketDemandMix: RackKindMix;
	/**
	 * Weighted forecast used for rebalance scoring: market_weight * marketMix
	 * + live_weight * liveMix (renormalised to sum to 1). This is the mix the
	 * algorithm assumes will hold over the rebalance payback horizon.
	 */
	forecastDemandMix: RackKindMix;
}

const DEFAULT_MAX_PAYBACK_MONTHS = 18;
const DEFAULT_LIMIT = 8;
const DEFAULT_MIN_REBALANCE_MONTHLY_UPLIFT = 250;
// Fraction of a rack's theoretical max throughput we assume it actually books
// against market demand. A real ML on this could learn it per-region; 0.5 is a
// conservative single-DC baseline that prevents over-buying.
const ASSUMED_UTILIZATION = 0.5;
// Headroom thresholds that trigger upgrade-track recommendations.
const POWER_SATURATION_THRESHOLD = 0.85;
const COOLING_SATURATION_THRESHOLD = 0.85;
const BANDWIDTH_SATURATION_THRESHOLD = 0.85;
// Market is the forward indicator; live contracts are already-priced decisions
// reflecting past mix. Weight market higher when forecasting future demand.
const MARKET_FORECAST_WEIGHT = 0.7;
const LIVE_FORECAST_WEIGHT = 0.3;
// Cap on rebalance utilization upside so the algorithm doesn't go all-in on a
// single dominant kind. Even a 100%-storage market won't book at 100% of a
// new rack's throughput.
const REBALANCE_UTILIZATION_CEILING = 0.85;

function emptyDemand(): DemandSignal {
	return { vCpu: 0, ramGb: 0, storageTb: 0, gpuFlops: 0 };
}

function addDemand(a: DemandSignal, b: DemandSignal): DemandSignal {
	return {
		vCpu: a.vCpu + b.vCpu,
		ramGb: a.ramGb + b.ramGb,
		storageTb: a.storageTb + b.storageTb,
		gpuFlops: a.gpuFlops + b.gpuFlops,
	};
}

function findOpenSlot(datacenter: Datacenter, spec: RackSpec): GridPosition | undefined {
	const grid = datacenter.spec;
	const occupied = new Set(datacenter.placements.map((p) => `${p.row}:${p.position}`));
	for (let row = 0; row < grid.rows; row++) {
		for (let position = 0; position < grid.positionsPerRow; position++) {
			if (occupied.has(`${row}:${position}`)) continue;
			const result = canPlaceRack(datacenter, spec, { row, position });
			if (result.ok) {
				return { row, position };
			}
		}
	}
	return undefined;
}

function rackOutputForKind(spec: RackSpec): number {
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

function unitPriceForKind(kind: RackKind): number {
	switch (kind) {
		case "compute":
			return PRICING_WEIGHTS.vCpu;
		case "memory":
			return PRICING_WEIGHTS.ramGb;
		case "storage":
			return PRICING_WEIGHTS.storageTb;
		case "gpu":
			return PRICING_WEIGHTS.gpuFlops;
	}
}

function unmetDemandForKind(unmet: DemandSignal, kind: RackKind): number {
	switch (kind) {
		case "compute":
			return unmet.vCpu;
		case "memory":
			return unmet.ramGb;
		case "storage":
			return unmet.storageTb;
		case "gpu":
			return unmet.gpuFlops;
	}
}

function marginalMonthlyOpexForRack(spec: RackSpec, powerCostPerKwh: number): Money {
	const powerKwh = spec.powerDrawKw * HOURS_PER_MONTH;
	const power = powerKwh * powerCostPerKwh;
	const cooling = power * COOLING_OVERHEAD_RATIO;
	return power + cooling + spec.monthlyMaintenance;
}

/**
 * Aggregate weighted demand across open market + currently-live contracts.
 * Open market gets full weight (these are decisions we still need to make);
 * live gets half weight (already committed, but informative about steady-state mix).
 */
function aggregateDemandSignal(state: Pick<GameState, "contracts" | "contractMarket" | "activeContracts">): DemandSignal {
	const contracts = contractsFromState(state);
	const market = selectOpenMarketContracts(contracts);
	const live = selectLiveContracts(contracts);
	let signal = emptyDemand();
	for (const contract of market) {
		signal = addDemand(signal, contract.requirements);
	}
	for (const contract of live) {
		signal = addDemand(signal, {
			vCpu: contract.requirements.vCpu * 0.5,
			ramGb: contract.requirements.ramGb * 0.5,
			storageTb: contract.requirements.storageTb * 0.5,
			gpuFlops: contract.requirements.gpuFlops * 0.5,
		});
	}
	return signal;
}

/**
 * Aggregate "unmet" demand — for each market contract, the gap between its
 * requirements and the headroom of the best-fitting DC. Contracts that fit
 * cleanly contribute zero. Contracts that don't fit anywhere contribute their
 * full requirements. The result tells us *which dimension* is the bottleneck
 * blocking accepts right now.
 */
function aggregateUnmetDemand(state: Pick<GameState, "contracts" | "contractMarket" | "activeContracts" | "datacenters">): DemandSignal {
	const contracts = contractsFromState(state);
	const market = selectOpenMarketContracts(contracts);
	const live = selectLiveContracts(contracts);
	let unmet = emptyDemand();
	for (const contract of market) {
		const gaps = state.datacenters.map((dc) => {
			const available = datacenterContractCapacitySummary(dc, live).available;
			return {
				vCpu: Math.max(0, contract.requirements.vCpu - available.vCpu),
				ramGb: Math.max(0, contract.requirements.ramGb - available.ramGb),
				storageTb: Math.max(0, contract.requirements.storageTb - available.storageTb),
				gpuFlops: Math.max(0, contract.requirements.gpuFlops - available.gpuFlops),
			};
		});
		// "Best-fitting" DC = the one with the smallest total deficit.
		const best = gaps.reduce<DemandSignal | undefined>((accumulator, candidate) => {
			const candidateTotal = candidate.vCpu + candidate.ramGb + candidate.storageTb + candidate.gpuFlops;
			const accumulatorTotal = accumulator ? accumulator.vCpu + accumulator.ramGb + accumulator.storageTb + accumulator.gpuFlops : Infinity;
			return candidateTotal < accumulatorTotal ? candidate : accumulator;
		}, undefined);
		if (best) {
			unmet = addDemand(unmet, best);
		}
	}
	return unmet;
}

function reasonForBuy(spec: RackSpec, dcName: string, unmet: number, capturedMonthly: Money, paybackMonths: number): string {
	const kindLabel = spec.kind.toUpperCase();
	const unmetClause = unmet > 0
		? `Market shows ~${Math.round(unmet)} units of unmet ${kindLabel} demand.`
		: `Adds headroom for incoming ${kindLabel} contracts.`;
	return `${unmetClause} ${spec.name} on ${dcName} unlocks ~$${Math.round(capturedMonthly).toLocaleString()}/mo gross (payback ${paybackMonths.toFixed(1)} mo).`;
}

function deterministicPlacementId(dcId: DatacenterId, tick: number, slot: GridPosition, specId: RackSpecId, suffix = ""): RackPlacementId {
	return `rack-${dcId}-${tick}-${slot.row}-${slot.position}-${specId}${suffix}` as RackPlacementId;
}

function buyRecommendationsForDatacenter(
	state: Pick<GameState, "map" | "tick">,
	datacenter: Datacenter,
	demand: DemandUnits,
	unmet: DemandSignal,
	options: Required<Pick<RackAdvisorOptions, "maxPaybackMonths">>,
): BuyRackRecommendation[] {
	const region = state.map.regions.find((candidate) => candidate.id === datacenter.regionId);
	if (!region) return [];

	const recommendations: BuyRackRecommendation[] = [];
	for (const spec of Object.values(RACK_CATALOG)) {
		const slot = findOpenSlot(datacenter, spec);
		if (!slot) continue;

		// Score against the hypothetical post-buy datacenter — `projectRackContribution`
		// then naturally splits demand across all racks of the same kind that
		// would exist after the buy. Same primitive as rebalance.
		const hypotheticalPlacement: RackPlacement = {
			id: deterministicPlacementId(datacenter.id, state.tick, slot, spec.id),
			specId: spec.id,
			kind: spec.kind,
			installedAtTick: state.tick,
			health: "healthy",
			row: slot.row,
			position: slot.position,
		};
		const hypotheticalDc: Datacenter = {
			...datacenter,
			placements: [...datacenter.placements, hypotheticalPlacement],
		};
		const netMonthly = projectRackContribution(spec, hypotheticalDc, demand, region);
		if (netMonthly <= 0) continue;

		const paybackMonths = spec.capexCost / netMonthly;
		if (paybackMonths > options.maxPaybackMonths) continue;

		recommendations.push({
			kind: "buy",
			rackSpecId: spec.id,
			rackSpecName: spec.name,
			rackKind: spec.kind,
			dcId: datacenter.id,
			dcName: datacenter.name,
			position: slot,
			capexCost: spec.capexCost,
			expectedMonthlyNet: netMonthly,
			paybackMonths,
			reason: reasonForBuy(spec, datacenter.name, unmetDemandForKind(unmet, spec.kind), netMonthly, paybackMonths),
			action: {
				type: "PlaceRack",
				dcId: datacenter.id,
				specId: spec.id,
				row: slot.row,
				position: slot.position,
				placementId: hypotheticalPlacement.id,
			},
		});
	}
	return recommendations;
}

function replacementRecommendationsForDatacenter(datacenter: Datacenter, tick: number): ReplaceRackRecommendation[] {
	const recommendations: ReplaceRackRecommendation[] = [];
	const repairingRacks = datacenter.placements.filter((placement) => placement.health === "repairing");
	for (const rack of repairingRacks) {
		const oldSpec = RACK_CATALOG[rack.specId];
		if (!oldSpec) continue;
		// Default replacement: same-kind, same-tier (assume rebuilding is the
		// cleanest replacement). Players can pick an upgrade tier from the UI;
		// the advisor stays conservative on auto-suggestions.
		const newSpec = oldSpec;
		recommendations.push({
			kind: "replace",
			oldPlacementId: rack.id,
			oldRackSpecId: rack.specId,
			newRackSpecId: newSpec.id,
			newRackSpecName: newSpec.name,
			dcId: datacenter.id,
			dcName: datacenter.name,
			position: { row: (rack as RackPlacement).row, position: (rack as RackPlacement).position },
			netCapex: newSpec.capexCost,
			reason: `${newSpec.name} is under repair and currently bleeds SLA. Decommission and rebuild to restore ${newSpec.kind} capacity on ${datacenter.name}.`,
			actions: [
				{ type: "RemoveRack", dcId: datacenter.id, placementId: rack.id },
				{
					type: "PlaceRack",
					dcId: datacenter.id,
					specId: newSpec.id,
					row: (rack as RackPlacement).row,
					position: (rack as RackPlacement).position,
					placementId: deterministicPlacementId(datacenter.id, tick, { row: (rack as RackPlacement).row, position: (rack as RackPlacement).position }, newSpec.id, `-replace-${rack.id}`),
				},
			],
		});
	}
	return recommendations;
}

function upgradeRecommendationsForDatacenter(datacenter: Datacenter): UpgradeTrackRecommendation[] {
	const usage = datacenterUsage(datacenter);
	const infrastructure = resolveDatacenterInfrastructure(datacenter);
	const upgradeState = resolveDatacenterUpgradeState(datacenter);

	const powerPct = infrastructure.rackPowerCapacityKw > 0 ? usage.powerKw / infrastructure.rackPowerCapacityKw : 0;
	const coolingPct = infrastructure.coolingCapacityBtuPerHr > 0 ? usage.heatOutputBtuPerHr / infrastructure.coolingCapacityBtuPerHr : 0;
	const bandwidthPct = infrastructure.bandwidthGbps > 0 ? usage.bandwidthGbps / infrastructure.bandwidthGbps : 0;

	const recommendations: UpgradeTrackRecommendation[] = [];
	const track = (trackId: DatacenterUpgradeTrackId, label: string, pct: number, threshold: number) => {
		if (pct < threshold) return;
		const trackState = upgradeState.tracks.find((candidate) => candidate.trackId === trackId);
		if (!trackState || !trackState.nextNode) return;
		recommendations.push({
			kind: "upgrade",
			dcId: datacenter.id,
			dcName: datacenter.name,
			trackId,
			trackLabel: trackState.label,
			targetNodeId: trackState.nextNode.id,
			targetNodeLabel: trackState.nextNode.label,
			capexCost: trackState.nextNode.capexCost,
			reason: `${label} on ${datacenter.name} at ${Math.round(pct * 100)}% saturation. Upgrade to "${trackState.nextNode.label}" to unlock more racks.`,
			action: {
				type: "UpgradeDatacenter",
				dcId: datacenter.id,
				trackId,
				targetNodeId: trackState.nextNode.id,
			},
		});
	};
	track("onsiteGeneration", "Power", powerPct, POWER_SATURATION_THRESHOLD);
	track("cooling", "Cooling", coolingPct, COOLING_SATURATION_THRESHOLD);
	track("networkType", "Network", bandwidthPct, BANDWIDTH_SATURATION_THRESHOLD);
	return recommendations;
}

function mixFromContracts(contracts: readonly Contract[]): RackKindMix {
	let compute = 0;
	let memory = 0;
	let storage = 0;
	let gpu = 0;
	for (const contract of contracts) {
		// Convert capacity dimensions to $-comparable units using the same
		// pricing weights the contract generator uses. This makes a single
		// 1000 TB cold-storage offer comparable to a 5000 vCPU compute offer
		// even though the raw numbers differ by an order of magnitude.
		compute += contract.requirements.vCpu * PRICING_WEIGHTS.vCpu;
		memory += contract.requirements.ramGb * PRICING_WEIGHTS.ramGb;
		storage += contract.requirements.storageTb * PRICING_WEIGHTS.storageTb;
		gpu += contract.requirements.gpuFlops * PRICING_WEIGHTS.gpuFlops;
	}
	const total = compute + memory + storage + gpu;
	if (total === 0) {
		return { compute: 0.25, memory: 0.25, storage: 0.25, gpu: 0.25 };
	}
	return {
		compute: compute / total,
		memory: memory / total,
		storage: storage / total,
		gpu: gpu / total,
	};
}

function weightedMix(market: RackKindMix, live: RackKindMix): RackKindMix {
	const compute = market.compute * MARKET_FORECAST_WEIGHT + live.compute * LIVE_FORECAST_WEIGHT;
	const memory = market.memory * MARKET_FORECAST_WEIGHT + live.memory * LIVE_FORECAST_WEIGHT;
	const storage = market.storage * MARKET_FORECAST_WEIGHT + live.storage * LIVE_FORECAST_WEIGHT;
	const gpu = market.gpu * MARKET_FORECAST_WEIGHT + live.gpu * LIVE_FORECAST_WEIGHT;
	const total = compute + memory + storage + gpu;
	if (total === 0) {
		return { compute: 0.25, memory: 0.25, storage: 0.25, gpu: 0.25 };
	}
	return { compute: compute / total, memory: memory / total, storage: storage / total, gpu: gpu / total };
}

function mixShareForKind(mix: RackKindMix, kind: RackKind): number {
	switch (kind) {
		case "compute":
			return mix.compute;
		case "memory":
			return mix.memory;
		case "storage":
			return mix.storage;
		case "gpu":
			return mix.gpu;
	}
}

interface DemandUnits {
	vCpu: number;
	ramGb: number;
	storageTb: number;
	gpuFlops: number;
}

function demandForKind(demand: DemandUnits, kind: RackKind): number {
	switch (kind) {
		case "compute":
			return demand.vCpu;
		case "memory":
			return demand.ramGb;
		case "storage":
			return demand.storageTb;
		case "gpu":
			return demand.gpuFlops;
	}
}

/**
 * Forecast aggregate demand by dimension in raw units (vCPU, GB, TB, FLOPS).
 * Market offers carry full weight (forward indicator); live contracts get a
 * smaller weight (trailing — already paid-for decisions). The resulting
 * numbers tell the scorer "this many vCPU / GB / TB / FLOPS of demand will
 * exist in the next few ticks."
 */
function forecastDemandUnits(state: Pick<GameState, "contracts" | "contractMarket" | "activeContracts">): DemandUnits {
	const contracts = contractsFromState(state);
	const market = selectOpenMarketContracts(contracts);
	const live = selectLiveContracts(contracts);
	const demand: DemandUnits = { vCpu: 0, ramGb: 0, storageTb: 0, gpuFlops: 0 };
	for (const contract of market) {
		demand.vCpu += contract.requirements.vCpu * MARKET_FORECAST_WEIGHT;
		demand.ramGb += contract.requirements.ramGb * MARKET_FORECAST_WEIGHT;
		demand.storageTb += contract.requirements.storageTb * MARKET_FORECAST_WEIGHT;
		demand.gpuFlops += contract.requirements.gpuFlops * MARKET_FORECAST_WEIGHT;
	}
	for (const contract of live) {
		demand.vCpu += contract.requirements.vCpu * LIVE_FORECAST_WEIGHT;
		demand.ramGb += contract.requirements.ramGb * LIVE_FORECAST_WEIGHT;
		demand.storageTb += contract.requirements.storageTb * LIVE_FORECAST_WEIGHT;
		demand.gpuFlops += contract.requirements.gpuFlops * LIVE_FORECAST_WEIGHT;
	}
	return demand;
}

function sumKindOutput(datacenter: Datacenter, kind: RackKind): number {
	let total = 0;
	for (const placement of datacenter.placements) {
		const spec = RACK_CATALOG[placement.specId];
		if (spec && spec.kind === kind) {
			total += rackOutputForKind(spec);
		}
	}
	return total;
}

/**
 * Project monthly net contribution of one rack given the datacenter it would
 * live in. Models the realistic "two storage racks split the storage demand
 * between them" dynamic that the old kind-share heuristic missed.
 *
 *   bookable_units  = min(demand_for_kind, total_supply_for_kind)
 *                       × (this_rack_output / total_supply_for_kind)
 *   gross_monthly   = bookable_units × kind_unit_price
 *   net_monthly     = gross_monthly − marginal_opex
 *
 * Pass the *hypothetical* datacenter (after the proposed swap or buy) so the
 * supply denominator includes the new rack. For an "old contribution" use the
 * current datacenter. This makes (newContribution − oldContribution) the exact
 * monthly delta of the proposed change.
 *
 * Cap on bookable utilization keeps the model honest at saturation.
 */
function projectRackContribution(
	spec: RackSpec,
	datacenter: Datacenter,
	demand: DemandUnits,
	region: Region,
): Money {
	const opex = marginalMonthlyOpexForRack(spec, region.powerCostPerKwh);
	const supplyForKind = sumKindOutput(datacenter, spec.kind);
	if (supplyForKind <= 0) {
		return -opex;
	}
	const demandForThisKind = demandForKind(demand, spec.kind);
	if (demandForThisKind <= 0) {
		return -opex;
	}
	const thisRackShare = rackOutputForKind(spec) / supplyForKind;
	const bookableAtFullUtil = Math.min(demandForThisKind, supplyForKind) * thisRackShare;
	const cappedBookable = Math.min(bookableAtFullUtil, rackOutputForKind(spec) * REBALANCE_UTILIZATION_CEILING);
	const gross = cappedBookable * unitPriceForKind(spec.kind);
	return gross - opex;
}

function virtuallySwapRack(
	datacenter: Datacenter,
	oldPlacement: RackPlacement,
	newSpec: RackSpec,
): Datacenter {
	const replacement: RackPlacement = {
		id: oldPlacement.id,
		specId: newSpec.id,
		kind: newSpec.kind,
		installedAtTick: oldPlacement.installedAtTick,
		health: "healthy",
		row: oldPlacement.row,
		position: oldPlacement.position,
	};
	return {
		...datacenter,
		placements: [
			...datacenter.placements.filter((placement) => placement.id !== oldPlacement.id),
			replacement,
		],
	};
}

function canCoverCapacity(supply: Capacity, demand: ContractRequirements): boolean {
	return (
		supply.vCpu >= demand.vCpu &&
		supply.ramGb >= demand.ramGb &&
		supply.storageTb >= demand.storageTb &&
		supply.gpuFlops >= demand.gpuFlops
	);
}

/**
 * Safety gate: a rebalance proposal must not break any live contract assigned
 * to this DC. We virtually swap, then check that the post-swap usable capacity
 * still covers committed demand. This is the rebalance equivalent of the
 * `canPlaceRack` check that protects buy recommendations.
 */
function rebalancePreservesLiveContracts(
	datacenter: Datacenter,
	oldPlacement: RackPlacement,
	newSpec: RackSpec,
	liveContracts: readonly Contract[],
): boolean {
	const hypothetical = virtuallySwapRack(datacenter, oldPlacement, newSpec);
	const supply = datacenterCapacity(hypothetical);
	const demand = datacenterCommittedContractDemand(hypothetical, liveContracts);
	return canCoverCapacity(supply, demand);
}

function rebalancePassesInfrastructure(
	datacenter: Datacenter,
	oldPlacement: RackPlacement,
	newSpec: RackSpec,
): boolean {
	const withoutOld: Datacenter = {
		...datacenter,
		placements: datacenter.placements.filter((placement) => placement.id !== oldPlacement.id),
	};
	const result = canPlaceRack(withoutOld, newSpec, {
		row: oldPlacement.row,
		position: oldPlacement.position,
	});
	return result.ok;
}

function describeMixDrift(
	oldKind: RackKind,
	newKind: RackKind,
	marketMix: RackKindMix,
	liveMix: RackKindMix,
): string {
	const oldMarket = mixShareForKind(marketMix, oldKind);
	const oldLive = mixShareForKind(liveMix, oldKind);
	const newMarket = mixShareForKind(marketMix, newKind);
	const newLive = mixShareForKind(liveMix, newKind);
	const oldDrift = oldMarket - oldLive;
	const newDrift = newMarket - newLive;
	const driftClause = (kind: RackKind, drift: number): string => {
		if (drift > 0.05) return `${kind.toUpperCase()} demand rising (+${Math.round(drift * 100)}pp vs live mix)`;
		if (drift < -0.05) return `${kind.toUpperCase()} demand falling (${Math.round(drift * 100)}pp vs live mix)`;
		return `${kind.toUpperCase()} demand steady`;
	};
	return `${driftClause(oldKind, oldDrift)}; ${driftClause(newKind, newDrift)}`;
}

function rebalanceRecommendationsForDatacenter(
	state: Pick<GameState, "map" | "tick">,
	datacenter: Datacenter,
	liveContracts: readonly Contract[],
	demand: DemandUnits,
	marketMix: RackKindMix,
	liveMix: RackKindMix,
	options: Required<Pick<RackAdvisorOptions, "maxPaybackMonths" | "minRebalanceMonthlyUplift">>,
): RebalanceRackRecommendation[] {
	const region = state.map.regions.find((candidate) => candidate.id === datacenter.regionId);
	if (!region) return [];

	const recommendations: RebalanceRackRecommendation[] = [];

	for (const placement of datacenter.placements) {
		const oldSpec = RACK_CATALOG[placement.specId];
		if (!oldSpec) continue;
		// Skip racks that are currently being repaired — the *replace* category
		// handles those; rebalancing on top of a broken rack would conflict.
		if (placement.health !== "healthy") continue;

		const oldContribution = projectRackContribution(oldSpec, datacenter, demand, region);

		for (const candidateSpec of Object.values(RACK_CATALOG)) {
			if (candidateSpec.id === oldSpec.id) continue;
			if (candidateSpec.kind === oldSpec.kind) continue;
			if (!rebalancePassesInfrastructure(datacenter, placement, candidateSpec)) continue;
			if (!rebalancePreservesLiveContracts(datacenter, placement, candidateSpec, liveContracts)) continue;

			const swappedDc = virtuallySwapRack(datacenter, placement, candidateSpec);
			const newContribution = projectRackContribution(candidateSpec, swappedDc, demand, region);
			const monthlyUplift = newContribution - oldContribution;
			if (monthlyUplift < options.minRebalanceMonthlyUplift) continue;

			const paybackMonths = candidateSpec.capexCost / monthlyUplift;
			if (paybackMonths > options.maxPaybackMonths) continue;

			const driftLine = describeMixDrift(oldSpec.kind, candidateSpec.kind, marketMix, liveMix);
			recommendations.push({
				kind: "rebalance",
				dcId: datacenter.id,
				dcName: datacenter.name,
				position: { row: placement.row, position: placement.position },
				oldPlacementId: placement.id,
				oldRackSpecId: oldSpec.id,
				oldRackName: oldSpec.name,
				oldRackKind: oldSpec.kind,
				newRackSpecId: candidateSpec.id,
				newRackName: candidateSpec.name,
				newRackKind: candidateSpec.kind,
				capexCost: candidateSpec.capexCost,
				expectedMonthlyNet: monthlyUplift,
				paybackMonths,
				reason: `${driftLine}. Swap ${oldSpec.name} (~$${Math.round(oldContribution).toLocaleString()}/mo) for ${candidateSpec.name} (~$${Math.round(newContribution).toLocaleString()}/mo) on ${datacenter.name}. Net +$${Math.round(monthlyUplift).toLocaleString()}/mo, payback ${paybackMonths.toFixed(1)} mo.`,
				actions: [
					{ type: "RemoveRack", dcId: datacenter.id, placementId: placement.id },
					{
						type: "PlaceRack",
						dcId: datacenter.id,
						specId: candidateSpec.id,
						row: placement.row,
						position: placement.position,
						placementId: deterministicPlacementId(
							datacenter.id,
							state.tick,
							{ row: placement.row, position: placement.position },
							candidateSpec.id,
							`-rebalance-${placement.id}`,
						),
					},
				],
			});
		}
	}

	// For each placement, only keep the top single swap candidate — otherwise a
	// single rack generates ~12 recommendations (one per alternative spec).
	const bestByPlacement = new Map<RackPlacementId, RebalanceRackRecommendation>();
	for (const rec of recommendations) {
		const existing = bestByPlacement.get(rec.oldPlacementId);
		if (!existing || rec.expectedMonthlyNet > existing.expectedMonthlyNet) {
			bestByPlacement.set(rec.oldPlacementId, rec);
		}
	}
	return [...bestByPlacement.values()];
}

/**
 * Produce a ranked list of recommended rack-inventory actions for the current state.
 *
 * Four categories surface:
 *   - **buy**: place a new rack on an existing DC, justified by unmet market
 *     demand and projected payback period
 *   - **rebalance**: swap an existing rack for a different-kind rack in the
 *     same slot, when the demand mix has shifted and live contracts can still
 *     be served after the swap
 *   - **replace**: rebuild a rack that's currently under repair (SLA leak)
 *   - **upgrade**: advance a datacenter upgrade track (power / cooling / network)
 *     when infrastructure usage crosses a saturation threshold
 *
 * Forward-looking: rebalance scoring uses a weighted forecast of market +
 * live demand (market gets higher weight as the leading indicator), not just
 * current state. This is what makes the advisor *progressive* — it acts on
 * where demand is heading, not where it was.
 *
 * Ranking heuristic: income-improvement recommendations (buy + rebalance)
 * sorted by ascending payback period; replacements next (urgent SLA recovery);
 * upgrades last (capacity unlock for future plays).
 */
export function recommendRackActions(
	state: GameState,
	options?: RackAdvisorOptions,
): RackAdvisorReport {
	const maxPaybackMonths = options?.maxPaybackMonths ?? DEFAULT_MAX_PAYBACK_MONTHS;
	const limit = options?.limit ?? DEFAULT_LIMIT;
	const minRebalanceMonthlyUplift = options?.minRebalanceMonthlyUplift ?? DEFAULT_MIN_REBALANCE_MONTHLY_UPLIFT;

	const demandSignal = aggregateDemandSignal(state);
	const unmet = aggregateUnmetDemand(state);
	const contracts = contractsFromState(state);
	const marketContracts = selectOpenMarketContracts(contracts);
	const liveContracts = selectLiveContracts(contracts);
	const marketMix = mixFromContracts(marketContracts);
	const liveMix = mixFromContracts(liveContracts);
	const forecastMix = weightedMix(marketMix, liveMix);
	const demand = forecastDemandUnits(state);

	const buys: BuyRackRecommendation[] = [];
	const rebalances: RebalanceRackRecommendation[] = [];
	const replacements: ReplaceRackRecommendation[] = [];
	const upgrades: UpgradeTrackRecommendation[] = [];

	for (const datacenter of state.datacenters) {
		buys.push(...buyRecommendationsForDatacenter(state, datacenter, demand, unmet, { maxPaybackMonths }));
		rebalances.push(...rebalanceRecommendationsForDatacenter(
			state,
			datacenter,
			liveContracts,
			demand,
			marketMix,
			liveMix,
			{ maxPaybackMonths, minRebalanceMonthlyUplift },
		));
		replacements.push(...replacementRecommendationsForDatacenter(datacenter, state.tick));
		upgrades.push(...upgradeRecommendationsForDatacenter(datacenter));
	}

	buys.sort((a, b) => a.paybackMonths - b.paybackMonths);
	rebalances.sort((a, b) => a.paybackMonths - b.paybackMonths);

	// Deduplicate buys: only keep best (lowest payback) for each (rackKind, dcId).
	// Prevents proposing 12 storage racks all on the same DC at once.
	const seenBuy = new Set<string>();
	const dedupedBuys = buys.filter((rec) => {
		const key = `${rec.dcId}:${rec.rackKind}`;
		if (seenBuy.has(key)) return false;
		seenBuy.add(key);
		return true;
	});

	// Interleave buys and rebalances by payback period — they're directly
	// comparable income-improvement actions and the player should see them
	// ranked together.
	const incomeRecs: Array<BuyRackRecommendation | RebalanceRackRecommendation> = [
		...dedupedBuys,
		...rebalances,
	].sort((a, b) => a.paybackMonths - b.paybackMonths);

	const recommendations: RackRecommendation[] = [
		...incomeRecs,
		...replacements,
		...upgrades,
	].slice(0, limit);

	return {
		recommendations,
		demandSignal,
		unmetDemand: unmet,
		liveDemandMix: liveMix,
		marketDemandMix: marketMix,
		forecastDemandMix: forecastMix,
	};
}
