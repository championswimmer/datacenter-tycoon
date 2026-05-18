import { REGIONAL_FABRIC_JOIN_COST } from "../balance/fabric.js";
import { repairDurationDays, repairProgressPerSubtick } from "../sim/maintenance.js";
import { rackFailureRiskView } from "../sim/maintenance.js";
import { getDatacenterUpgradeTrackDefinition } from "../catalog/datacenter-upgrades.js";
import { contractsFromState, selectLiveContracts } from "../contracts/lifecycle.js";
import {
	datacenterBaseInfrastructure,
	datacenterCommittedContractDemand,
	datacenterMaintenanceStaffingView,
	datacenterRackActivityView,
	datacenterRackPowerSummary,
	resolveDatacenterInfrastructure,
	resolveDatacenterUpgradeEconomics,
	resolveDatacenterUpgradeState,
	summarizeAllDatacenterOperationalCapacities,
	type DatacenterContractCapacitySummary,
	type DatacenterMaintenanceStaffingView,
} from "../entities/datacenter.js";
import {
	getRegionFabricMemberIds,
	isDatacenterFiberEligible,
	isDatacenterInRegionFabric,
	listRegionDatacenters,
	summarizeDistinctCapacityPools,
	summarizeFabricCapacityForDatacenter,
	type CapacityPoolSummary,
	type FabricCapacitySummary,
} from "../entities/fabric.js";
import type {
	Capacity,
	Datacenter,
	DatacenterId,
	DatacenterInfrastructureProfile,
	DatacenterUpgradeTrackId,
	DatacenterUpgradeTrackNode,
	GameState,
	Money,
	RackActivityView,
	RackHealthStatus,
	RackPlacementId,
	RackPowerSummary,
	RegionId,
} from "../types.js";

const EMPTY_CAPACITY: Capacity = {
	vCpu: 0,
	ramGb: 0,
	storageTb: 0,
	gpuFlops: 0,
};

function accumulateCapacity(total: Capacity, delta: Capacity): void {
	total.vCpu += delta.vCpu;
	total.ramGb += delta.ramGb;
	total.storageTb += delta.storageTb;
	total.gpuFlops += delta.gpuFlops;
}

function getDatacenterOrThrow(datacenters: readonly Datacenter[], dcId: DatacenterId): Datacenter {
	const datacenter = datacenters.find((candidate) => candidate.id === dcId);
	if (!datacenter) {
		throw new Error(`Unknown datacenter: ${dcId}`);
	}

	return datacenter;
}

function getRegionOrThrow(state: Pick<GameState, "map">, regionId: RegionId) {
	const region = state.map.regions.find((candidate) => candidate.id === regionId);
	if (!region) {
		throw new Error(`Unknown region: ${regionId}`);
	}

	return region;
}

export interface DatacenterCapacityFromStateSummary extends DatacenterContractCapacitySummary {
	dcId: DatacenterId;
}

export interface DatacenterInfrastructureView {
	dcId: DatacenterId;
	base: DatacenterInfrastructureProfile;
	effective: DatacenterInfrastructureProfile;
	fabricEligible: boolean;
}

export interface DatacenterUpgradeNodeView {
	id: string;
	label: string;
	capexCost: number;
	fixedMonthlyOpex: number;
	infrastructure: DatacenterUpgradeTrackNode["infrastructure"];
}

export type DatacenterUpgradeTrackNodeStatus = "completed" | "current" | "available" | "locked";

export interface DatacenterUpgradeTrackLadderNodeView extends DatacenterUpgradeNodeView {
	index: number;
	status: DatacenterUpgradeTrackNodeStatus;
}

