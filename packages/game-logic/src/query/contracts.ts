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
	DatacenterId,
	GameState,
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

export interface ContractAssignmentFitCandidate {
	dcId: DatacenterId;
	available: Capacity;
	fits: boolean;
	fabricConnected: boolean;
	memberDcIds: DatacenterId[];
}

export type ContractAssignmentFitStatus = "fits" | "partial" | "none";

export interface ContractAssignmentFitSummary {
	contractId: ContractId;
	requirements: Contract["requirements"];
	fitStatus: ContractAssignmentFitStatus;
	networkAvailable: Capacity;
	candidates: ContractAssignmentFitCandidate[];
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
	contract: Pick<Contract, "id" | "requirements">,
): ContractAssignmentFitSummary {
	const candidates = state.datacenters.map((datacenter) => {
		const summary = summarizeFabricCapacityForDatacenter(state, datacenter.id);
		return {
			dcId: datacenter.id,
			available: summary.available,
			fits: canCoverRequirements(summary.available, contract.requirements),
			fabricConnected: summary.connected,
			memberDcIds: summary.memberDcIds,
		};
	});
	const networkAvailable = summarizeDistinctCapacityPools(state).reduce<Capacity>(
		(total, pool) => addCapacity(total, pool.available),
		EMPTY_CAPACITY,
	);
	const fittingDcIds = candidates.filter((candidate) => candidate.fits).map((candidate) => candidate.dcId);
	const fitStatus: ContractAssignmentFitStatus = fittingDcIds.length > 0
		? "fits"
		: canCoverRequirements(networkAvailable, contract.requirements)
			? "partial"
			: "none";

	return {
		contractId: contract.id,
		requirements: contract.requirements,
		fitStatus,
		networkAvailable,
		candidates,
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
