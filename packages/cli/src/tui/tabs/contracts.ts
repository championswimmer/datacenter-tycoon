import { isLiveContractStatus } from "@datacenter-tycoon/game-logic";
import type { GameState } from "@datacenter-tycoon/game-logic";

export function renderContractsTab(snapshot: GameState): string[] {
	const liveContracts = snapshot.activeContracts.filter((c) => isLiveContractStatus(c.status));
	const historicalContracts = snapshot.activeContracts.filter((c) => !isLiveContractStatus(c.status));

	const lines = ["Contracts", "", "Market:"];
	if (snapshot.contractMarket.length === 0) {
		lines.push("  No market contracts available.");
	} else {
		lines.push(
			...snapshot.contractMarket.map(
				(contract) =>
					`  ${contract.id}  ${contract.name}  $${contract.monthlyPayment}/mo  ${contract.termMonths}m  ${contract.status}`,
			),
		);
	}

	lines.push("", "Active:");
	if (liveContracts.length === 0) {
		lines.push("  No active contracts.");
	} else {
		lines.push(
			...liveContracts.map(
				(contract) =>
					`  ${contract.id}  ${contract.name}  dc=${contract.assignedDcId ?? "-"}  $${contract.monthlyPayment}/mo  ${contract.status}`,
			),
		);
	}

	if (historicalContracts.length > 0) {
		lines.push("", "History:");
		lines.push(
			...historicalContracts.map(
				(contract) =>
					`  ${contract.id}  ${contract.name}  dc=${contract.assignedDcId ?? "-"}  ${contract.status.toUpperCase()}`,
			),
		);
	}

	lines.push("", "Use :contract accept <contractId> <dcId> or :contract cancel <contractId>.");
	return lines;
}