export interface DatacenterUpgradeTrackView {
	dcId: DatacenterId;
	trackId: DatacenterUpgradeTrackId;
	label: string;
	presentation: "level" | "slots";
	currentNode: DatacenterUpgradeNodeView;
	nextNode: (DatacenterUpgradeNodeView & { fixedMonthlyOpexDelta: number }) | null;
	maxNode: DatacenterUpgradeNodeView;
	currentNodeIndex: number;
	totalNodes: number;
	nodes: DatacenterUpgradeTrackLadderNodeView[];
	maxed: boolean;
}

export interface DatacenterUpgradeView {
	dcId: DatacenterId;
	infrastructure: DatacenterInfrastructureView;
	tracks: DatacenterUpgradeTrackView[];
	fixedMonthlyUpgradeOpex: number;
	fabricEligible: boolean;
}

export interface NetworkCapacitySummary {
	installed: Capacity;
	usable: Capacity;
	committed: Capacity;
	available: Capacity;
	perDc: DatacenterCapacityFromStateSummary[];
}

export interface DatacenterRackMaintenanceStatusView {
	placementId: RackPlacementId;
	ageMonths: number;
	status: RackHealthStatus;
	repairProgressDays: number;
	repairCompletionPercent: number;
	repairEtaSubticks: number;
	repairEtaDays: number;
	/** @deprecated Prefer `repairEtaDays`. Kept for compatibility while web/cli migrate copy. */
	repairEtaTicks: number;
	failureProbability: number;
}

export interface DatacenterFabricStatusView {
	dcId: DatacenterId;
	regionId: RegionId;
	joinCost: Money;
	fabricActive: boolean;
	fabricConnected: boolean;
	memberDcIds: DatacenterId[];
	fabricEligible: boolean;
	fabricIneligibilityReason: string | null;
	linkMode: "bootstrap" | "join" | null;
	suggestedTargetDcId: DatacenterId | null;
	linkBlockedReason: string | null;
}

export interface RegionFabricView {
	regionId: RegionId;
	active: boolean;
	joinCost: Money;
	memberDcIds: DatacenterId[];
	eligibleDcIds: DatacenterId[];
	blockedDcIds: DatacenterId[];
	datacenters: DatacenterFabricStatusView[];
}

export function summarizeDatacenterCapacityFromState(
	state: Pick<GameState, "datacenters" | "contracts" | "contractMarket" | "activeContracts">,
	dcId: DatacenterId,
): DatacenterCapacityFromStateSummary {
	const summary = summarizeAllDatacenterCapacitiesFromState(state).find((candidate) => candidate.dcId === dcId);
	if (!summary) {
		throw new Error(`Unknown datacenter: ${dcId}`);
	}
	return summary;
}

function toUpgradeNodeView(node: DatacenterUpgradeTrackNode): DatacenterUpgradeNodeView {
	return {
		id: node.id,
		label: node.label,
		capexCost: node.capexCost,
		fixedMonthlyOpex: node.opex.fixedMonthly ?? 0,
		infrastructure: node.infrastructure,
	};
}

function summarizeUpgradeTrackViews(datacenter: Datacenter, dcId: DatacenterId): DatacenterUpgradeTrackView[] {
	return resolveDatacenterUpgradeState(datacenter).tracks.map((track) => {
		const trackDefinition = getDatacenterUpgradeTrackDefinition(datacenter.spec.id, track.trackId);
		return {
			dcId,
			trackId: track.trackId,
			label: track.label,
			presentation: track.presentation,
			currentNode: toUpgradeNodeView(track.currentNode),
			nextNode: track.nextNode
				? {
					...toUpgradeNodeView(track.nextNode),
					fixedMonthlyOpexDelta: (track.nextNode.opex.fixedMonthly ?? 0) - (track.currentNode.opex.fixedMonthly ?? 0),
				}
				: null,
			maxNode: toUpgradeNodeView(track.maxNode),
			currentNodeIndex: track.currentNodeIndex,
			totalNodes: trackDefinition.nodes.length,
			nodes: trackDefinition.nodes.map((node, index) => ({
				...toUpgradeNodeView(node),
				index,
				status:
					index < track.currentNodeIndex
						? "completed"
						: index === track.currentNodeIndex
							? "current"
							: index === track.currentNodeIndex + 1
								? "available"
								: "locked",
			})),
			maxed: track.maxed,
		};
	});
}

