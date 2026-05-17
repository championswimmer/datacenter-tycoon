import { datacenterCapacity } from "../entities/datacenter.js";
import type { Contract, ContractLifecycleState, ContractSlaOutcomeKind, ContractStatus, Datacenter, GameState } from "../types.js";
import { withContractSlaDefaults } from "./sla.js";

export type ContractEvaluationResult = "fulfilled" | "breached";

export const CONTRACT_BREACH_AUTO_CANCEL_MONTHS = 3;

/**
 * Returns true when a contract is "live" — i.e. it still commits capacity and
 * can currently pay revenue or levy penalties. Only `active` and `breached`
 * contracts are live. `expired` and `cancelled` contracts are historical.
 */
export function isLiveContractStatus(status: ContractStatus): boolean {
	return status === "active" || status === "breached";
}

export function isLiveContractLifecycleState(lifecycleState: ContractLifecycleState): boolean {
	return lifecycleState === "serving" || lifecycleState === "breached";
}

export function isHistoricalContractLifecycleState(lifecycleState: ContractLifecycleState): boolean {
	return lifecycleState === "market_expired" || lifecycleState === "cancelled" || lifecycleState === "completed";
}

type ContractLifecyclePick = Pick<Contract, "lifecycleState"> & Partial<Pick<Contract, "status" | "assignedDcId">>;

function effectiveLifecycleState(contract: ContractLifecyclePick): ContractLifecycleState {
	return contract.status ? lifecycleStateFromStatus(contract as Pick<Contract, "status" | "assignedDcId">) : contract.lifecycleState;
}

export function isMarketOpenContract(contract: ContractLifecyclePick): boolean {
	return effectiveLifecycleState(contract) === "market_open";
}

export function isLiveContract(contract: ContractLifecyclePick): boolean {
	return isLiveContractLifecycleState(effectiveLifecycleState(contract));
}

export function isHistoricalContract(contract: ContractLifecyclePick): boolean {
	return isHistoricalContractLifecycleState(effectiveLifecycleState(contract));
}

export function isCompletedContract(contract: ContractLifecyclePick): boolean {
	return effectiveLifecycleState(contract) === "completed";
}

export function isCancelledContract(contract: ContractLifecyclePick): boolean {
	return effectiveLifecycleState(contract) === "cancelled";
}

export function isMarketExpiredContract(contract: ContractLifecyclePick): boolean {
	return effectiveLifecycleState(contract) === "market_expired";
}

export function selectOpenMarketContracts<T extends ContractLifecyclePick>(contracts: readonly T[]): T[] {
	return contracts.filter(isMarketOpenContract);
}

export function selectLiveContracts<T extends ContractLifecyclePick>(contracts: readonly T[]): T[] {
	return contracts.filter(isLiveContract);
}

export function selectHistoricalContracts<T extends ContractLifecyclePick>(contracts: readonly T[]): T[] {
	return contracts.filter(isHistoricalContract);
}

export function selectCompletedContracts<T extends ContractLifecyclePick>(contracts: readonly T[]): T[] {
	return contracts.filter(isCompletedContract);
}

export function selectCancelledContracts<T extends ContractLifecyclePick>(contracts: readonly T[]): T[] {
	return contracts.filter(isCancelledContract);
}

export function selectMarketExpiredContracts<T extends ContractLifecyclePick>(contracts: readonly T[]): T[] {
	return contracts.filter(isMarketExpiredContract);
}

function lifecycleStateFromStatus(contract: Pick<Contract, "status" | "assignedDcId">): ContractLifecycleState {
	switch (contract.status) {
		case "offered":
			return "market_open";
		case "active":
			return "serving";
		case "breached":
			return "breached";
		case "cancelled":
			return "cancelled";
		case "expired":
			return contract.assignedDcId ? "completed" : "market_expired";
	}
}

function normalizedContract(contract: Contract): Contract {
	const lifecycleState = lifecycleStateFromStatus(contract);
	const normalized = withContractSlaDefaults(contract);
	if (normalized.lifecycleState === lifecycleState) {
		return normalized;
	}

	return {
		...normalized,
		lifecycleState,
	};
}

export function contractsFromState(state: Pick<GameState, "contracts" | "contractMarket" | "activeContracts">): Contract[] {
	const legacyContracts = [...(state.activeContracts ?? []), ...(state.contractMarket ?? [])];
	const contracts = state.contracts ?? [];
	const contractsById = new Map(contracts.map((contract) => [contract.id, contract]));
	const legacyOverrides = legacyContracts.filter((contract) => {
		const canonical = contractsById.get(contract.id);
		return !canonical || canonical.status !== contract.status || canonical.assignedDcId !== contract.assignedDcId;
	});
	const legacyOverrideIds = new Set(legacyOverrides.map((contract) => contract.id));
	return [
		...legacyOverrides,
		...contracts.filter((contract) => !legacyOverrideIds.has(contract.id)),
	].map(normalizedContract);
}

export function withDerivedContractViews<T extends GameState>(state: T): T {
	const openMarket = selectOpenMarketContracts(state.contracts);
	const acceptedHistoryOrLive = state.contracts.filter(
		(contract) => isLiveContract(contract) || isCompletedContract(contract) || isCancelledContract(contract),
	);
	return {
		...state,
		contractMarket: openMarket,
		activeContracts: acceptedHistoryOrLive,
	};
}

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
	previousContract: ContractLifecyclePick,
	nextContract: ContractLifecyclePick,
): ContractSlaOutcomeKind | undefined {
	const previousLifecycleState = effectiveLifecycleState(previousContract);
	const nextLifecycleState = effectiveLifecycleState(nextContract);
	if (
		isHistoricalContract(previousContract) ||
		nextLifecycleState === "market_open"
	) {
		return undefined;
	}

	if (nextLifecycleState === "serving") {
		return "fulfilled";
	}

	if (nextLifecycleState === "completed" || nextContract.status === "expired") {
		return previousLifecycleState === "breached" ? undefined : "fulfilled";
	}

	if (nextLifecycleState === "breached") {
		return "breached";
	}

	if (nextLifecycleState === "cancelled") {
		return "cancelled";
	}

	return undefined;
}

export function advanceContract(
	contract: Contract,
	datacenter: Datacenter,
	currentTick: number,
): Contract {
	const normalized = normalizedContract(contract);
	if (!isLiveContract(normalized)) {
		return normalized;
	}

	const evaluation = evaluateContract(datacenter, normalized);
	const startedAtTick = normalized.startedAtTick ?? currentTick;
	const hasTermEnded = currentTick >= startedAtTick + normalized.termMonths;

	if (hasTermEnded) {
		return {
			...normalized,
			lifecycleState: "completed",
			status: "expired",
			closedAtTick: currentTick,
		};
	}

	if (evaluation === "breached") {
		return {
			...normalized,
			lifecycleState: "breached",
			status: "breached",
			breachStreakMonths: (contract.breachStreakMonths ?? 0) + 1,
		};
	}

	return { ...normalized, lifecycleState: "serving", status: "active" };
}
