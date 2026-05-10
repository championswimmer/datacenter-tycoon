import { reliabilityMarketPolicyForScore } from "../balance/reliability.js";
import { datacenterContractCapacitySummary } from "../entities/datacenter.js";
import { rngFromState } from "../sim/rng.js";
import type { Capacity, ContractId, ContractRequirements, DatacenterId, GameState } from "../types.js";
import { generateContract } from "./generator.js";
import { contractsFromState, selectLiveContracts, selectOpenMarketContracts, withDerivedContractViews } from "./lifecycle.js";

export interface ContractAcceptanceFailure {
	code: "insufficient_capacity";
	dcId: DatacenterId;
	required: ContractRequirements;
	available: Capacity;
}

export class ContractAcceptanceError extends Error {
	readonly data: ContractAcceptanceFailure;

	constructor(data: ContractAcceptanceFailure) {
		super(`Datacenter ${data.dcId} lacks available capacity for this contract`);
		this.name = "ContractAcceptanceError";
		this.data = data;
	}
}

function canCoverRequirements(capacity: Capacity, requirements: ContractRequirements): boolean {
	return (
		capacity.vCpu >= requirements.vCpu &&
		capacity.ramGb >= requirements.ramGb &&
		capacity.storageTb >= requirements.storageTb &&
		capacity.gpuFlops >= requirements.gpuFlops
	);
}

// Reliability never changes the core difficulty curve itself. It only affects how many
// offers are backfilled and the generation policy used after this tick-based difficulty
// roll has already been produced from the seeded RNG stream.
export function marketDifficulty(currentTick: number, roll: number): number {
	const baseline = 0.15 + Math.min(0.65, currentTick * 0.015);
	if (currentTick <= 5) {
		return Math.max(0.05, Math.min(0.25, baseline + roll * 0.15));
	}
	return Math.max(0.05, Math.min(0.85, baseline + roll * 0.35 - 0.1));
}

export function refreshContractMarket(state: GameState): GameState {
	const contracts = contractsFromState(state);
	const contractsWithExpiredOffers = contracts.map((contract) =>
		contract.lifecycleState === "market_open" && contract.expiresAtTick <= state.tick
			? {
					...contract,
					lifecycleState: "market_expired" as const,
					status: "expired" as const,
					closedAtTick: state.tick,
				}
			: contract,
	);
	const rng = rngFromState(state.rngState);
	const marketPolicy = reliabilityMarketPolicyForScore(state.player.reliability.score);
	const offerTarget = marketPolicy.offerCount;
	const retainedOffers = selectOpenMarketContracts(contractsWithExpiredOffers).slice(0, offerTarget);
	const refreshedOffers = [...retainedOffers];

	while (refreshedOffers.length < offerTarget) {
		const difficulty = marketDifficulty(state.tick, rng.next());
		const generatedContract = generateContract(rng, difficulty, marketPolicy);
		refreshedOffers.push({
			...generatedContract,
			offeredAtTick: state.tick,
			expiresAtTick: state.tick + generatedContract.expiresAtTick,
			lifecycleState: "market_open",
			status: "offered",
		});
	}

	return withDerivedContractViews({
		...state,
		contracts: [
			...contractsWithExpiredOffers.filter((contract) => contract.lifecycleState !== "market_open"),
			...refreshedOffers,
		],
		rngState: rng.state(),
	});
}

export function acceptContract(
	state: GameState,
	contractId: ContractId,
	dcId: DatacenterId,
): GameState {
	const datacenter = state.datacenters.find((candidate) => candidate.id === dcId);
	if (!datacenter) {
		throw new Error(`Unknown datacenter: ${dcId}`);
	}

	const contracts = contractsFromState(state);
	const existingLiveContract = selectLiveContracts(contracts).find((contract) => contract.id === contractId);
	if (existingLiveContract) {
		throw new Error(`Contract already active: ${contractId}`);
	}

	const contractToAccept = selectOpenMarketContracts(contracts).find((contract) => contract.id === contractId);
	if (!contractToAccept) {
		throw new Error(`Unknown market contract: ${contractId}`);
	}

	const capacitySummary = datacenterContractCapacitySummary(datacenter, selectLiveContracts(contracts));
	if (!canCoverRequirements(capacitySummary.available, contractToAccept.requirements)) {
		throw new ContractAcceptanceError({
			code: "insufficient_capacity",
			dcId,
			required: contractToAccept.requirements,
			available: capacitySummary.available,
		});
	}

	const acceptedContract = {
		...contractToAccept,
		lifecycleState: "serving" as const,
		status: "active" as const,
		startedAtTick: state.tick,
		acceptedAtTick: state.tick,
		assignedDcId: dcId,
	};
	const contractsWithAccepted = contracts.map((contract) =>
		contract.id === contractId ? acceptedContract : contract,
	);
	const remainingMarket = selectOpenMarketContracts(contractsWithAccepted);

	const rng = rngFromState(state.rngState);
	const backfilledMarket = [...remainingMarket];
	const marketPolicy = reliabilityMarketPolicyForScore(state.player.reliability.score);
	const offerTarget = marketPolicy.offerCount;
	while (backfilledMarket.length < offerTarget) {
		const difficulty = marketDifficulty(state.tick, rng.next());
		const generatedContract = generateContract(rng, difficulty, marketPolicy);
		backfilledMarket.push({
			...generatedContract,
			offeredAtTick: state.tick,
			expiresAtTick: state.tick + generatedContract.expiresAtTick,
			lifecycleState: "market_open",
			status: "offered",
		});
	}

	return withDerivedContractViews({
		...state,
		contracts: [
			...contractsWithAccepted.filter((contract) => contract.lifecycleState !== "market_open"),
			...backfilledMarket,
		],
		rngState: rng.state(),
	});
}
