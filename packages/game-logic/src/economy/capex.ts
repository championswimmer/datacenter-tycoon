import type { GameState, LedgerEntry, LedgerEntryId, Money } from "../types.js";

const ledgerEntryId = (value: string): LedgerEntryId => value as LedgerEntryId;

function createLedgerEntry(state: GameState, amount: Money, reason: string): LedgerEntry {
	return {
		id: ledgerEntryId(`ledger-${state.tick}-${state.ledger.length}`),
		tick: state.tick,
		type: "capex",
		amount,
		reason,
	};
}

export function applyCapex(state: GameState, amount: Money, reason: string): GameState {
	if (amount < 0) {
		throw new Error("Capex amount must be non-negative.");
	}

	if (state.player.cash < amount) {
		throw new Error(`Insufficient funds for capex: required ${amount}, available ${state.player.cash}.`);
	}

	return {
		...state,
		player: {
			...state.player,
			cash: state.player.cash - amount,
		},
		ledger: [...state.ledger, createLedgerEntry(state, -amount, reason)],
	};
}