export function summarizeDatacenterRackMaintenanceViewsFromState(
	state: Pick<GameState, "datacenters" | "tick" | "difficulty">,
	dcId: DatacenterId,
): DatacenterRackMaintenanceStatusView[] {
	const datacenter = getDatacenterOrThrow(state.datacenters, dcId);
	const repairProgressDaysPerSubtick = repairProgressPerSubtick(datacenter.maintenanceStaff);

	return datacenter.placements.map((placement) => {
		const repairTargetDays = repairDurationDays(placement, state.difficulty);
		const repairProgressDays = placement.repairProgressDays ?? 0;
		const remainingRepairDays = Math.max(0, repairTargetDays - repairProgressDays);
		const riskView = rackFailureRiskView(state.tick, placement, state.difficulty);
		const repairEtaSubticks = placement.health === "repairing"
			? Math.ceil(remainingRepairDays / Math.max(repairProgressDaysPerSubtick, 1e-9))
			: 0;
		return {
			placementId: placement.id,
			ageMonths: riskView.ageMonths,
			status: placement.health,
			repairProgressDays,
			repairCompletionPercent: Math.round((Math.min(repairProgressDays, repairTargetDays) / repairTargetDays) * 100),
			repairEtaSubticks,
			repairEtaDays: repairEtaSubticks,
			repairEtaTicks: repairEtaSubticks,
			failureProbability: riskView.failureProbability,
		};
	});
}

export function summarizeDatacenterInfrastructureFromState(
	state: Pick<GameState, "datacenters">,
	dcId: DatacenterId,
): DatacenterInfrastructureView {
	const datacenter = getDatacenterOrThrow(state.datacenters, dcId);
	const upgradeState = resolveDatacenterUpgradeState(datacenter);
	return {
		dcId,
		base: datacenterBaseInfrastructure(datacenter.spec),
		effective: resolveDatacenterInfrastructure(datacenter),
		fabricEligible: upgradeState.fabricEligible,
	};
}

export function summarizeAllDatacenterInfrastructureFromState(
	state: Pick<GameState, "datacenters">,
): DatacenterInfrastructureView[] {
	return state.datacenters.map((datacenter) => summarizeDatacenterInfrastructureFromState(state, datacenter.id));
}

export function summarizeDatacenterUpgradeTracksFromState(
	state: Pick<GameState, "datacenters">,
	dcId: DatacenterId,
): DatacenterUpgradeTrackView[] {
	const datacenter = getDatacenterOrThrow(state.datacenters, dcId);
	return summarizeUpgradeTrackViews(datacenter, dcId);
}

export function summarizeDatacenterUpgradeViewFromState(
	state: Pick<GameState, "datacenters">,
	dcId: DatacenterId,
): DatacenterUpgradeView {
	const datacenter = getDatacenterOrThrow(state.datacenters, dcId);
	const upgradeState = resolveDatacenterUpgradeState(datacenter);
	return {
		dcId,
		infrastructure: summarizeDatacenterInfrastructureFromState(state, dcId),
		tracks: summarizeUpgradeTrackViews(datacenter, dcId),
		fixedMonthlyUpgradeOpex: resolveDatacenterUpgradeEconomics(datacenter).fixedMonthly,
		fabricEligible: upgradeState.fabricEligible,
	};
}

export function summarizeAllDatacenterUpgradeViewsFromState(
	state: Pick<GameState, "datacenters">,
): DatacenterUpgradeView[] {
	return state.datacenters.map((datacenter) => summarizeDatacenterUpgradeViewFromState(state, datacenter.id));
}

