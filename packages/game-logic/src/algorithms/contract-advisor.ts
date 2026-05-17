import {
	contractsFromState,
	isLiveContract,
	selectLiveContracts,
	selectOpenMarketContracts,
} from "../contracts/lifecycle.js";
import { datacenterContractCapacitySummary } from "../entities/datacenter.js";
import type {
	Capacity,
	Contract,
	ContractId,
	ContractRequirements,
	DatacenterId,
	GameState,
	Money,
} from "../types.js";
import {
	cancelReliabilityCashCost,
	scoreLiveContract,
	scoreMarketContract,
	scoreMarketContractForDatacenter,
	type ContractScoreOptions,
	type ContractValueBreakdown,
} from "./contract-score.js";

export interface AdvisorOptions extends ContractScoreOptions {
	/**
	 * Minimum NPV (in $) a single recommendation must beat to be surfaced.
	 * Filters out near-zero suggestions that aren't worth the player's
	 * attention. Default $1.
	 */
	minNpvDelta?: Money;
}

export interface AcceptRecommendation {
	kind: "accept";
	contractId: ContractId;
	contractName: string;
	dcId: DatacenterId;
	expectedDelta: Money;
	breakdown: ContractValueBreakdown;
	reason: string;
}

export interface CancelRecommendation {
	kind: "cancel";
	contractId: ContractId;
	contractName: string;
	dcId: DatacenterId;
	/** Cash benefit of cancelling now (positive if remaining value is net negative). */
	expectedDelta: Money;
	breakdown: ContractValueBreakdown;
	reason: string;
}

export interface SwapRecommendation {
	kind: "swap";
	dropContractId: ContractId;
	dropContractName: string;
	acceptContractId: ContractId;
	acceptContractName: string;
	dcId: DatacenterId;
	/** Net NPV improvement after paying cancel cost. */
	expectedDelta: Money;
	dropBreakdown: ContractValueBreakdown;
	acceptBreakdown: ContractValueBreakdown;
	reason: string;
}

export type AdvisorRecommendation =
	| AcceptRecommendation
	| CancelRecommendation
	| SwapRecommendation;

export interface AdvisorReport {
	recommendations: AdvisorRecommendation[];
	/** Total expected NPV improvement if every recommendation were applied in order. */
	totalExpectedDelta: Money;
}

const DEFAULT_MIN_NPV_DELTA = 1;

function canCoverRequirements(capacity: Capacity, requirements: ContractRequirements): boolean {
	return (
		capacity.vCpu >= requirements.vCpu &&
		capacity.ramGb >= requirements.ramGb &&
		capacity.storageTb >= requirements.storageTb &&
		capacity.gpuFlops >= requirements.gpuFlops
	);
}

function liveContractsByDatacenter(
	live: readonly Contract[],
): Map<DatacenterId, Contract[]> {
	const grouped = new Map<DatacenterId, Contract[]>();
	for (const contract of live) {
		if (!contract.assignedDcId) continue;
		const existing = grouped.get(contract.assignedDcId) ?? [];
		existing.push(contract);
		grouped.set(contract.assignedDcId, existing);
	}
	return grouped;
}

/**
 * Greedy single-swap candidate finder. For a market contract `m` that doesn't
 * fit, look for one live contract `L` such that:
 *
 *   1. dropping L frees enough capacity for m to fit
 *   2. NPV(m) − NPV_remaining(L) − cancelCost > 0
 *
 * Returns the best such L (largest net delta) or undefined if no swap is
 * profitable. M1 only considers 1-for-1 swaps — multi-step swap chains land
 * in the L4 min-cost-flow solver from the brainstorm.
 */
