import {
	RELIABILITY_DELTA_BREACHED,
	RELIABILITY_DELTA_CANCELLED,
	RELIABILITY_DELTA_FULFILLED,
	RELIABILITY_RECENT_OUTCOME_LIMIT,
	clampReliabilityScore,
} from "../balance/reliability.js";
import type { Contract, ContractSlaOutcome, ContractSlaOutcomeKind, PlayerReliability, Tick } from "../types.js";
import { classifyContractSlaOutcomeKind } from "./lifecycle.js";

export function contractReliabilityDelta(kind: ContractSlaOutcomeKind): number {
	switch (kind) {
		case "fulfilled":
			return RELIABILITY_DELTA_FULFILLED;
		case "breached":
			return RELIABILITY_DELTA_BREACHED;
		case "cancelled":
			return RELIABILITY_DELTA_CANCELLED;
	}
}

export function createContractSlaOutcome(
	contract: Pick<Contract, "id" | "name">,
	tick: Tick,
	kind: ContractSlaOutcomeKind,
): ContractSlaOutcome {
	return {
		contractId: contract.id,
		contractName: contract.name,
		tick,
		kind,
	};
}

export function collectContractSlaOutcomes(
	previousContracts: readonly Contract[],
	nextContracts: readonly Contract[],
	tick: Tick,
): ContractSlaOutcome[] {
	const previousContractsById = new Map(previousContracts.map((contract) => [contract.id, contract]));

	return nextContracts.flatMap((contract) => {
		const previousContract = previousContractsById.get(contract.id);
		if (!previousContract) {
			return [];
		}

		const kind = classifyContractSlaOutcomeKind(previousContract, contract);
		if (!kind) {
			return [];
		}

		return [createContractSlaOutcome(contract, tick, kind)];
	});
}

export function calculateReliabilityDelta(outcomes: readonly Pick<ContractSlaOutcome, "kind">[]): number {
	return outcomes.reduce((total, outcome) => total + contractReliabilityDelta(outcome.kind), 0);
}

export function applyReliabilityDelta(score: number, delta: number): number {
	return clampReliabilityScore(score + delta);
}

export function updatePlayerReliability(
	reliability: PlayerReliability,
	outcomes: readonly ContractSlaOutcome[],
): PlayerReliability {
	if (outcomes.length === 0) {
		return reliability;
	}

	const delta = calculateReliabilityDelta(outcomes);
	const nextRecentOutcomes = [...reliability.recentOutcomes, ...outcomes].slice(-RELIABILITY_RECENT_OUTCOME_LIMIT);

	return {
		score: applyReliabilityDelta(reliability.score, delta),
		lastDelta: delta,
		recentOutcomes: nextRecentOutcomes,
	};
}
