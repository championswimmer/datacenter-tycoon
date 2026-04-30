import type { Contract, Datacenter } from "../types.js";

export type ContractEvaluationResult = "fulfilled" | "breached";

export function evaluateContract(_datacenter: Datacenter, _contract: Contract): ContractEvaluationResult {
	throw new Error("evaluateContract is not implemented yet.");
}

export function advanceContract(
	_contract: Contract,
	_datacenter: Datacenter,
	_currentTick: number,
): Contract {
	throw new Error("advanceContract is not implemented yet.");
}
