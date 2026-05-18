import { minimumNonGpuMarketOffers, minimumUnrestrictedMarketOffers } from "../balance/index.js";
import { reliabilityMarketPolicyForScore } from "../balance/reliability.js";
import { summarizeFabricCapacityForDatacenter } from "../entities/fabric.js";
import { rngFromState } from "../sim/rng.js";
import type {
	Capacity,
	Contract,
	ContractId,
	ContractRegionAffinityKey,
	ContractRequirements,
	DatacenterId,
	GameState,
	RegionId,
} from "../types.js";
import { contractTermBand, generateContractForTermBand, type ContractGenerationConstraints, type ContractTermBand } from "./generator.js";
import { contractsFromState, selectLiveContracts, selectOpenMarketContracts, withDerivedContractViews } from "./lifecycle.js";

export interface ContractCapacityFailure {
	code: "insufficient_capacity";
	dcId: DatacenterId;
	required: ContractRequirements;
	available: Capacity;
}

export interface ContractRegionFailure {
	code: "region_not_allowed";
	dcId: DatacenterId;
	dcRegionId: RegionId;
	affinityKey: ContractRegionAffinityKey;
	allowedRegionIds: RegionId[];
}

export type ContractAcceptanceFailure = ContractCapacityFailure | ContractRegionFailure;

export class ContractAcceptanceError extends Error {
	readonly data: ContractAcceptanceFailure;

	constructor(data: ContractAcceptanceFailure) {
		super(
			data.code === "insufficient_capacity"
				? `Datacenter ${data.dcId} lacks available capacity for this contract`
				: `Datacenter ${data.dcId} is in region ${data.dcRegionId}, but this contract only allows ${data.allowedRegionIds.join(", ")}`,
		);
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

function datacenterRegionAllowed(contract: Pick<Contract, "regionAffinity">, regionId: RegionId): boolean {
	return contract.regionAffinity ? contract.regionAffinity.allowedRegionIds.includes(regionId) : true;
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

function countUnrestrictedOffers(offers: readonly Pick<Contract, "regionAffinity">[]): number {
	return offers.filter((offer) => !offer.regionAffinity).length;
}

function countNonGpuOffers(offers: readonly Pick<Contract, "requirements">[]): number {
	return offers.filter((offer) => offer.requirements.gpuFlops === 0).length;
}

function nextGenerationConstraints(existingOffers: readonly Contract[], offerTarget: number): ContractGenerationConstraints {
	const remainingSlots = Math.max(0, offerTarget - existingOffers.length);
	if (remainingSlots === 0) {
		return {};
	}

	const unrestrictedGap = Math.max(0, minimumUnrestrictedMarketOffers(offerTarget) - countUnrestrictedOffers(existingOffers));
	const nonGpuGap = Math.max(0, minimumNonGpuMarketOffers(offerTarget) - countNonGpuOffers(existingOffers));
	const constraints: ContractGenerationConstraints = {};

	if (unrestrictedGap > 0) {
		constraints.requireUnrestricted = unrestrictedGap >= remainingSlots;
	}
	if (nonGpuGap > 0) {
		constraints.requireNonGpu = nonGpuGap >= remainingSlots;
	}

	if (unrestrictedGap > 0 && nonGpuGap > 0 && remainingSlots <= unrestrictedGap + nonGpuGap) {
		constraints.requireUnrestricted = true;
		constraints.requireNonGpu = true;
	}

	return constraints;
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
		const constraints = nextGenerationConstraints(offers, offerTarget);
		const generatedContract = generateContractForTermBand(
			rng,
			difficulty,
			desiredBand,
			marketPolicy,
			state.map.regions,
			constraints,
		);
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

	if (!datacenterRegionAllowed(contractToAccept, datacenter.regionId)) {
		throw new ContractAcceptanceError({
			code: "region_not_allowed",
			dcId,
			dcRegionId: datacenter.regionId,
			affinityKey: contractToAccept.regionAffinity!.key,
			allowedRegionIds: [...contractToAccept.regionAffinity!.allowedRegionIds],
		});
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
