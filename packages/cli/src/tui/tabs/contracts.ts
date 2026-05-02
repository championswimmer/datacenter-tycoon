import type { GameState } from "@datacenter-tycoon/game-logic";

export function renderContractsTab(snapshot: GameState): string[] {
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
	if (snapshot.activeContracts.length === 0) {
		lines.push("  No active contracts.");
	} else {
		lines.push(
			...snapshot.activeContracts.map(
				(contract) =>
					`  ${contract.id}  ${contract.name}  dc=${contract.assignedDcId ?? "-"}  $${contract.monthlyPayment}/mo  ${contract.status}`,
			),
		);
	}

	lines.push("", "Use :accept-contract <contractId> <dcId> or :cancel-contract <contractId>.");
	return lines;
}
