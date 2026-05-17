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
import { summarizeDistinctCapacityPools, summarizeFabricCapacityForDatacenter } from "../entities/fabric.js";
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

function canCoverRequirements(capacity: Capacity, requirements: Capacity): boolean {
	return (
		capacity.vCpu >= requirements.vCpu &&
		capacity.ramGb >= requirements.ramGb &&
		capacity.storageTb >= requirements.storageTb &&
		capacity.gpuFlops >= requirements.gpuFlops
	);
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
	state: Pick<GameState, "contracts" | "contractMarket" | "activeContracts">,
	contractId: ContractId,
): Contract | undefined {
	return contractsFromState(state).find((contract) => contract.id === contractId);
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

export function summarizeContractAssignmentFitForContract(
	state: Pick<GameState, "contracts" | "contractMarket" | "activeContracts" | "datacenters" | "map">,
	contract: Pick<Contract, "id" | "requirements" | "regionAffinity">,
): ContractAssignmentFitSummary {
	const datacenterById = new Map(state.datacenters.map((datacenter) => [datacenter.id, datacenter]));
	const regionAffinity = summarizeContractRegionAffinity(contract, state.map.regions);
	const candidates = state.datacenters.map((datacenter) => {
		const summary = summarizeFabricCapacityForDatacenter(state, datacenter.id);
		const fitsCapacity = canCoverRequirements(summary.available, contract.requirements);
		const regionEligible = contractAllowsDatacenter(contract, datacenter);
		return {
			dcId: datacenter.id,
			regionId: datacenter.regionId,
			available: summary.available,
			fitsCapacity,
			regionEligible,
			fits: regionEligible && fitsCapacity,
			fabricConnected: summary.connected,
			memberDcIds: summary.memberDcIds,
		};
	});
	const networkAvailable = summarizeDistinctCapacityPools(state)
		.filter((pool) =>
			contract.regionAffinity
				? pool.memberDcIds.some((memberDcId) => {
					const memberDc = datacenterById.get(memberDcId);
					return memberDc ? contractAllowsDatacenter(contract, memberDc) : false;
				})
				: true,
		)
		.reduce<Capacity>((total, pool) => addCapacity(total, pool.available), EMPTY_CAPACITY);
	const eligibleDcIds = candidates.filter((candidate) => candidate.regionEligible).map((candidate) => candidate.dcId);
	const fittingDcIds = candidates.filter((candidate) => candidate.fits).map((candidate) => candidate.dcId);
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
		candidates,
		eligibleDcIds,
		fittingDcIds,
	};
}

export function summarizeContractAssignmentFit(
	state: Pick<GameState, "contracts" | "contractMarket" | "activeContracts" | "datacenters" | "map">,
	contractId: ContractId,
): ContractAssignmentFitSummary | undefined {
	const contract = selectContractByIdFromState(state, contractId);
	if (!contract) {
		return undefined;
	}

	return summarizeContractAssignmentFitForContract(state, contract);
}

export function summarizeOpenMarketContractFits(
	state: Pick<GameState, "contracts" | "contractMarket" | "activeContracts" | "datacenters" | "map">,
): ContractAssignmentFitSummary[] {
	return selectOpenMarketContractsFromState(state).map((contract) => summarizeContractAssignmentFitForContract(state, contract));
}
