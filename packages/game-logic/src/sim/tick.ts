import { updatePlayerReliability } from "../contracts/reliability.js";
import {
	CONTRACT_BREACH_AUTO_CANCEL_MONTHS,
	isLiveContract,
	withDerivedContractViews,
} from "../contracts/lifecycle.js";
import { refreshContractMarket } from "../contracts/market.js";
import { tickOpex, tickRevenue } from "../economy/opex.js";
import { createIndexedGameStateView } from "../state/indexed-view.js";
import { advanceSubtick } from "./subtick.js";
import type {
	Contract,
	DatacenterId,
	GameState,
	LedgerEntry,
	LedgerEntryType,
	Money,
	OpexTickResult,
	Tick,
} from "../types.js";

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
	if (!isLiveContract(contract) || contract.startedAtTick === undefined) {
		return contract;
	}

	if (contract.lifecycleState === "breached" && (contract.breachStreakMonths ?? 0) >= CONTRACT_BREACH_AUTO_CANCEL_MONTHS) {
		return {
			...contract,
			lifecycleState: "cancelled",
			status: "cancelled",
			closedAtTick: tick,
		};
	}

	const hasTermEnded = tick >= contract.startedAtTick + contract.termMonths;
	if (!hasTermEnded) {
		return contract;
	}

	return {
		...contract,
		lifecycleState: "completed",
		status: "expired",
		breachStreakMonths: 0,
		closedAtTick: tick,
	};
}

function getRegionForDatacenter(state: GameState, dcId: string) {
	const datacenter = state.datacenters.find((dc) => dc.id === dcId);
	if (!datacenter) return undefined;
	return state.map.regions.find((r) => r.id === datacenter.regionId);
}

export function settleMonthlyTick(state: GameState): GameState {
	const nextTick = (state.tick + 1) as Tick;
	const maintenanceView = createIndexedGameStateView(state);
	const maintenanceState: GameState = {
		...state,
		tick: nextTick,
		subtick: 0,
		contracts: [...maintenanceView.contracts],
	};

	// Calculate base opex per datacenter
	const perDcOpex = new Map<DatacenterId, OpexTickResult>();
	let baseOpexTotal = 0;
	for (const datacenter of maintenanceState.datacenters) {
		const region = getRegionForDatacenter(maintenanceState, datacenter.id);
		if (!region) {
			throw new Error(`Region not found for datacenter: ${datacenter.regionId}`);
		}
		const opex = tickOpex(datacenter, region, maintenanceView.liveContracts);
		perDcOpex.set(datacenter.id, opex);
		baseOpexTotal += opex.total;
	}

	const revenueResult = tickRevenue(maintenanceState, maintenanceView.contracts);

	// Calculate tax per datacenter
	let totalTax = 0;
	for (const datacenter of maintenanceState.datacenters) {
		const region = getRegionForDatacenter(maintenanceState, datacenter.id);
		if (!region) continue;

		const opex = perDcOpex.get(datacenter.id)!;
		const dcRevenue = revenueResult.perDcRevenue[datacenter.id] ?? 0;
		const profit = Math.max(0, dcRevenue - opex.total);
		const tax = roundMoney(profit * region.taxRate);
		totalTax += tax;

		// Mutate the breakdown to include tax for this tick
		(opex.breakdown as { tax: Money }).tax = tax;
	}

	const totalOpex = roundMoney(baseOpexTotal + totalTax);

	const finalizedContracts = revenueResult.updatedContracts.map((contract) => finalizeContract(contract, nextTick));
	const nextReliability = updatePlayerReliability(state.player.reliability, revenueResult.outcomes);
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
				"Contract revenue for SLA-compliant months",
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
				"Contract penalties for missed SLA months",
				ledgerEntries.length,
			),
		);
	}

	const advancedState: GameState = {
		...maintenanceState,
		player: {
			...maintenanceState.player,
			cash: roundMoney(state.player.cash + netCashDelta),
			reliability: nextReliability,
		},
		contracts: finalizedContracts,
		ledger: [...state.ledger, ...ledgerEntries],
	};

	return refreshContractMarket(withDerivedContractViews(advancedState));
}

export function tick(state: GameState): GameState {
	const targetTick = state.tick + 1;
	let nextState = state;
	while (nextState.tick < targetTick) {
		nextState = advanceSubtick(nextState);
	}

	return nextState;
}
