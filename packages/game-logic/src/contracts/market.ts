import { reliabilityMarketPolicyForScore } from "../balance/reliability.js";
import { summarizeFabricCapacityForDatacenter } from "../entities/fabric.js";
import { rngFromState } from "../sim/rng.js";
import type { Capacity, Contract, ContractId, ContractRequirements, DatacenterId, GameState } from "../types.js";
import { contractTermBand, generateContractForTermBand, type ContractTermBand } from "./generator.js";
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

function desiredMarketBandMix(offerTarget: number): ContractTermBand[] {
	const shortTarget = Math.max(1, Math.floor(offerTarget / 3));
	const longTarget = Math.max(1, Math.floor(offerTarget / 3));
	const standardTarget = Math.max(0, offerTarget - shortTarget - longTarget);
	const mix: ContractTermBand[] = [];

	for (let i = 0; i < offerTarget; i++) {
		if (i % 3 === 0 && mix.filter((band) => band === "short").length < shortTarget) {
			mix.push("short");
			continue;
		}
		if (i % 3 === 1 && mix.filter((band) => band === "standard").length < standardTarget) {
			mix.push("standard");
			continue;
		}
		if (mix.filter((band) => band === "long").length < longTarget) {
			mix.push("long");
			continue;
		}
		if (mix.filter((band) => band === "short").length < shortTarget) {
			mix.push("short");
			continue;
		}
		mix.push("standard");
	}

	return mix;
}

function nextDesiredMarketBand(existingOffers: readonly { termMonths: number }[], offerTarget: number): ContractTermBand {
	const desiredMix = desiredMarketBandMix(offerTarget);
	const currentCounts = new Map<ContractTermBand, number>([
		["short", 0],
		["standard", 0],
		["long", 0],
	]);

	for (const offer of existingOffers) {
		const band = contractTermBand(offer.termMonths);
		currentCounts.set(band, (currentCounts.get(band) ?? 0) + 1);
	}

	const desiredCounts = new Map<ContractTermBand, number>([
		["short", desiredMix.filter((band) => band === "short").length],
		["standard", desiredMix.filter((band) => band === "standard").length],
		["long", desiredMix.filter((band) => band === "long").length],
	]);

	for (const band of ["short", "long", "standard"] as const) {
		if ((currentCounts.get(band) ?? 0) < (desiredCounts.get(band) ?? 0)) {
			return band;
		}
	}

	return desiredMix[existingOffers.length % desiredMix.length] ?? "standard";
}

function fillMarketOffers(
	existingOffers: readonly Contract[],
	state: GameState,
	rngState: number,
): { offers: Contract[]; rngState: number } {
	const rng = rngFromState(rngState);
	const marketPolicy = reliabilityMarketPolicyForScore(state.player.reliability.score);
	const offerTarget = marketPolicy.offerCount;
	const offers = [...existingOffers].slice(0, offerTarget);

	while (offers.length < offerTarget) {
		const difficulty = marketDifficulty(state.tick, rng.next());
		const desiredBand = nextDesiredMarketBand(offers, offerTarget);
		const generatedContract = generateContractForTermBand(rng, difficulty, desiredBand, marketPolicy);
		offers.push({
			...generatedContract,
			offeredAtTick: state.tick,
			expiresAtTick: state.tick + generatedContract.expiresAtTick,
			lifecycleState: "market_open",
			status: "offered",
		});
	}

	return { offers, rngState: rng.state() };
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
	const retainedOffers = selectOpenMarketContracts(contractsWithExpiredOffers);
	const filledMarket = fillMarketOffers(retainedOffers, state, state.rngState);

	return withDerivedContractViews({
		...state,
		contracts: [
			...contractsWithExpiredOffers.filter((contract) => contract.lifecycleState !== "market_open"),
			...filledMarket.offers,
		],
		rngState: filledMarket.rngState,
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

	const capacitySummary = summarizeFabricCapacityForDatacenter(state, dcId);
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

	const filledMarket = fillMarketOffers(remainingMarket, state, state.rngState);

	return withDerivedContractViews({
		...state,
		contracts: [
			...contractsWithAccepted.filter((contract) => contract.lifecycleState !== "market_open"),
			...filledMarket.offers,
		],
		rngState: filledMarket.rngState,
	});
}