function findBestSingleSwap(
	state: Pick<GameState, "contracts" | "contractMarket" | "activeContracts" | "datacenters" | "map" | "difficulty" | "tick">,
	marketContract: Contract,
	options: AdvisorOptions | undefined,
): SwapRecommendation | undefined {
	const live = selectLiveContracts(contractsFromState(state));
	const cancelCost = cancelReliabilityCashCost(options);
	const grouped = liveContractsByDatacenter(live);

	let best: SwapRecommendation | undefined;

	for (const datacenter of state.datacenters) {
		const localLive = grouped.get(datacenter.id) ?? [];
		if (localLive.length === 0) continue;

		for (const candidate of localLive) {
			// Score the market contract under a shim state where the candidate
			// is already cancelled — that's the post-swap headroom the
			// scorer needs to see.
			const shimmedState = {
				...state,
				contracts: contractsFromState(state).map((contract) =>
					contract.id === candidate.id
						? { ...contract, lifecycleState: "cancelled" as const, status: "cancelled" as const }
						: contract,
				),
			};
			const acceptUnderSwap = scoreMarketContractForDatacenter(shimmedState, marketContract, datacenter, options);
			if (!acceptUnderSwap.fits) continue;

			const dropBreakdown = scoreLiveContract(state, candidate, options);
			// Baseline = doing nothing = letting market contract expire (NPV 0)
			// and keeping the live contract intact. So:
			//   swap value = acceptNPV − dropNPV − cancelCost
			const netDelta = acceptUnderSwap.npv - dropBreakdown.npv - cancelCost;

			if (netDelta <= (options?.minNpvDelta ?? DEFAULT_MIN_NPV_DELTA)) continue;

			const proposal: SwapRecommendation = {
				kind: "swap",
				dropContractId: candidate.id,
				dropContractName: candidate.name,
				acceptContractId: marketContract.id,
				acceptContractName: marketContract.name,
				dcId: datacenter.id,
				expectedDelta: netDelta,
				dropBreakdown,
				acceptBreakdown: acceptUnderSwap,
				reason: `Drop "${candidate.name}" (remaining NPV $${Math.round(dropBreakdown.npv).toLocaleString()}) to free room for "${marketContract.name}" (NPV $${Math.round(acceptUnderSwap.npv).toLocaleString()}). Net +$${Math.round(netDelta).toLocaleString()} after $${Math.round(cancelCost).toLocaleString()} reliability cost.`,
			};

			if (!best || proposal.expectedDelta > best.expectedDelta) {
				best = proposal;
			}
		}
	}

	return best;
}

/**
 * Produce a ranked list of recommended contract actions for the current state.
 *
 * Three categories surface:
 *   - **accept**: a market contract that fits an existing DC with positive NPV
 *   - **cancel**: a live contract whose remaining NPV is net negative (e.g.
 *     a chronic breach that's costing more in penalties than it earns)
 *   - **swap**: cancel a low-value live contract to free room for a higher-NPV
 *     market contract, accounting for reliability cost
 *
 * All recommendations are sorted by `expectedDelta` descending so the caller
 * can take the top N. This function is pure — it does not emit Action[].
 */
export function recommendContractActions(
	state: Pick<GameState, "contracts" | "contractMarket" | "activeContracts" | "datacenters" | "map" | "difficulty" | "tick">,
	options?: AdvisorOptions,
): AdvisorReport {
	const minDelta = options?.minNpvDelta ?? DEFAULT_MIN_NPV_DELTA;
	const recommendations: AdvisorRecommendation[] = [];

	const allContracts = contractsFromState(state);
	const market = selectOpenMarketContracts(allContracts);
	const live = selectLiveContracts(allContracts);

	// 1) Accept recommendations
	for (const marketContract of market) {
		const candidates = scoreMarketContract(state, marketContract, options);
		const best = candidates[0];
		if (!best) continue;

		if (best.fits && best.npv > minDelta) {
			recommendations.push({
				kind: "accept",
				contractId: marketContract.id,
				contractName: marketContract.name,
				dcId: best.dcId,
				expectedDelta: best.npv,
				breakdown: best,
				reason: `Accept "${marketContract.name}" on ${best.dcId} for projected NPV $${Math.round(best.npv).toLocaleString()} over ${best.monthsValued} months.`,
			});
			continue;
		}

		// 2) Swap recommendations — only when no DC currently has room
		if (!best.fits) {
			const swap = findBestSingleSwap(state, marketContract, options);
			if (swap) {
				recommendations.push(swap);
			}
		}
	}

	// 3) Cancel recommendations — for live contracts whose remaining value is
	// net negative *even without* a replacement. These are bleed-out cases
	// (e.g. chronic breaches piling up penalties).
	for (const liveContract of live) {
		if (!isLiveContract(liveContract)) continue;
		const breakdown = scoreLiveContract(state, liveContract, options);
		if (breakdown.npv < -minDelta) {
			const cancelGain = -breakdown.npv - cancelReliabilityCashCost(options);
			if (cancelGain > minDelta) {
				recommendations.push({
					kind: "cancel",
					contractId: liveContract.id,
					contractName: liveContract.name,
					dcId: liveContract.assignedDcId!,
					expectedDelta: cancelGain,
					breakdown,
					reason: `Cancel "${liveContract.name}" — remaining NPV $${Math.round(breakdown.npv).toLocaleString()} (penalty-dominated). Cancelling saves $${Math.round(cancelGain).toLocaleString()} net of reliability hit.`,
				});
			}
		}
	}

	recommendations.sort((a, b) => b.expectedDelta - a.expectedDelta);
	const totalExpectedDelta = recommendations.reduce((sum, rec) => sum + rec.expectedDelta, 0);

	return {
		recommendations,
		totalExpectedDelta,
	};
}
