import assert from "node:assert/strict";
import test from "node:test";

import { newGame } from "@datacenter-tycoon/game-logic";

import { renderDashboardTab } from "./dashboard.js";

test("renderDashboardTab shows KPIs and ledger tail", () => {
	const snapshot = {
		...newGame(1),
		player: { id: "player-1" as never, name: "Player", cash: 42000 },
		ledger: [{ id: "l-1" as never, tick: 2, type: "revenue", amount: 5000, reason: "Contract payout" }],
	};

	const lines = renderDashboardTab(snapshot);
	assert.match(lines.join("\n"), /Cash: \$42,000/);
	assert.match(lines.join("\n"), /Ledger tail/);
	assert.match(lines.join("\n"), /Contract payout/);
});

test("renderDashboardTab active contracts KPI counts only live contracts", () => {
	const base = newGame(11);
	const contract = base.contractMarket[0]!;
	const snapshot = {
		...base,
		activeContracts: [
			{ ...contract, id: "c-active" as typeof contract.id, status: "active" as const, startedAtTick: 1, assignedDcId: "dc-1" as typeof contract.assignedDcId },
			{ ...contract, id: "c-expired" as typeof contract.id, status: "expired" as const, startedAtTick: 1, assignedDcId: "dc-1" as typeof contract.assignedDcId },
			{ ...contract, id: "c-cancelled" as typeof contract.id, status: "cancelled" as const, startedAtTick: 1, assignedDcId: "dc-1" as typeof contract.assignedDcId },
		],
	};

	const lines = renderDashboardTab(snapshot).join("\n");
	// Only 1 live contract (c-active); expired and cancelled must not count.
	assert.match(lines, /Active contracts: 1/);
});
