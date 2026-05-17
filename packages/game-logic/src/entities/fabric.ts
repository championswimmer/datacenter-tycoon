import { REGIONAL_FABRIC_JOIN_COST } from "../balance/fabric.js";
import { contractsFromState, selectLiveContracts } from "../contracts/lifecycle.js";
import { datacenterContractCapacitySummary, resolveDatacenterUpgradeState, type DatacenterContractCapacitySummary } from "./datacenter.js";
import type {
	Capacity,
	Datacenter,
	DatacenterId,
	GameState,
	Money,
	Region,
	RegionFabric,
	RegionId,
} from "../types.js";

const EMPTY_MEMBER_IDS: RegionFabric["memberDcIds"] = [];

const EMPTY_CAPACITY: Capacity = {
	vCpu: 0,
	ramGb: 0,
	storageTb: 0,
	gpuFlops: 0,
};

function addCapacity(total: Capacity, delta: Capacity): Capacity {
	return {
		vCpu: total.vCpu + delta.vCpu,
		ramGb: total.ramGb + delta.ramGb,
		storageTb: total.storageTb + delta.storageTb,
		gpuFlops: total.gpuFlops + delta.gpuFlops,
	};
}

function subtractCapacity(total: Capacity, reserved: Capacity): Capacity {
	return {
		vCpu: Math.max(0, total.vCpu - reserved.vCpu),
		ramGb: Math.max(0, total.ramGb - reserved.ramGb),
		storageTb: Math.max(0, total.storageTb - reserved.storageTb),
		gpuFlops: Math.max(0, total.gpuFlops - reserved.gpuFlops),
	};
}

function aggregateCapacitySummaries(
	summaries: readonly DatacenterContractCapacitySummary[],
): DatacenterContractCapacitySummary {
	const installed = summaries.reduce((total, summary) => addCapacity(total, summary.installed), EMPTY_CAPACITY);
	const usable = summaries.reduce((total, summary) => addCapacity(total, summary.usable), EMPTY_CAPACITY);
	const committed = summaries.reduce((total, summary) => addCapacity(total, summary.committed), EMPTY_CAPACITY);
	const available = subtractCapacity(usable, committed);

	return {
		installed,
		usable,
		committed,
		available,
	};
}

function getDatacenterOrThrow(datacenters: readonly Datacenter[], dcId: DatacenterId): Datacenter {
	const datacenter = datacenters.find((candidate) => candidate.id === dcId);
	if (!datacenter) {
		throw new Error(`Unknown datacenter: ${dcId}`);
	}

	return datacenter;
}

function getRegionOrThrow(regions: readonly Region[], regionId: RegionId): Region {
	const region = regions.find((candidate) => candidate.id === regionId);
	if (!region) {
		throw new Error(`Unknown region: ${regionId}`);
	}

	return region;
}

export function createEmptyRegionFabric(): RegionFabric {
	return {
		memberDcIds: [...EMPTY_MEMBER_IDS],
	};
}

export function ensureRegionFabric(fabric?: RegionFabric): RegionFabric {
	return fabric ?? createEmptyRegionFabric();
}

export function hasRegionFabric(fabric?: RegionFabric): boolean {
	return ensureRegionFabric(fabric).memberDcIds.length > 0;
}

export function getRegionFabricMemberIds(region: Pick<Region, "fabric">): DatacenterId[] {
	return [...ensureRegionFabric(region.fabric).memberDcIds];
}

export function isDatacenterInRegionFabric(region: Pick<Region, "fabric">, dcId: DatacenterId): boolean {
	return getRegionFabricMemberIds(region).includes(dcId);
}

export function isDatacenterFiberEligible(datacenter: Pick<Datacenter, "spec" | "upgrades">): boolean {
	return resolveDatacenterUpgradeState(datacenter).fabricEligible;
}

export function listRegionDatacenters(
	state: Pick<GameState, "datacenters">,
	regionId: RegionId,
): Datacenter[] {
	return state.datacenters.filter((datacenter) => datacenter.regionId === regionId);
}

