import { PRICING_WEIGHTS } from "../contracts/generator.js";
import {
	contractsFromState,
	isHistoricalContract,
	isLiveContract,
	isMarketOpenContract,
	selectHistoricalContracts,
	selectLiveContracts,
	selectOpenMarketContracts,
} from "../contracts/lifecycle.js";
import { summarizeAllDatacenterFabricCapacities } from "../entities/fabric.js";
import { createIndexedGameStateView } from "../state/indexed-view.js";
import type {
	Capacity,
	Contract,
	ContractId,
	ContractRegionAffinityKey,
	Datacenter,
	DatacenterId,
	GameState,
	Region,
	RegionId,
} from "../types.js";

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

function cloneCapacity(capacity: Capacity): Capacity {
	return {
		vCpu: capacity.vCpu,
		ramGb: capacity.ramGb,
		storageTb: capacity.storageTb,
		gpuFlops: capacity.gpuFlops,
	};
}

function canCoverRequirements(capacity: Capacity, requirements: Capacity): boolean {
	return (
		capacity.vCpu >= requirements.vCpu &&
		capacity.ramGb >= requirements.ramGb &&
		capacity.storageTb >= requirements.storageTb &&
		capacity.gpuFlops >= requirements.gpuFlops
	);
}

function maxCapacity(a: Capacity, b: Capacity): Capacity {
	return {
		vCpu: Math.max(a.vCpu, b.vCpu),
		ramGb: Math.max(a.ramGb, b.ramGb),
		storageTb: Math.max(a.storageTb, b.storageTb),
		gpuFlops: Math.max(a.gpuFlops, b.gpuFlops),
	};
}

export interface ContractBuckets<TContract extends Pick<Contract, "assignedDcId" | "lifecycleState"> = Contract> {
	market: TContract[];
	live: TContract[];
	historical: TContract[];
}

export interface ContractRegionAffinitySummary {
	restricted: boolean;
	key: ContractRegionAffinityKey | null;
	allowedRegionIds: RegionId[];
}

export interface ContractAssignmentFitCandidate {
	dcId: DatacenterId;
	regionId: RegionId;
	available: Capacity;
	fitsCapacity: boolean;
	regionEligible: boolean;
	fits: boolean;
	fabricConnected: boolean;
	memberDcIds: DatacenterId[];
}

export type ContractAssignmentFitStatus = "fits" | "partial" | "none";

export interface ContractAssignmentFitSummary {
	contractId: ContractId;
	requirements: Contract["requirements"];
	regionAffinity: ContractRegionAffinitySummary;
	fitStatus: ContractAssignmentFitStatus;
	networkAvailable: Capacity;
	bestPoolAvailable: Capacity;
	candidates: ContractAssignmentFitCandidate[];
	eligibleDcIds: DatacenterId[];
	fittingDcIds: DatacenterId[];
}

export function contractWeightedRequirementValue(contract: Pick<Contract, "requirements">): number {
	const { requirements } = contract;
	return (
		requirements.vCpu * PRICING_WEIGHTS.vCpu +
		requirements.ramGb * PRICING_WEIGHTS.ramGb +
		requirements.storageTb * PRICING_WEIGHTS.storageTb +
		requirements.gpuFlops * PRICING_WEIGHTS.gpuFlops
	);
}

export function contractDealScore(contract: Pick<Contract, "requirements" | "monthlyPayment">): number {
	const weightedRequirementValue = contractWeightedRequirementValue(contract);
	if (weightedRequirementValue === 0) {
		return 0;
	}

	return contract.monthlyPayment / weightedRequirementValue;
}

export function summarizeContractRegionAffinity(
	contract: Pick<Contract, "regionAffinity">,
	regions: readonly Pick<Region, "id">[] = [],
): ContractRegionAffinitySummary {
	if (!contract.regionAffinity) {
		return {
			restricted: false,
			key: null,
			allowedRegionIds: regions.map((region) => region.id),
		};
	}

	return {
		restricted: true,
		key: contract.regionAffinity.key,
		allowedRegionIds: [...contract.regionAffinity.allowedRegionIds],
	};
}

export function contractAllowsRegion(
	contract: Pick<Contract, "regionAffinity">,
	regionId: RegionId,
): boolean {
	return contract.regionAffinity ? contract.regionAffinity.allowedRegionIds.includes(regionId) : true;
}

