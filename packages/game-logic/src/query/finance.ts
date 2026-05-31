import type { FinancialSnapshot, GameState, LedgerEntry, Money } from "../types.js";

export function selectFinancialHistoryFromState(
	state: Pick<GameState, "financialHistory">,
): FinancialSnapshot[] {
	return state.financialHistory;
}

export function selectLatestFinancialSnapshotFromState(
	state: Pick<GameState, "financialHistory">,
): FinancialSnapshot | undefined {
	return state.financialHistory.at(-1);
}

export function summarizeCumulativeRevenue(
	ledger: readonly Pick<LedgerEntry, "type" | "amount">[],
): Money {
	return ledger
		.filter((entry) => entry.type === "revenue")
		.reduce((sum, entry) => sum + entry.amount, 0);
}

export function selectCumulativeRevenueFromState(
	state: Pick<GameState, "tick" | "financialHistory" | "ledger">,
): Money {
	const latestSnapshot = selectLatestFinancialSnapshotFromState(state);
	return latestSnapshot && latestSnapshot.tick >= state.tick
		? latestSnapshot.cumulativeRevenue
		: summarizeCumulativeRevenue(state.ledger);
}
