import type { GameState } from "@datacenter-tycoon/game-logic";

export function renderDashboardTab(snapshot: GameState): string[] {
	const ledgerTail = snapshot.ledger.slice(-10).map((entry) => `  ${entry.tick.toString().padStart(4)}  ${entry.type.padEnd(10)}  ${entry.amount.toString().padStart(8)}  ${entry.reason}`);
	const headline = [
		`Cash: $${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(snapshot.player.cash)}`,
		`Datacenters: ${snapshot.datacenters.length}`,
		`Active contracts: ${snapshot.activeContracts.length}`,
		`Market contracts: ${snapshot.contractMarket.length}`,
	];

	const alerts: string[] = [];
	if (snapshot.player.cash < 0) {
		alerts.push("Alert: cash is negative.");
	}
	if (snapshot.activeContracts.some((contract) => contract.status === "breached")) {
		alerts.push("Alert: one or more contracts are breached.");
	}
	if (alerts.length === 0) {
		alerts.push("Alerts: none");
	}

	return [
		"Dashboard",
		"",
		...headline,
		"",
		...alerts,
		"",
		"Ledger tail:",
		...(ledgerTail.length > 0 ? ledgerTail : ["  No ledger entries yet."]),
	];
}
