import {
	isHistoricalContract,
	isLiveContract,
	selectContractByIdFromState,
	selectHistoricalContractsFromState,
	selectLiveContractsFromState,
	selectOpenMarketContractsFromState,
} from "@datacenter-tycoon/game-logic";
import type { Contract, GameState } from "@datacenter-tycoon/game-logic";

import type { ContractRegionAffinityView } from "../protocol/messages.js";
import { formatRegionLabel } from "./region-labels.js";

/**
 * `market`  — contract on the market, not yet accepted.
 * `active`  — accepted and currently live. Still commits capacity.
 * `history` — accepted but no longer live. Capacity already released.
 */
export type ContractListBucket = "market" | "active" | "history";

export interface CliContractView {
	id: string;
	name: string;
	status: Contract["status"];
	urgency: Contract["urgency"];
	tier: number;
	requirements: Contract["requirements"];
	monthlyPayment: number;
	penaltyPerMonth: number;
	termMonths: number;
	offeredAtTick: number;
	expiresAtTick: number;
	startedAtTick: number | null;
	assignedDcId: string | null;
	regionAffinity?: ContractRegionAffinityView;
	bucket: ContractListBucket;
}

export function presentContractRegionAffinity(contract: Pick<Contract, "regionAffinity">): ContractRegionAffinityView | undefined {
	if (!contract.regionAffinity) {
		return undefined;
	}

	const labelByKey = {
		eu: "EU only",
		asia: "Asia only",
		usa: "USA only",
	} as const;

	return {
		key: contract.regionAffinity.key,
		label: labelByKey[contract.regionAffinity.key],
		allowedRegionIds: [...contract.regionAffinity.allowedRegionIds],
		allowedRegions: contract.regionAffinity.allowedRegionIds.map((regionId) => formatRegionLabel(regionId)),
	};
}

export function presentContract(contract: Contract, bucket: ContractListBucket): CliContractView {
	const regionAffinity = presentContractRegionAffinity(contract);
	return {
		id: contract.id,
		name: contract.name,
		status: contract.status,
		urgency: contract.urgency,
		tier: contract.tier,
		requirements: contract.requirements,
		monthlyPayment: contract.monthlyPayment,
		penaltyPerMonth: contract.penaltyPerMonth,
		termMonths: contract.termMonths,
		offeredAtTick: contract.offeredAtTick,
		expiresAtTick: contract.expiresAtTick,
		startedAtTick: contract.startedAtTick ?? null,
		assignedDcId: contract.assignedDcId ?? null,
		...(regionAffinity ? { regionAffinity } : {}),
		bucket,
	};
}

export function presentContracts(contracts: readonly Contract[], bucket: ContractListBucket): CliContractView[] {
	return contracts.map((contract) => presentContract(contract, bucket));
}

export function presentAcceptedContract(contract: Contract): CliContractView {
	const bucket: ContractListBucket = isLiveContract(contract)
		? "active"
		: isHistoricalContract(contract)
			? "history"
			: "market";
	return presentContract(contract, bucket);
}

export function presentContractBuckets(
	snapshot: Pick<GameState, "contracts" | "contractMarket" | "activeContracts">,
): {
	market: CliContractView[];
	active: CliContractView[];
	history: CliContractView[];
} {
	return {
		market: presentContracts(selectOpenMarketContractsFromState(snapshot), "market"),
		active: presentContracts(selectLiveContractsFromState(snapshot), "active"),
		history: presentContracts(selectHistoricalContractsFromState(snapshot), "history"),
	};
}

export function presentContractById(
	snapshot: Pick<GameState, "contracts" | "contractMarket" | "activeContracts">,
	contractId: string,
): CliContractView | undefined {
	const contract = selectContractByIdFromState(snapshot, contractId as Contract["id"]);
	if (!contract) {
		return undefined;
	}

	return presentAcceptedContract(contract);
}

export function formatContractRequirements(contract: Pick<CliContractView, "requirements">): string {
	return `vCPU=${contract.requirements.vCpu}, RAM=${contract.requirements.ramGb}GB, Storage=${contract.requirements.storageTb}TB, GPU=${contract.requirements.gpuFlops}`;
}

export function formatContractRegionAffinity(contract: Pick<CliContractView, "regionAffinity">): string {
	if (!contract.regionAffinity) {
		return "Any region";
	}

	return `${contract.regionAffinity.label} (${contract.regionAffinity.allowedRegions.join(", ")})`;
}
