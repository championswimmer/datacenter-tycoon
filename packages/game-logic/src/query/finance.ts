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
	state: Pick<GameState, "financialHistory" | "ledger">,
): Money {
	return selectLatestFinancialSnapshotFromState(state)?.cumulativeRevenue ?? summarizeCumulativeRevenue(state.ledger);
}
