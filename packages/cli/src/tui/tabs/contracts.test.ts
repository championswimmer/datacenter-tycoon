import assert from "node:assert/strict";
import test from "node:test";

import { newGame } from "@datacenter-tycoon/game-logic";

import { renderContractsTab } from "./contracts.js";

test("renderContractsTab shows market and active contracts", () => {
	const snapshot = {
		...newGame(1),
		contractMarket: [
			{
				id: "offer-1" as never,
				name: "Offer 1",
				requirements: { vCpu: 1, ramGb: 1, storageTb: 1, gpuFlops: 0 },
				monthlyPayment: 500,
				penaltyPerMonth: 100,
				termMonths: 3,
				status: "offered",
				urgency: "standard",
				tier: 1,
				offeredAtTick: 0,
				expiresAtTick: 10,
			},
		],
		activeContracts: [
			{
				id: "active-1" as never,
				name: "Active 1",
				requirements: { vCpu: 1, ramGb: 1, storageTb: 1, gpuFlops: 0 },
				monthlyPayment: 700,
				penaltyPerMonth: 100,
				termMonths: 6,
				status: "active",
				urgency: "standard",
				tier: 1,
				offeredAtTick: 0,
				expiresAtTick: 10,
				assignedDcId: "dc-1" as never,
				startedAtTick: 1,
			},
		],
	};

	const rendered = renderContractsTab(snapshot).join("\n");
	assert.match(rendered, /Market:/);
	assert.match(rendered, /offer-1/);
	assert.match(rendered, /Active:/);
	assert.match(rendered, /active-1/);
	assert.match(rendered, /dc=dc-1/);
});
