import { MARKET_REFRESH_SIZE } from "../economy/constants.js";
import { rngFromState } from "../sim/rng.js";
import type { ContractId, DatacenterId, GameState } from "../types.js";
import { generateContract } from "./generator.js";

const OFFER_DURATION_TICKS = 3;

function marketDifficulty(currentTick: number, roll: number): number {
	const baseline = 0.15 + Math.min(0.65, currentTick * 0.015);
	return Math.max(0.05, Math.min(1, baseline + roll * 0.35 - 0.1));
}

export function refreshContractMarket(state: GameState): GameState {
	const retainedOffers = state.contractMarket.filter(
		(contract) => contract.status === "offered" && contract.expiresAtTick > state.tick,
	);
	const rng = rngFromState(state.rngState);
	const refreshedOffers = [...retainedOffers];

	while (refreshedOffers.length < MARKET_REFRESH_SIZE) {
		const difficulty = marketDifficulty(state.tick, rng.next());
		const generatedContract = generateContract(rng, difficulty);
		refreshedOffers.push({
			...generatedContract,
			offeredAtTick: state.tick,
			expiresAtTick: state.tick + OFFER_DURATION_TICKS,
			status: "offered",
		});
	}

	return {
		...state,
		contractMarket: refreshedOffers,
		rngState: rng.state(),
	};
}

export function acceptContract(
	state: GameState,
	contractId: ContractId,
	dcId: DatacenterId,
): GameState {
	const datacenterExists = state.datacenters.some((datacenter) => datacenter.id === dcId);
	if (!datacenterExists) {
		throw new Error(`Unknown datacenter: ${dcId}`);
	}

	const existingContract = state.activeContracts.find((contract) => contract.id === contractId);
	if (existingContract) {
		throw new Error(`Contract already active: ${contractId}`);
	}

	const contractToAccept = state.contractMarket.find((contract) => contract.id === contractId);
	if (!contractToAccept) {
		throw new Error(`Unknown market contract: ${contractId}`);
	}

	return {
		...state,
		contractMarket: state.contractMarket.filter((contract) => contract.id !== contractId),
		activeContracts: [
			...state.activeContracts,
			{
				...contractToAccept,
				status: "active",
				startedAtTick: state.tick,
				assignedDcId: dcId,
			},
		],
	};
}
