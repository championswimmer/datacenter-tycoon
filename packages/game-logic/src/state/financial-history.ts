import type { FinancialSnapshot, GameState, LedgerEntry, Money, Tick } from "../types.js";

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

export function inferStartingCashFromLedger(
	currentCash: Money,
	ledger: readonly Pick<LedgerEntry, "amount">[],
): Money {
	return roundMoney(currentCash - ledger.reduce((sum, entry) => sum + entry.amount, 0));
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

export function backfillFinancialHistoryFromLedger(
	state: Pick<GameState, "tick" | "player" | "ledger">,
): FinancialSnapshot[] {
	const currentTick = Math.max(0, Math.floor(state.tick)) as Tick;
	const history: FinancialSnapshot[] = [
		createBaselineFinancialSnapshot(inferStartingCashFromLedger(state.player.cash, state.ledger), 0 as Tick),
	];

	for (let tickNumber = 1; tickNumber <= currentTick; tickNumber += 1) {
		const tick = tickNumber as Tick;
		const previousSnapshot = history.at(-1)!;
		const entriesAtTick = state.ledger.filter((entry) => entry.tick === tick);
		const capex = summarizeCapexBetweenTicks(state.ledger, previousSnapshot.tick, previousSnapshot.tick);
		const revenue = roundMoney(
			entriesAtTick
				.filter((entry) => entry.type === "revenue")
				.reduce((sum, entry) => sum + Math.max(0, entry.amount), 0),
		);
		const opex = roundMoney(
			entriesAtTick
				.filter((entry) => entry.type === "opex")
				.reduce((sum, entry) => sum + Math.max(0, -entry.amount), 0),
		);
		const penalty = roundMoney(
			entriesAtTick
				.filter((entry) => entry.type === "penalty")
				.reduce((sum, entry) => sum + Math.max(0, -entry.amount), 0),
		);
		const monthDelta = roundMoney(entriesAtTick.reduce((sum, entry) => sum + entry.amount, 0) - capex);

		history.push(
			createMonthlyFinancialSnapshot({
				previousSnapshot,
				tick,
				cash: roundMoney(previousSnapshot.cash + monthDelta),
				revenue,
				opex,
				penalty,
				capex,
			}),
		);
	}

	const normalizedCurrentCash = roundMoney(state.player.cash);
	const lastSnapshot = history.at(-1)!;
	if (lastSnapshot.cash !== normalizedCurrentCash) {
		if (history.length === 1) {
			history[0] = {
				...lastSnapshot,
				cash: normalizedCurrentCash,
			};
		} else {
			const previousSnapshot = history.at(-2)!;
			history[history.length - 1] = {
				...lastSnapshot,
				cash: normalizedCurrentCash,
				netCashFlow: roundMoney(normalizedCurrentCash - previousSnapshot.cash),
			};
		}
	}

	return history;
}
