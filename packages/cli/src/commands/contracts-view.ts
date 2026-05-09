import type { Contract } from "@datacenter-tycoon/game-logic";

export type ContractListBucket = "market" | "active";

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
	bucket: ContractListBucket;
}

export function presentContract(contract: Contract, bucket: ContractListBucket): CliContractView {
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
		bucket,
	};
}

export function presentContracts(contracts: readonly Contract[], bucket: ContractListBucket): CliContractView[] {
	return contracts.map((contract) => presentContract(contract, bucket));
}

export function formatContractRequirements(contract: Pick<CliContractView, "requirements">): string {
	return `vCPU=${contract.requirements.vCpu}, RAM=${contract.requirements.ramGb}GB, Storage=${contract.requirements.storageTb}TB, GPU=${contract.requirements.gpuFlops}`;
}