export function summarizeAllDatacenterCapacitiesFromState(
	state: Pick<GameState, "datacenters" | "contracts" | "contractMarket" | "activeContracts">,
): DatacenterCapacityFromStateSummary[] {
	return summarizeAllDatacenterOperationalCapacities(
		state.datacenters,
		selectLiveContracts(contractsFromState(state)),
	).map(({ dcId, installed, usable, committed, available }) => ({
		dcId,
		installed,
		usable,
		committed,
		available,
	}));
}

export function summarizeNetworkCapacityFromState(
	state: Pick<GameState, "datacenters" | "contracts" | "contractMarket" | "activeContracts">,
): NetworkCapacitySummary {
	const perDc = summarizeAllDatacenterCapacitiesFromState(state);
	const installed = { ...EMPTY_CAPACITY };
	const usable = { ...EMPTY_CAPACITY };
	const committed = { ...EMPTY_CAPACITY };
	const available = { ...EMPTY_CAPACITY };
	for (const summary of perDc) {
		accumulateCapacity(installed, summary.installed);
		accumulateCapacity(usable, summary.usable);
		accumulateCapacity(committed, summary.committed);
		accumulateCapacity(available, summary.available);
	}
	return {
		installed,
		usable,
		committed,
		available,
		perDc,
	};
}

export function summarizeDatacenterFabricCapacityFromState(
	state: Pick<GameState, "datacenters" | "map" | "contracts" | "contractMarket" | "activeContracts">,
	dcId: DatacenterId,
): FabricCapacitySummary {
	return summarizeFabricCapacityForDatacenter(state, dcId);
}

export function summarizeDistinctCapacityPoolsFromState(
	state: Pick<GameState, "datacenters" | "map" | "contracts" | "contractMarket" | "activeContracts">,
): CapacityPoolSummary[] {
	return summarizeDistinctCapacityPools(state);
}

export function summarizeDatacenterFabricStatusFromState(
	state: Pick<GameState, "datacenters" | "map">,
	dcId: DatacenterId,
): DatacenterFabricStatusView {
	const datacenter = getDatacenterOrThrow(state.datacenters, dcId);
	const region = getRegionOrThrow(state, datacenter.regionId);
	const regionDatacenters = listRegionDatacenters(state, region.id);
	const memberDcIds = getRegionFabricMemberIds(region);
	const fabricActive = memberDcIds.length > 0;
	const fabricConnected = isDatacenterInRegionFabric(region, dcId);
	const fabricEligible = isDatacenterFiberEligible(datacenter);
	const joinCost = REGIONAL_FABRIC_JOIN_COST;
	const fiberReadyDcIds = regionDatacenters
		.filter((candidate) => isDatacenterFiberEligible(candidate))
		.map((candidate) => candidate.id);

	if (fabricConnected) {
		return {
			dcId,
			regionId: region.id,
			joinCost,
			fabricActive,
			fabricConnected,
			memberDcIds,
			fabricEligible,
			fabricIneligibilityReason: null,
			linkMode: null,
			suggestedTargetDcId: null,
			linkBlockedReason: "Already connected to the regional fabric.",
		};
	}

	if (!fabricEligible) {
		return {
			dcId,
			regionId: region.id,
			joinCost,
			fabricActive,
			fabricConnected,
			memberDcIds,
			fabricEligible,
			fabricIneligibilityReason: "Upgrade network to fiber to join the regional fabric.",
			linkMode: null,
			suggestedTargetDcId: null,
			linkBlockedReason: "Upgrade network to fiber to join the regional fabric.",
		};
	}

	if (fabricActive) {
		return {
			dcId,
			regionId: region.id,
			joinCost,
			fabricActive,
			fabricConnected,
			memberDcIds,
			fabricEligible,
			fabricIneligibilityReason: null,
			linkMode: "join",
			suggestedTargetDcId: memberDcIds[0] ?? null,
			linkBlockedReason: memberDcIds.length > 0 ? null : "No connected datacenter is available as a fabric anchor.",
		};
	}

	const bootstrapPeerDcId = fiberReadyDcIds.find((candidateId) => candidateId !== dcId) ?? null;
	return {
		dcId,
		regionId: region.id,
		joinCost,
		fabricActive,
		fabricConnected,
		memberDcIds,
		fabricEligible,
		fabricIneligibilityReason: null,
		linkMode: bootstrapPeerDcId ? "bootstrap" : null,
		suggestedTargetDcId: bootstrapPeerDcId,
		linkBlockedReason: bootstrapPeerDcId ? null : "Need two fiber-ready datacenters to create a regional fabric.",
	};
}

