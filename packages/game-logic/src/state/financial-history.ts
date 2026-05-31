import type { FinancialSnapshot, LedgerEntry, Money, Tick } from "../types.js";

function roundMoney(value: number): Money {
	return Math.round(value * 100) / 100;
}

export function createBaselineFinancialSnapshot(cash: Money, tick: Tick): FinancialSnapshot {
	return {
		tick,
		cash: roundMoney(cash),
		revenue: 0,
		opex: 0,
		penalty: 0,
		capex: 0,
		netOperating: 0,
		netCashFlow: 0,
		cumulativeRevenue: 0,
	};
}

export function summarizeCapexBetweenTicks(
	ledger: readonly Pick<LedgerEntry, "tick" | "type" | "amount">[],
	startTickInclusive: Tick,
	endTickInclusive: Tick,
): Money {
	return roundMoney(
		ledger.reduce((sum, entry) => {
			if (entry.type !== "capex") {
				return sum;
			}

			if (entry.tick < startTickInclusive || entry.tick > endTickInclusive) {
				return sum;
			}

			return sum + Math.max(0, -entry.amount);
		}, 0),
	);
}

export interface CreateMonthlyFinancialSnapshotOptions {
	previousSnapshot: FinancialSnapshot;
	tick: Tick;
	cash: Money;
	revenue: Money;
	opex: Money;
	penalty: Money;
	capex: Money;
}

export function createMonthlyFinancialSnapshot({
	previousSnapshot,
	tick,
	cash,
	revenue,
	opex,
	penalty,
	capex,
}: CreateMonthlyFinancialSnapshotOptions): FinancialSnapshot {
	const normalizedRevenue = roundMoney(Math.max(0, revenue));
	const normalizedOpex = roundMoney(Math.max(0, opex));
	const normalizedPenalty = roundMoney(Math.max(0, penalty));
	const normalizedCapex = roundMoney(Math.max(0, capex));
	const normalizedCash = roundMoney(cash);

	return {
		tick,
		cash: normalizedCash,
		revenue: normalizedRevenue,
		opex: normalizedOpex,
		penalty: normalizedPenalty,
		capex: normalizedCapex,
		netOperating: roundMoney(normalizedRevenue - normalizedOpex - normalizedPenalty),
		netCashFlow: roundMoney(normalizedCash - previousSnapshot.cash),
		cumulativeRevenue: roundMoney(previousSnapshot.cumulativeRevenue + normalizedRevenue),
	};
}
