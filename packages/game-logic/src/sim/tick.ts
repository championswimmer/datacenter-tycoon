import { refreshContractMarket } from "../contracts/market.js";
import { tickOpex, tickRevenue } from "../economy/opex.js";
import type { Contract, DatacenterId, GameState, LedgerEntry, LedgerEntryType, Money, OpexTickResult, Tick } from "../types.js";

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

function getRegionForDatacenter(state: GameState, dcId: string) {
	const datacenter = state.datacenters.find((dc) => dc.id === dcId);
	if (!datacenter) return undefined;
	return state.map.regions.find((r) => r.id === datacenter.regionId);
}

export function tick(state: GameState): GameState {
	const nextTick = (state.tick + 1) as Tick;

	// Calculate base opex per datacenter
	const perDcOpex = new Map<DatacenterId, OpexTickResult>();
	let baseOpexTotal = 0;
	for (const datacenter of state.datacenters) {
		const region = getRegionForDatacenter(state, datacenter.id);
		if (!region) {
			throw new Error(`Region not found for datacenter: ${datacenter.regionId}`);
		}
		const opex = tickOpex(datacenter, region);
		perDcOpex.set(datacenter.id, opex);
		baseOpexTotal += opex.total;
	}

	const revenueResult = tickRevenue(state);

	// Calculate tax per datacenter
	let totalTax = 0;
	for (const datacenter of state.datacenters) {
		const region = getRegionForDatacenter(state, datacenter.id);
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