export function summarizeRegionFabricViewFromState(
	state: Pick<GameState, "datacenters" | "map">,
	regionId: RegionId,
): RegionFabricView {
	const region = getRegionOrThrow(state, regionId);
	const memberDcIds = getRegionFabricMemberIds(region);
	const datacenters = listRegionDatacenters(state, regionId).map((datacenter) =>
		summarizeDatacenterFabricStatusFromState(state, datacenter.id)
	);
	return {
		regionId,
		active: memberDcIds.length > 0,
		joinCost: REGIONAL_FABRIC_JOIN_COST,
		memberDcIds,
		eligibleDcIds: datacenters.filter((entry) => entry.fabricEligible).map((entry) => entry.dcId),
		blockedDcIds: datacenters.filter((entry) => !entry.fabricEligible).map((entry) => entry.dcId),
		datacenters,
	};
}

export function summarizeAllRegionFabricViewsFromState(
	state: Pick<GameState, "datacenters" | "map">,
): RegionFabricView[] {
	return state.map.regions.map((region) => summarizeRegionFabricViewFromState(state, region.id));
}

export function selectAssignedDemandForDatacenterFromState(
	state: Pick<GameState, "datacenters" | "contracts" | "contractMarket" | "activeContracts">,
	dcId: DatacenterId,
): Capacity {
	const datacenter = getDatacenterOrThrow(state.datacenters, dcId);
	const liveContracts = selectLiveContracts(contractsFromState(state));
	return datacenterCommittedContractDemand(datacenter, liveContracts);
}

export function selectDatacenterRackActivityViewFromState(
	state: Pick<GameState, "datacenters" | "contracts" | "contractMarket" | "activeContracts">,
	dcId: DatacenterId,
): RackActivityView[] {
	const datacenter = getDatacenterOrThrow(state.datacenters, dcId);
	return datacenterRackActivityView(datacenter, selectAssignedDemandForDatacenterFromState(state, dcId));
}

export function selectDatacenterRackPowerSummaryFromState(
	state: Pick<GameState, "datacenters" | "contracts" | "contractMarket" | "activeContracts">,
	dcId: DatacenterId,
): RackPowerSummary {
	const datacenter = getDatacenterOrThrow(state.datacenters, dcId);
	return datacenterRackPowerSummary(datacenter, selectAssignedDemandForDatacenterFromState(state, dcId));
}

export function selectDatacenterMaintenanceStaffingViewFromState(
	state: Pick<GameState, "datacenters" | "map" | "tick">,
	dcId: DatacenterId,
): DatacenterMaintenanceStaffingView {
	const datacenter = getDatacenterOrThrow(state.datacenters, dcId);
	const region = state.map.regions.find((candidate) => candidate.id === datacenter.regionId);
	if (!region) {
		throw new Error(`Unknown region ${datacenter.regionId} for datacenter ${datacenter.id}`);
	}

	return datacenterMaintenanceStaffingView(datacenter, region, state.datacenters, state.tick);
}

export function selectDatacenterMaintenanceStaffingViewsFromState(
	state: Pick<GameState, "datacenters" | "map" | "tick">,
): DatacenterMaintenanceStaffingView[] {
	return state.datacenters.map((datacenter) =>
		selectDatacenterMaintenanceStaffingViewFromState(state, datacenter.id)
	);
}
