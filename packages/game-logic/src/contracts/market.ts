import type { ContractId, DatacenterId, GameState } from "../types.js";

export function refreshContractMarket(_state: GameState): GameState {
	throw new Error("refreshContractMarket is not implemented yet.");
}

export function acceptContract(
	_state: GameState,
	_contractId: ContractId,
	_dcId: DatacenterId,
): GameState {
	throw new Error("acceptContract is not implemented yet.");
}
