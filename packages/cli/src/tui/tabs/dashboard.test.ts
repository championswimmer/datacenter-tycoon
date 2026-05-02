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
