import { refreshContractMarket } from "../contracts/market.js";
import { tickOpex, tickRevenue } from "../economy/opex.js";
import type { Contract, GameState, LedgerEntry, LedgerEntryType, Money, Tick } from "../types.js";

function roundMoney(value: number): Money {
	return Math.round(value * 100) / 100;
}

function createLedgerEntry(
	state: GameState,
	tick: Tick,
	type: LedgerEntryType,
	amount: Money,
	reason: string,
	offset: number,
): LedgerEntry {
	return {
		id: `ledger-${tick}-${state.ledger.length + offset}` as LedgerEntry["id"],
		tick,
		type,
		amount,
		reason,
	};
}

function finalizeContract(contract: Contract, tick: Tick): Contract {
	if ((contract.status !== "active" && contract.status !== "breached") || contract.startedAtTick === undefined) {
		return contract;
	}

	const hasTermEnded = tick >= contract.startedAtTick + contract.termMonths;
	if (!hasTermEnded) {
		return contract;
	}

	return {
		...contract,
		status: contract.status === "active" ? "completed" : "cancelled",
	};
}

export function tick(state: GameState): GameState {
	const nextTick = (state.tick + 1) as Tick;
	const totalOpex = roundMoney(
		state.datacenters.reduce((total, datacenter) => total + tickOpex(datacenter).total, 0),
	);
	const revenueResult = tickRevenue(state);

	const autoCancelledContracts = revenueResult.updatedContracts.map((contract): Contract => {
		if (contract.status === "breached" && state.activeContracts.some(
			(prev) => prev.id === contract.id && prev.status === "breached",
		)) {
			return { ...contract, status: "cancelled" };
		}
		return contract;
	});

	const finalizedContracts = autoCancelledContracts.map((contract) => finalizeContract(contract, nextTick));
	const netCashDelta = roundMoney(revenueResult.revenue - totalOpex);
	const ledgerEntries: LedgerEntry[] = [];

	if (totalOpex !== 0) {
		ledgerEntries.push(
			createLedgerEntry(state, nextTick, "opex", -totalOpex, "Monthly datacenter operating costs", 0),
		);
	}

	if (revenueResult.revenue > 0) {
		ledgerEntries.push(
			createLedgerEntry(
				state,
				nextTick,
				"revenue",
				revenueResult.revenue,
				"Contract revenue for fulfilled workloads",
				ledgerEntries.length,
			),
		);
	} else if (revenueResult.revenue < 0) {
		ledgerEntries.push(
			createLedgerEntry(
				state,
				nextTick,
				"penalty",
				revenueResult.revenue,
				"Contract penalties for breached workloads",
				ledgerEntries.length,
			),
		);
	}

	const advancedState: GameState = {
		...state,
		tick: nextTick,
		player: {
			...state.player,
			cash: roundMoney(state.player.cash + netCashDelta),
		},
		activeContracts: finalizedContracts,
		ledger: [...state.ledger, ...ledgerEntries],
	};

	return refreshContractMarket(advancedState);
}
