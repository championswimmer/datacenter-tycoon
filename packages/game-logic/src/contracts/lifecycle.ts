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
		previousContract.status === "completed" ||
		previousContract.status === "cancelled" ||
		nextContract.status === "offered"
	) {
		return undefined;
	}

	if (nextContract.status === "active" || nextContract.status === "completed") {
		return "fulfilled";
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
	if (contract.status === "completed" || contract.status === "cancelled") {
		return contract;
	}

	const evaluation = evaluateContract(datacenter, contract);
	const startedAtTick = contract.startedAtTick ?? currentTick;
	const hasTermEnded = currentTick >= startedAtTick + contract.termMonths;

	if (hasTermEnded) {
		return {
			...contract,
			status: evaluation === "fulfilled" ? "completed" : "cancelled",
		};
	}

	if (evaluation === "breached") {
		if (contract.status === "breached") {
			return { ...contract, status: "cancelled" };
		}
		return { ...contract, status: "breached" };
	}

	return { ...contract, status: "active" };
}