export function contractAllowsDatacenter(
	contract: Pick<Contract, "regionAffinity">,
	datacenter: Pick<Datacenter, "regionId">,
): boolean {
	return contractAllowsRegion(contract, datacenter.regionId);
}

export function bucketContracts<TContract extends Pick<Contract, "assignedDcId" | "lifecycleState">>(
	contracts: readonly TContract[],
): ContractBuckets<TContract> {
	return {
		market: contracts.filter(isMarketOpenContract),
		live: contracts.filter(isLiveContract),
		historical: contracts.filter(isHistoricalContract),
	};
}

export function bucketContractsFromState(
	state: Pick<GameState, "contracts" | "contractMarket" | "activeContracts">,
): ContractBuckets {
	return bucketContracts(contractsFromState(state));
}

export function selectOpenMarketContractsFromState(
	state: Pick<GameState, "contracts" | "contractMarket" | "activeContracts">,
): Contract[] {
	return selectOpenMarketContracts(contractsFromState(state));
}

export function selectLiveContractsFromState(
	state: Pick<GameState, "contracts" | "contractMarket" | "activeContracts">,
): Contract[] {
	return selectLiveContracts(contractsFromState(state));
}

export function selectHistoricalContractsFromState(
	state: Pick<GameState, "contracts" | "contractMarket" | "activeContracts">,
): Contract[] {
	return selectHistoricalContracts(contractsFromState(state));
}

export function selectContractByIdFromState(
	state: Pick<GameState, "contracts" | "contractMarket" | "activeContracts" | "datacenters" | "map">,
	contractId: ContractId,
): Contract | undefined {
	return createIndexedGameStateView(state).contractById.get(contractId);
}

export function selectLiveContractsForDatacenter(
	state: Pick<GameState, "contracts" | "contractMarket" | "activeContracts">,
	dcId: DatacenterId,
): Contract[] {
	return selectLiveContractsFromState(state).filter((contract) => contract.assignedDcId === dcId);
}

export function selectHistoricalContractsForDatacenter(
	state: Pick<GameState, "contracts" | "contractMarket" | "activeContracts">,
	dcId: DatacenterId,
): Contract[] {
	return selectHistoricalContractsFromState(state).filter((contract) => contract.assignedDcId === dcId);
}

interface ContractFitCandidateTemplate {
	dcId: DatacenterId;
	regionId: RegionId;
	available: Capacity;
	fabricConnected: boolean;
	memberDcIds: DatacenterId[];
}

interface ContractFitPoolSummary {
	memberDcIds: DatacenterId[];
	available: Capacity;
	regionIds: Set<RegionId>;
}

interface ContractFitQueryContext {
	contracts: readonly Contract[];
	contractById: ReadonlyMap<ContractId, Contract>;
	openMarketContracts: readonly Contract[];
	candidateTemplates: readonly ContractFitCandidateTemplate[];
	poolSummaries: readonly ContractFitPoolSummary[];
	unrestrictedNetworkAvailable: Capacity;
	regions: readonly Pick<Region, "id">[];
}

function fitPoolKey(memberDcIds: readonly DatacenterId[]): string {
	return memberDcIds.join("\u0000");
}

function buildContractFitQueryContext(
	state: Pick<GameState, "contracts" | "contractMarket" | "activeContracts" | "datacenters" | "map">,
): ContractFitQueryContext {
	const indexedState = createIndexedGameStateView(state);
	const allFabricSummaries = summarizeAllDatacenterFabricCapacities(state, indexedState.liveContracts);
	const candidateTemplates: ContractFitCandidateTemplate[] = allFabricSummaries.map((summary) => {
		const datacenter = indexedState.datacenterById.get(summary.dcId);
		if (!datacenter) {
			throw new Error(`Unknown datacenter: ${summary.dcId}`);
		}
		return {
			dcId: summary.dcId,
			regionId: datacenter.regionId,
			available: cloneCapacity(summary.available),
			fabricConnected: summary.connected,
			memberDcIds: [...summary.memberDcIds],
		};
	});
	const poolSummariesByKey = new Map<string, ContractFitPoolSummary>();
	let unrestrictedNetworkAvailable = { ...EMPTY_CAPACITY };
	for (const summary of allFabricSummaries) {
		const key = fitPoolKey(summary.memberDcIds);
		if (poolSummariesByKey.has(key)) {
			continue;
		}
		const regionIds = new Set<RegionId>();
		for (const memberDcId of summary.memberDcIds) {
			const memberDc = indexedState.datacenterById.get(memberDcId);
			if (!memberDc) {
				throw new Error(`Unknown datacenter in pool: ${memberDcId}`);
			}
			regionIds.add(memberDc.regionId);
		}
		const poolSummary = {
			memberDcIds: [...summary.memberDcIds],
			available: cloneCapacity(summary.available),
			regionIds,
		};
		poolSummariesByKey.set(key, poolSummary);
		unrestrictedNetworkAvailable = addCapacity(unrestrictedNetworkAvailable, summary.available);
	}

	return {
		contracts: indexedState.contracts,
		contractById: indexedState.contractById,
		openMarketContracts: indexedState.openMarketContracts,
		candidateTemplates,
		poolSummaries: [...poolSummariesByKey.values()],
		unrestrictedNetworkAvailable,
		regions: state.map.regions,
	};
}

