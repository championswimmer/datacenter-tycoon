import {
	contractsFromState,
	withDerivedContractViews,
} from "../contracts/lifecycle.js";
import type { Action } from "../state/reduce.js";
import type {
	Contract,
	GameState,
	Money,
} from "../types.js";
import {
	recommendContractActions,
	type AdvisorOptions,
	type AdvisorRecommendation,
} from "./contract-advisor.js";

export interface AutopilotConfig extends AdvisorOptions {
	/** Hard cap on number of dispatched actions per invocation. Default 8. */
	maxActions?: number;
	/**
	 * Required cash buffer expressed in months of fixed opex. If the player's
	 * cash would fall below `cashBufferMonths * estimatedFixedMonthlyOpex`
	 * after running the plan, the plan is truncated. Default 2.
	 *
	 * Note: M1 only models cash-on-hand; multi-tick projection (Bellman-Ford
	 * on the cash-projection DAG, L8 from the brainstorm) lands in a later
	 * milestone.
	 */
	cashBufferMonths?: number;
	/**
	 * If true, the autopilot still produces an empty plan when the player's
	 * cash is already below buffer (refuses to act). If false (default), the
	 * autopilot is allowed to *cancel* — which never costs cash — even when
	 * below buffer, but won't *accept*.
	 */
	strictBufferGate?: boolean;
}

export interface AutopilotAction {
	action: Action;
	recommendation: AdvisorRecommendation;
}

export interface AutopilotPlan {
	actions: AutopilotAction[];
	totalExpectedDelta: Money;
	skippedReason?: string;
}

const DEFAULT_MAX_ACTIONS = 8;
const DEFAULT_CASH_BUFFER_MONTHS = 2;

function estimatedFixedMonthlyOpex(state: Pick<GameState, "datacenters" | "map">): Money {
	// Lightweight floor that ignores power/cooling (those scale with contracts).
	// Bandwidth, staff, and per-rack maintenance are committed regardless of
	// whether we accept contracts; that's what we need to keep paying.
	let total = 0;
	for (const dc of state.datacenters) {
		const region = state.map.regions.find((candidate) => candidate.id === dc.regionId);
		if (region) {
			total += dc.spec.staffCount * region.staffWage;
		}
		// Rack maintenance lives on the rack catalog; importing the catalog
		// directly would tie us to mutable shared state. The autopilot doesn't
		// need exact precision here — staff + a flat 10% buffer covers the
		// known opex shape (bandwidth + maintenance are typically ≤ staff).
	}
	return total * 1.1;
}

function translateToActions(recommendation: AdvisorRecommendation): Action[] {
	switch (recommendation.kind) {
		case "accept":
			return [{ type: "AcceptContract", contractId: recommendation.contractId, dcId: recommendation.dcId }];
		case "cancel":
			return [{ type: "CancelContract", contractId: recommendation.contractId }];
		case "swap":
			return [
				{ type: "CancelContract", contractId: recommendation.dropContractId },
				{
					type: "AcceptContract",
					contractId: recommendation.acceptContractId,
					dcId: recommendation.dcId,
				},
			];
	}
}

/**
 * Apply a recommendation's effects to a shadow contracts list so that the
 * advisor can be re-run for the next iteration. Mutates a shimmed copy of
 * `state.contracts` — *not* the underlying state — and returns the new state.
 *
 * Effects modelled:
 *   - accept: market contract becomes "serving" on `dcId`
 *   - cancel: live contract becomes "cancelled"
 *   - swap:   both of the above
 *
 * Crucially, we do NOT call the actual `reduce` here — that would refill the
 * market via the seeded RNG and conflate "what should I do right now" with
 * "what happens next tick". We want planning to be against the snapshot the
 * player can see.
 */
function applyRecommendationToShadow(state: GameState, recommendation: AdvisorRecommendation): GameState {
	const contracts = contractsFromState(state);
	const updated = contracts.map<Contract>((contract) => {
		if (recommendation.kind === "accept" && contract.id === recommendation.contractId) {
			return {
				...contract,
				lifecycleState: "serving",
				status: "active",
				startedAtTick: state.tick,
				acceptedAtTick: state.tick,
				assignedDcId: recommendation.dcId,
			};
		}
		if (recommendation.kind === "cancel" && contract.id === recommendation.contractId) {
			return {
				...contract,
				lifecycleState: "cancelled",
				status: "cancelled",
				closedAtTick: state.tick,
			};
		}
		if (recommendation.kind === "swap") {
			if (contract.id === recommendation.dropContractId) {
				return {
					...contract,
					lifecycleState: "cancelled",
					status: "cancelled",
					closedAtTick: state.tick,
				};
			}
			if (contract.id === recommendation.acceptContractId) {
				return {
					...contract,
					lifecycleState: "serving",
					status: "active",
					startedAtTick: state.tick,
					acceptedAtTick: state.tick,
					assignedDcId: recommendation.dcId,
				};
			}
		}
		return contract;
	});

	return withDerivedContractViews({
		...state,
		contracts: updated,
	});
}

/**
 * Plan a sequence of contract actions for the current tick.
 *
 * Greedy iteration: repeatedly take the top-ranked recommendation, apply it
 * to a shadow state, and re-rank — until `maxActions` is hit, no positive
 * recommendation remains, or the cash buffer gate fires.
 *
 * The returned plan is JSON-serializable, deterministic given a fixed
 * `(state, config)`, and ready to dispatch via the existing reducer.
 */
export function planContractAutopilot(state: GameState, config?: AutopilotConfig): AutopilotPlan {
	const maxActions = config?.maxActions ?? DEFAULT_MAX_ACTIONS;
	const cashBufferMonths = config?.cashBufferMonths ?? DEFAULT_CASH_BUFFER_MONTHS;
	const strictBufferGate = config?.strictBufferGate ?? false;

	const monthlyOpex = estimatedFixedMonthlyOpex(state);
	const cashBuffer = monthlyOpex * cashBufferMonths;
	const belowBuffer = state.player.cash < cashBuffer;

	if (strictBufferGate && belowBuffer) {
		return {
			actions: [],
			totalExpectedDelta: 0,
			skippedReason: `Cash ($${Math.round(state.player.cash).toLocaleString()}) below buffer ($${Math.round(cashBuffer).toLocaleString()}). Strict gate enabled.`,
		};
	}

	const plan: AutopilotAction[] = [];
	let cursor = state;
	let totalDelta = 0;

	for (let i = 0; i < maxActions; i++) {
		const report = recommendContractActions(cursor, config);
		const top = report.recommendations[0];
		if (!top) break;

		// When below buffer, only allow cancels (they never spend cash) — accepts
		// and swaps are gated until cash recovers.
		if (belowBuffer && top.kind !== "cancel") break;

		// Translate, push, advance cursor.
		const actions = translateToActions(top);
		for (const action of actions) {
			plan.push({ action, recommendation: top });
		}
		totalDelta += top.expectedDelta;

		cursor = applyRecommendationToShadow(cursor, top);
	}

	return {
		actions: plan,
		totalExpectedDelta: totalDelta,
		skippedReason: belowBuffer && !strictBufferGate
			? `Cash below buffer; only cancellations permitted this plan.`
			: undefined,
	};
}
