import { reliabilityMarketPolicyForScore } from "../balance/reliability.js";
import { rngFromState } from "../sim/rng.js";
import type { ContractId, DatacenterId, GameState } from "../types.js";
import { generateContract } from "./generator.js";

export function marketDifficulty(currentTick: number, roll: number): number {
	const baseline = 0.15 + Math.min(0.65, currentTick * 0.015);
	if (currentTick <= 5) {
		return Math.max(0.05, Math.min(0.25, baseline + roll * 0.15));
	}
	return Math.max(0.05, Math.min(0.85, baseline + roll * 0.35 - 0.1));
}

function targetOfferCount(state: GameState): number {
	return reliabilityMarketPolicyForScore(state.player.reliability.score).offerCount;
}

export function refreshContractMarket(state: GameState): GameState {
	const retainedOffers = state.contractMarket.filter(
		(contract) => contract.status === "offered" && contract.expiresAtTick > state.tick,
	);
	const rng = rngFromState(state.rngState);
	const refreshedOffers = [...retainedOffers];
	const offerTarget = targetOfferCount(state);

	while (refreshedOffers.length < offerTarget) {
		const difficulty = marketDifficulty(state.tick, rng.next());
		const generatedContract = generateContract(rng, difficulty);
		refreshedOffers.push({
			...generatedContract,
			offeredAtTick: state.tick,
			expiresAtTick: state.tick + generatedContract.expiresAtTick,
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

	const remainingMarket = state.contractMarket.filter((contract) => contract.id !== contractId);

	const rng = rngFromState(state.rngState);
	const backfilledMarket = [...remainingMarket];
	const offerTarget = targetOfferCount(state);
	while (backfilledMarket.length < offerTarget) {
		const difficulty = marketDifficulty(state.tick, rng.next());
		const generatedContract = generateContract(rng, difficulty);
		backfilledMarket.push({
			...generatedContract,
			offeredAtTick: state.tick,
			expiresAtTick: state.tick + generatedContract.expiresAtTick,
			status: "offered",
		});
	}

	return {
		...state,
		contractMarket: backfilledMarket,
		rngState: rng.state(),
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
