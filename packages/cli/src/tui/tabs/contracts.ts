import {
	selectHistoricalContractsFromState,
	selectLiveContractsFromState,
	selectOpenMarketContractsFromState,
} from "@datacenter-tycoon/game-logic";
import type { GameState } from "@datacenter-tycoon/game-logic";

import { formatContractRegionAffinity, presentContract } from "../../commands/contracts-view.js";

function renderContractLine(
	contract: ReturnType<typeof presentContract>,
	prefix: "market" | "active" | "history",
): string[] {
	if (prefix === "market") {
		return [
			`  ${contract.id}  ${contract.name}  $${contract.monthlyPayment}/mo  ${contract.termMonths}m  ${contract.status}`,
			`      Regions: ${formatContractRegionAffinity(contract)}`,
		];
	}

	if (prefix === "active") {
		return [
			`  ${contract.id}  ${contract.name}  dc=${contract.assignedDcId ?? "-"}  $${contract.monthlyPayment}/mo  ${contract.status}`,
			`      Regions: ${formatContractRegionAffinity(contract)}`,
		];
	}

	return [
		`  ${contract.id}  ${contract.name}  dc=${contract.assignedDcId ?? "-"}  ${contract.status.toUpperCase()}`,
		`      Regions: ${formatContractRegionAffinity(contract)}`,
	];
}

export function renderContractsTab(snapshot: GameState): string[] {
	const marketContracts = selectOpenMarketContractsFromState(snapshot).map((contract) => presentContract(contract, "market"));
	const liveContracts = selectLiveContractsFromState(snapshot).map((contract) => presentContract(contract, "active"));
	const historicalContracts = selectHistoricalContractsFromState(snapshot).map((contract) => presentContract(contract, "history"));

	const lines = ["Contracts", "", "Market:"];
	if (marketContracts.length === 0) {
		lines.push("  No market contracts available.");
	} else {
		lines.push(...marketContracts.flatMap((contract) => renderContractLine(contract, "market")));
	}

	lines.push("", "Active:");
	if (liveContracts.length === 0) {
		lines.push("  No active contracts.");
	} else {
		lines.push(...liveContracts.flatMap((contract) => renderContractLine(contract, "active")));
	}

	if (historicalContracts.length > 0) {
		lines.push("", "History:");
		lines.push(...historicalContracts.flatMap((contract) => renderContractLine(contract, "history")));
	}

	lines.push("", "Use :contract accept <contractId> <dcId> for eligible regions only, or :contract cancel <contractId>.");
	return lines;
}
