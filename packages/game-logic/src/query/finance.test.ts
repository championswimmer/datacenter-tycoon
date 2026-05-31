import assert from "node:assert/strict";
import test from "node:test";

import { newGame } from "../state/newGame.js";
import type { FinancialSnapshot, GameState } from "../types.js";
import {
	selectCumulativeRevenueFromState,
	selectFinancialHistoryFromState,
	selectLatestFinancialSnapshotFromState,
	summarizeCumulativeRevenue,
} from "./finance.js";

function snapshot(partial: Partial<FinancialSnapshot> & Pick<FinancialSnapshot, "tick" | "cash">): FinancialSnapshot {
	return {
		revenue: 0,
		opex: 0,
		penalty: 0,
		capex: 0,
		netOperating: 0,
		netCashFlow: 0,
		cumulativeRevenue: 0,
		...partial,
	};
}

test("finance selectors return history and the latest snapshot", () => {
	const state = newGame(42);
	const history: FinancialSnapshot[] = [
		snapshot({ tick: 0, cash: 100_000 }),
		snapshot({ tick: 1, cash: 120_000, revenue: 25_000, opex: 5_000, cumulativeRevenue: 25_000, netOperating: 20_000, netCashFlow: 20_000 }),
	];
	const financeState: GameState = {
		...state,
		financialHistory: history,
	};

	assert.deepEqual(selectFinancialHistoryFromState(financeState), history);
	assert.deepEqual(selectLatestFinancialSnapshotFromState(financeState), history[1]);
});

test("selectCumulativeRevenueFromState prefers persisted finance history and falls back to the ledger", () => {
	const base = newGame(42);
	const historyState: GameState = {
		...base,
		ledger: [
			{ id: "ledger-rev-1" as GameState["ledger"][number]["id"], tick: 1, type: "revenue", amount: 10_000, reason: "rev" },
		],
		financialHistory: [snapshot({ tick: 0, cash: base.player.cash }), snapshot({ tick: 1, cash: base.player.cash + 7_500, cumulativeRevenue: 7_500, netCashFlow: 7_500 })],
	};
	const ledgerOnlyState: GameState = {
		...base,
		ledger: [
			{ id: "ledger-rev-1" as GameState["ledger"][number]["id"], tick: 1, type: "revenue", amount: 10_000, reason: "rev" },
			{ id: "ledger-opex-1" as GameState["ledger"][number]["id"], tick: 1, type: "opex", amount: -2_000, reason: "opex" },
		],
		financialHistory: [],
	};

	assert.equal(selectCumulativeRevenueFromState(historyState), 7_500);
	assert.equal(selectCumulativeRevenueFromState(ledgerOnlyState), 10_000);
});

test("summarizeCumulativeRevenue only counts positive revenue ledger entries", () => {
	assert.equal(
		summarizeCumulativeRevenue([
			{ type: "revenue", amount: 10 },
			{ type: "opex", amount: -4 },
			{ type: "revenue", amount: 6 },
			{ type: "penalty", amount: -3 },
		]),
		16,
	);
});