function summarizeContractAssignmentFitForContractWithContext(
	context: ContractFitQueryContext,
	contract: Pick<Contract, "id" | "requirements" | "regionAffinity">,
): ContractAssignmentFitSummary {
	const regionAffinity = summarizeContractRegionAffinity(contract, context.regions);
	const allowedRegionIds = new Set(regionAffinity.allowedRegionIds);
	const candidates: ContractAssignmentFitCandidate[] = [];
	const eligibleDcIds: DatacenterId[] = [];
	const fittingDcIds: DatacenterId[] = [];
	let bestPoolAvailable = { ...EMPTY_CAPACITY };

	for (const template of context.candidateTemplates) {
		const fitsCapacity = canCoverRequirements(template.available, contract.requirements);
		const regionEligible = !regionAffinity.restricted || allowedRegionIds.has(template.regionId);
		const candidate = {
			dcId: template.dcId,
			regionId: template.regionId,
			available: cloneCapacity(template.available),
			fitsCapacity,
			regionEligible,
			fits: regionEligible && fitsCapacity,
			fabricConnected: template.fabricConnected,
			memberDcIds: [...template.memberDcIds],
		};
		candidates.push(candidate);
		if (regionEligible) {
			eligibleDcIds.push(candidate.dcId);
			bestPoolAvailable = maxCapacity(bestPoolAvailable, candidate.available);
		}
		if (candidate.fits) {
			fittingDcIds.push(candidate.dcId);
		}
	}

	let networkAvailable = regionAffinity.restricted ? { ...EMPTY_CAPACITY } : cloneCapacity(context.unrestrictedNetworkAvailable);
	if (regionAffinity.restricted) {
		for (const poolSummary of context.poolSummaries) {
			let eligible = false;
			for (const regionId of poolSummary.regionIds) {
				if (allowedRegionIds.has(regionId)) {
					eligible = true;
					break;
				}
			}
			if (eligible) {
				networkAvailable = addCapacity(networkAvailable, poolSummary.available);
			}
		}
	}

	const fitStatus: ContractAssignmentFitStatus = fittingDcIds.length > 0
		? "fits"
		: canCoverRequirements(networkAvailable, contract.requirements)
			? "partial"
			: "none";

	return {
		contractId: contract.id,
		requirements: contract.requirements,
		regionAffinity,
		fitStatus,
		networkAvailable,
		bestPoolAvailable,
		candidates,
		eligibleDcIds,
		fittingDcIds,
	};
}

export function summarizeContractAssignmentFitForContract(
	state: Pick<GameState, "contracts" | "contractMarket" | "activeContracts" | "datacenters" | "map">,
	contract: Pick<Contract, "id" | "requirements" | "regionAffinity">,
): ContractAssignmentFitSummary {
	return summarizeContractAssignmentFitForContractWithContext(buildContractFitQueryContext(state), contract);
}

export function summarizeContractAssignmentFit(
	state: Pick<GameState, "contracts" | "contractMarket" | "activeContracts" | "datacenters" | "map">,
	contractId: ContractId,
): ContractAssignmentFitSummary | undefined {
	const context = buildContractFitQueryContext(state);
	const contract = context.contractById.get(contractId);
	if (!contract) {
		return undefined;
	}

	return summarizeContractAssignmentFitForContractWithContext(context, contract);
}

export function summarizeOpenMarketContractFits(
	state: Pick<GameState, "contracts" | "contractMarket" | "activeContracts" | "datacenters" | "map">,
): ContractAssignmentFitSummary[] {
	const context = buildContractFitQueryContext(state);
	return context.openMarketContracts.map((contract) => summarizeContractAssignmentFitForContractWithContext(context, contract));
}