export function listRegionFabricMembers(
	state: Pick<GameState, "datacenters" | "map">,
	regionId: RegionId,
): Datacenter[] {
	const region = getRegionOrThrow(state.map.regions, regionId);
	return getRegionFabricMemberIds(region).map((dcId) => getDatacenterOrThrow(state.datacenters, dcId));
}

export function resolveDatacenterCapacityPoolMemberIds(
	state: Pick<GameState, "datacenters" | "map">,
	dcId: DatacenterId,
): DatacenterId[] {
	const datacenter = getDatacenterOrThrow(state.datacenters, dcId);
	const region = getRegionOrThrow(state.map.regions, datacenter.regionId);
	return isDatacenterInRegionFabric(region, dcId) ? getRegionFabricMemberIds(region) : [dcId];
}

export interface FabricCapacitySummary extends DatacenterContractCapacitySummary {
	dcId: DatacenterId;
	connected: boolean;
	memberDcIds: DatacenterId[];
	local: DatacenterContractCapacitySummary;
}

export function summarizeFabricCapacityForDatacenter(
	state: Pick<GameState, "datacenters" | "map" | "contracts" | "contractMarket" | "activeContracts">,
	dcId: DatacenterId,
): FabricCapacitySummary {
	const liveContracts = selectLiveContracts(contractsFromState(state));
	const datacenter = getDatacenterOrThrow(state.datacenters, dcId);
	const local = datacenterContractCapacitySummary(datacenter, liveContracts);
	const memberDcIds = resolveDatacenterCapacityPoolMemberIds(state, dcId);
	const connected = memberDcIds.length > 1;
	if (!connected) {
		return {
			dcId,
			connected,
			memberDcIds,
			local,
			...local,
		};
	}

	const pooled = aggregateCapacitySummaries(
		memberDcIds.map((memberDcId) => datacenterContractCapacitySummary(getDatacenterOrThrow(state.datacenters, memberDcId), liveContracts)),
	);

	return {
		dcId,
		connected,
		memberDcIds,
		local,
		...pooled,
	};
}

export interface CapacityPoolSummary extends DatacenterContractCapacitySummary {
	anchorDcId: DatacenterId;
	memberDcIds: DatacenterId[];
	connected: boolean;
}

export function summarizeDistinctCapacityPools(
	state: Pick<GameState, "datacenters" | "map" | "contracts" | "contractMarket" | "activeContracts">,
): CapacityPoolSummary[] {
	const seen = new Set<DatacenterId>();
	const pools: CapacityPoolSummary[] = [];

	for (const datacenter of state.datacenters) {
		if (seen.has(datacenter.id)) {
			continue;
		}

		const summary = summarizeFabricCapacityForDatacenter(state, datacenter.id);
		for (const memberDcId of summary.memberDcIds) {
			seen.add(memberDcId);
		}

		pools.push({
			anchorDcId: datacenter.id,
			memberDcIds: summary.memberDcIds,
			connected: summary.connected,
			installed: summary.installed,
			usable: summary.usable,
			committed: summary.committed,
			available: summary.available,
		});
	}

	return pools;
}

export type FabricLinkFailureCode =
	| "unknown_datacenter"
	| "invalid_join"
	| "duplicate_join"
	| "cross_region"
	| "non_fiber_datacenter";

export interface FabricLinkFailure {
	code: FabricLinkFailureCode;
	sourceDcId: DatacenterId;
	targetDcId: DatacenterId;
	dcId?: DatacenterId;
	regionId?: RegionId;
}

export class FabricLinkError extends Error {
	readonly data: FabricLinkFailure;

	constructor(message: string, data: FabricLinkFailure) {
		super(message);
		this.name = "FabricLinkError";
		this.data = data;
	}
}

function unknownDatacenterError(sourceDcId: DatacenterId, targetDcId: DatacenterId, dcId: DatacenterId): FabricLinkError {
	return new FabricLinkError(`Unknown datacenter: ${dcId}`, {
		code: "unknown_datacenter",
		sourceDcId,
		targetDcId,
		dcId,
	});
}

