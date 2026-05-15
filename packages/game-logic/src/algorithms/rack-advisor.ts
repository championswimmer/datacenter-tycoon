import { RACK_CATALOG } from "../catalog/racks.js";
import { PRICING_WEIGHTS } from "../contracts/generator.js";
import {
	contractsFromState,
	selectLiveContracts,
	selectOpenMarketContracts,
} from "../contracts/lifecycle.js";
import {
	canPlaceRack,
	datacenterContractCapacitySummary,
	datacenterUsage,
	resolveDatacenterInfrastructure,
	resolveDatacenterUpgradeState,
} from "../entities/datacenter.js";
import { COOLING_OVERHEAD_RATIO, HOURS_PER_MONTH } from "../economy/constants.js";
import type { Action } from "../state/reduce.js";
import type {
	Datacenter,
	DatacenterId,
	DatacenterUpgradeTrackId,
	GameState,
	GridPosition,
	Money,
	RackKind,
	RackPlacement,
	RackPlacementId,
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
}

export type RackRecommendationKind = "buy" | "replace" | "upgrade";

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

export type RackRecommendation = BuyRackRecommendation | ReplaceRackRecommendation | UpgradeTrackRecommendation;

export interface DemandSignal {
	vCpu: number;
	ramGb: number;
	storageTb: number;
	gpuFlops: number;
}

export interface RackAdvisorReport {
	recommendations: RackRecommendation[];
	demandSignal: DemandSignal;
	unmetDemand: DemandSignal;
}

const DEFAULT_MAX_PAYBACK_MONTHS = 18;
const DEFAULT_LIMIT = 8;
// Fraction of a rack's theoretical max throughput we assume it actually books
// against market demand. A real ML on this could learn it per-region; 0.5 is a
// conservative single-DC baseline that prevents over-buying.
const ASSUMED_UTILIZATION = 0.5;
// Headroom thresholds that trigger upgrade-track recommendations.
const POWER_SATURATION_THRESHOLD = 0.85;
const COOLING_SATURATION_THRESHOLD = 0.85;
const BANDWIDTH_SATURATION_THRESHOLD = 0.85;

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
	unmet: DemandSignal,
	options: Required<Pick<RackAdvisorOptions, "maxPaybackMonths">>,
): BuyRackRecommendation[] {
	const region = state.map.regions.find((candidate) => candidate.id === datacenter.regionId);
	if (!region) return [];

	const recommendations: BuyRackRecommendation[] = [];
	for (const spec of Object.values(RACK_CATALOG)) {
		const slot = findOpenSlot(datacenter, spec);
		if (!slot) continue;

		const output = rackOutputForKind(spec);
		const captured = Math.min(unmetDemandForKind(unmet, spec.kind), output) * ASSUMED_UTILIZATION
			+ Math.max(0, output - unmetDemandForKind(unmet, spec.kind)) * ASSUMED_UTILIZATION * 0.3;
		const grossMonthly = captured * unitPriceForKind(spec.kind);
		const opexMonthly = marginalMonthlyOpexForRack(spec, region.powerCostPerKwh);
		const netMonthly = grossMonthly - opexMonthly;
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
			reason: reasonForBuy(spec, datacenter.name, unmetDemandForKind(unmet, spec.kind), grossMonthly, paybackMonths),
			action: {
				type: "PlaceRack",
				dcId: datacenter.id,
				specId: spec.id,
				row: slot.row,
				position: slot.position,
				placementId: deterministicPlacementId(datacenter.id, state.tick, slot, spec.id),
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

/**
 * Produce a ranked list of recommended rack-inventory actions for the current state.
 *
 * Three categories surface:
 *   - **buy**: place a new rack on an existing DC, justified by unmet market
 *     demand and projected payback period
 *   - **replace**: rebuild a rack that's currently under repair (SLA leak)
 *   - **upgrade**: advance a datacenter upgrade track (power / cooling / network)
 *     when infrastructure usage crosses a saturation threshold
 *
 * Ranking heuristic: buy recommendations sorted by ascending payback period
 * (fastest ROI first); replacements next (urgent SLA recovery); upgrades last
 * (capacity unlock for future plays).
 */
export function recommendRackActions(
	state: GameState,
	options?: RackAdvisorOptions,
): RackAdvisorReport {
	const maxPaybackMonths = options?.maxPaybackMonths ?? DEFAULT_MAX_PAYBACK_MONTHS;
	const limit = options?.limit ?? DEFAULT_LIMIT;

	const demandSignal = aggregateDemandSignal(state);
	const unmet = aggregateUnmetDemand(state);

	const buys: BuyRackRecommendation[] = [];
	const replacements: ReplaceRackRecommendation[] = [];
	const upgrades: UpgradeTrackRecommendation[] = [];

	for (const datacenter of state.datacenters) {
		buys.push(...buyRecommendationsForDatacenter(state, datacenter, unmet, { maxPaybackMonths }));
		replacements.push(...replacementRecommendationsForDatacenter(datacenter, state.tick));
		upgrades.push(...upgradeRecommendationsForDatacenter(datacenter));
	}

	buys.sort((a, b) => a.paybackMonths - b.paybackMonths);

	// Deduplicate buys: only keep best (lowest payback) for each (rackKind, dcId).
	// Prevents proposing 12 storage racks all on the same DC at once.
	const seen = new Set<string>();
	const dedupedBuys = buys.filter((rec) => {
		const key = `${rec.dcId}:${rec.rackKind}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});

	const recommendations: RackRecommendation[] = [
		...dedupedBuys,
		...replacements,
		...upgrades,
	].slice(0, limit);

	return {
		recommendations,
		demandSignal,
		unmetDemand: unmet,
	};
}
