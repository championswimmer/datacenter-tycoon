import { datacenterCapacity } from "../entities/datacenter.js";
import type { Contract, ContractSlaOutcomeKind, Datacenter } from "../types.js";

export type ContractEvaluationResult = "fulfilled" | "breached";

export function evaluateContract(datacenter: Datacenter, contract: Contract): ContractEvaluationResult {
	const capacity = datacenterCapacity(datacenter);
	const { requirements } = contract;

	return capacity.vCpu >= requirements.vCpu &&
		capacity.ramGb >= requirements.ramGb &&
		capacity.storageTb >= requirements.storageTb &&
		capacity.gpuFlops >= requirements.gpuFlops
		? "fulfilled"
		: "breached";
}

export function classifyContractSlaOutcomeKind(
	previousContract: Pick<Contract, "status">,
	nextContract: Pick<Contract, "status">,
): ContractSlaOutcomeKind | undefined {
	if (
		previousContract.status === "expired" ||
		previousContract.status === "cancelled" ||
		nextContract.status === "offered"
	) {
		return undefined;
	}

	if (nextContract.status === "active") {
		return "fulfilled";
	}

	if (nextContract.status === "expired") {
		return previousContract.status === "breached" ? undefined : "fulfilled";
	}

	if (nextContract.status === "breached") {
		return "breached";
	}

	if (nextContract.status === "cancelled") {
		return "cancelled";
	}

	return undefined;
}

export function advanceContract(
	contract: Contract,
	datacenter: Datacenter,
	currentTick: number,
): Contract {
	if (contract.status === "expired" || contract.status === "cancelled") {
		return contract;
	}

	const evaluation = evaluateContract(datacenter, contract);
	const startedAtTick = contract.startedAtTick ?? currentTick;
	const hasTermEnded = currentTick >= startedAtTick + contract.termMonths;

	if (hasTermEnded) {
		return {
			...contract,
			status: "expired",
		};
	}

	if (evaluation === "breached") {
		return { ...contract, status: "breached" };
	}

	return { ...contract, status: "active" };
}
