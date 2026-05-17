import { DAYS_PER_TICK } from "../balance/maintenance.js";
import { selectLiveContracts } from "./lifecycle.js";
import { summarizeFabricCapacityForDatacenter } from "../entities/fabric.js";
import type {
	Contract,
	ContractSlaTargetPercent,
	ContractSlaWindow,
	DatacenterId,
	GameState,
} from "../types.js";

export const DEFAULT_CONTRACT_SLA_TARGET_PERCENT = 90 as ContractSlaTargetPercent;

export function createEmptyContractSlaWindow(): ContractSlaWindow {
	return {
		sampledDays: 0,
		servedDays: 0,
		failedDays: 0,
	};
}

export function pickContractSlaTargetPercent(
	contract: Pick<Contract, "urgency" | "tier" | "monthlyPayment" | "penaltyPerMonth">,
): ContractSlaTargetPercent {
	if (contract.urgency === "rush" || contract.tier >= 3) {
		return 95;
	}

	if (contract.penaltyPerMonth >= contract.monthlyPayment * 0.5) {
		return 95;
	}

	if (contract.urgency === "anchor") {
		return 80;
	}

	return DEFAULT_CONTRACT_SLA_TARGET_PERCENT;
}

export function normalizeContractSlaWindow(
	window: Partial<ContractSlaWindow> | undefined,
): ContractSlaWindow {
	return {
		sampledDays: window?.sampledDays ?? 0,
		servedDays: window?.servedDays ?? 0,
		failedDays: window?.failedDays ?? 0,
	};
}

export function withContractSlaDefaults<T extends Contract>(contract: T): T {
	return {
		...contract,
		slaTargetPercent: contract.slaTargetPercent ?? DEFAULT_CONTRACT_SLA_TARGET_PERCENT,
		currentSlaWindow: normalizeContractSlaWindow(contract.currentSlaWindow),
	};
}

function canServeContractPool(
	state: Pick<GameState, "datacenters" | "map" | "contracts" | "contractMarket" | "activeContracts">,
	dcId: DatacenterId,
	liveContracts: readonly Contract[],
	cache: Map<DatacenterId, ReturnType<typeof summarizeFabricCapacityForDatacenter>>,
): boolean {
	const cached = cache.get(dcId);
	const summary = cached ?? summarizeFabricCapacityForDatacenter(state, dcId, liveContracts);
	if (!cached) {
		cache.set(dcId, summary);
	}

	return (
		summary.usable.vCpu >= summary.committed.vCpu &&
		summary.usable.ramGb >= summary.committed.ramGb &&
		summary.usable.storageTb >= summary.committed.storageTb &&
		summary.usable.gpuFlops >= summary.committed.gpuFlops
	);
}

export function sampleContractSlaWindows(
	state: Pick<GameState, "datacenters" | "map" | "contracts" | "contractMarket" | "activeContracts">,
	contracts: readonly Contract[],
): Contract[] {
	const liveContracts = selectLiveContracts(contracts);
	const capacitySummaryByDcId = new Map<DatacenterId, ReturnType<typeof summarizeFabricCapacityForDatacenter>>();

	return contracts.map((contract) => {
		if (
			contract.lifecycleState !== "serving" &&
			contract.lifecycleState !== "breached"
		) {
			return withContractSlaDefaults(contract);
		}

		const normalized = withContractSlaDefaults(contract);
		if (!normalized.assignedDcId) {
			return {
				...normalized,
				currentSlaWindow: {
					sampledDays: normalized.currentSlaWindow.sampledDays + 1,
					servedDays: normalized.currentSlaWindow.servedDays,
					failedDays: normalized.currentSlaWindow.failedDays + 1,
				},
			};
		}

		const served = canServeContractPool(state, normalized.assignedDcId, liveContracts, capacitySummaryByDcId);
		return {
			...normalized,
			currentSlaWindow: {
				sampledDays: normalized.currentSlaWindow.sampledDays + 1,
				servedDays: normalized.currentSlaWindow.servedDays + (served ? 1 : 0),
				failedDays: normalized.currentSlaWindow.failedDays + (served ? 0 : 1),
			},
		};
	});
}

export function contractSlaServedPercent(contract: Pick<Contract, "currentSlaWindow">): number {
	const sampledDays = contract.currentSlaWindow.sampledDays;
	if (sampledDays <= 0) {
		return 100;
	}

	return (contract.currentSlaWindow.servedDays / sampledDays) * 100;
}

export function contractMeetsSlaTarget(
	contract: Pick<Contract, "currentSlaWindow" | "slaTargetPercent">,
): boolean {
	return contractSlaServedPercent(contract) >= contract.slaTargetPercent;
}

export interface ContractSlaProgressView {
	contractId: Contract["id"];
	slaTargetPercent: ContractSlaTargetPercent;
	sampledDays: number;
	servedDays: number;
	failedDays: number;
	servedPercent: number;
	maxFailedDays: number;
	remainingFailureBudgetDays: number;
	status: "recoverable" | "at_risk" | "missed";
}

export function summarizeContractSlaProgress(
	contract: Pick<Contract, "id" | "slaTargetPercent" | "currentSlaWindow">,
): ContractSlaProgressView {
	const sampledDays = contract.currentSlaWindow.sampledDays;
	const servedDays = contract.currentSlaWindow.servedDays;
	const failedDays = contract.currentSlaWindow.failedDays;
	const remainingDays = Math.max(0, DAYS_PER_TICK - sampledDays);
	const maxFailedDays = Math.floor(DAYS_PER_TICK * ((100 - contract.slaTargetPercent) / 100));
	const remainingFailureBudgetDays = Math.max(0, maxFailedDays - failedDays);
	const servedPercent = contractSlaServedPercent(contract);
	const bestCasePercent = ((servedDays + remainingDays) / Math.max(1, DAYS_PER_TICK)) * 100;
	return {
		contractId: contract.id,
		slaTargetPercent: contract.slaTargetPercent,
		sampledDays,
		servedDays,
		failedDays,
		servedPercent,
		maxFailedDays,
		remainingFailureBudgetDays,
		status: bestCasePercent < contract.slaTargetPercent
			? "missed"
			: servedPercent >= contract.slaTargetPercent
				? "recoverable"
				: "at_risk",
	};
}

export function resetContractSlaWindow<T extends Contract>(contract: T): T {
	return {
		...contract,
		currentSlaWindow: createEmptyContractSlaWindow(),
	};
}