export interface ValidatedFabricLink {
	regionId: RegionId;
	sourceDc: Datacenter;
	targetDc: Datacenter;
	updatedMemberDcIds: DatacenterId[];
	capexCost: Money;
	mode: "bootstrap" | "join";
}

export function validateFabricLinkRequest(
	state: Pick<GameState, "datacenters" | "map">,
	sourceDcId: DatacenterId,
	targetDcId: DatacenterId,
): ValidatedFabricLink {
	const sourceDc = state.datacenters.find((candidate) => candidate.id === sourceDcId);
	if (!sourceDc) {
		throw unknownDatacenterError(sourceDcId, targetDcId, sourceDcId);
	}

	const targetDc = state.datacenters.find((candidate) => candidate.id === targetDcId);
	if (!targetDc) {
		throw unknownDatacenterError(sourceDcId, targetDcId, targetDcId);
	}

	if (sourceDc.id === targetDc.id) {
		throw new FabricLinkError("Cannot join a datacenter to itself", {
			code: "invalid_join",
			sourceDcId,
			targetDcId,
			dcId: sourceDc.id,
		});
	}

	if (sourceDc.regionId !== targetDc.regionId) {
		throw new FabricLinkError(
			`Datacenters ${sourceDc.id} and ${targetDc.id} must be in the same region to share fabric`,
			{
				code: "cross_region",
				sourceDcId,
				targetDcId,
				regionId: sourceDc.regionId,
			},
		);
	}

	if (!isDatacenterFiberEligible(sourceDc)) {
		throw new FabricLinkError(`Datacenter ${sourceDc.id} must be on fiber before joining the regional fabric`, {
			code: "non_fiber_datacenter",
			sourceDcId,
			targetDcId,
			dcId: sourceDc.id,
			regionId: sourceDc.regionId,
		});
	}

	if (!isDatacenterFiberEligible(targetDc)) {
		throw new FabricLinkError(`Datacenter ${targetDc.id} must be on fiber before joining the regional fabric`, {
			code: "non_fiber_datacenter",
			sourceDcId,
			targetDcId,
			dcId: targetDc.id,
			regionId: sourceDc.regionId,
		});
	}

	const region = getRegionOrThrow(state.map.regions, sourceDc.regionId);
	const memberDcIds = getRegionFabricMemberIds(region);
	const sourceMember = memberDcIds.includes(sourceDc.id);
	const targetMember = memberDcIds.includes(targetDc.id);

	if (sourceMember && targetMember) {
		throw new FabricLinkError(`Datacenters ${sourceDc.id} and ${targetDc.id} are already linked to the regional fabric`, {
			code: "duplicate_join",
			sourceDcId,
			targetDcId,
			regionId: region.id,
		});
	}

	if (memberDcIds.length === 0) {
		return {
			regionId: region.id,
			sourceDc,
			targetDc,
			updatedMemberDcIds: [sourceDc.id, targetDc.id],
			capexCost: REGIONAL_FABRIC_JOIN_COST,
			mode: "bootstrap",
		};
	}

	if (!sourceMember && !targetMember) {
		throw new FabricLinkError(
			`Region ${region.id} already has a fabric; new joins must connect through an existing member`,
			{
				code: "invalid_join",
				sourceDcId,
				targetDcId,
				regionId: region.id,
			},
		);
	}

	return {
		regionId: region.id,
		sourceDc,
		targetDc,
		updatedMemberDcIds: sourceMember ? [...memberDcIds, targetDc.id] : [...memberDcIds, sourceDc.id],
		capexCost: REGIONAL_FABRIC_JOIN_COST,
		mode: "join",
	};
}

export function applyValidatedFabricLink(region: Region, validated: ValidatedFabricLink): Region {
	if (region.id !== validated.regionId) {
		throw new Error(`Fabric link targets region ${validated.regionId}, received ${region.id}`);
	}

	return {
		...region,
		fabric: {
			memberDcIds: validated.updatedMemberDcIds,
		},
	};
}
