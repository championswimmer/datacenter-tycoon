import assert from "node:assert/strict";
import test from "node:test";

import { REGION_CATALOG, newGame } from "@datacenter-tycoon/game-logic";

import { renderContractsTab } from "./contracts.js";

test("renderContractsTab shows market and active contracts", () => {
	const snapshot = {
		...newGame(1),
		contracts: [
			{
				id: "active-1" as never,
				name: "Active 1",
				requirements: { vCpu: 1, ramGb: 1, storageTb: 1, gpuFlops: 0 },
				monthlyPayment: 700,
				penaltyPerMonth: 100,
				termMonths: 6,
				lifecycleState: "serving",
				status: "active",
				urgency: "standard",
				tier: 1,
				offeredAtTick: 0,
				expiresAtTick: 10,
				assignedDcId: "dc-1" as never,
				startedAtTick: 1,
			},
			{
				id: "offer-1" as never,
				name: "Offer 1",
				requirements: { vCpu: 1, ramGb: 1, storageTb: 1, gpuFlops: 0 },
				monthlyPayment: 500,
				penaltyPerMonth: 100,
				termMonths: 3,
				lifecycleState: "market_open",
				status: "offered",
				urgency: "standard",
				tier: 1,
				offeredAtTick: 0,
				expiresAtTick: 10,
			},
		],
		contractMarket: [],
		activeContracts: [],
	};

	const rendered = renderContractsTab(snapshot).join("\n");
	assert.match(rendered, /Market:/);
	assert.match(rendered, /offer-1/);
	assert.match(rendered, /Regions: Any region/);
	assert.match(rendered, /Active:/);
	assert.match(rendered, /active-1/);
	assert.match(rendered, /dc=dc-1/);
});

test("renderContractsTab shows region affinity hints and eligible-region copy", () => {
	const base = newGame(11);
	const contract = base.contractMarket[0]!;
	const snapshot = {
		...base,
		contracts: [
			{
				...contract,
				id: "offer-eu" as typeof contract.id,
				regionAffinity: {
					key: "eu" as const,
					allowedRegionIds: [REGION_CATALOG.eu_west.id, REGION_CATALOG.eu_central.id],
				},
			},
		],
		contractMarket: [],
		activeContracts: [],
	};

	const rendered = renderContractsTab(snapshot).join("\n");
	assert.match(rendered, /Regions: EU only/);
	assert.match(rendered, /DUB · Dublin · EU West/);
	assert.match(rendered, /eligible regions only/);
});

test("renderContractsTab places expired contracts in History section, not Active", () => {
	const base = newGame(11);
	const contract = base.contractMarket[0]!;
	const snapshot = {
		...base,
		contracts: [
			{
				...contract,
				id: "c-live" as typeof contract.id,
				status: "active" as const,
				startedAtTick: 1,
				assignedDcId: "dc-1" as typeof contract.assignedDcId,
			},
			{
				...contract,
				id: "c-expired" as typeof contract.id,
				status: "expired" as const,
				startedAtTick: 1,
				assignedDcId: "dc-1" as typeof contract.assignedDcId,
			},
			{
				...contract,
				id: "c-cancelled" as typeof contract.id,
				status: "cancelled" as const,
				startedAtTick: 1,
				assignedDcId: "dc-2" as typeof contract.assignedDcId,
			},
		],
		contractMarket: [],
		activeContracts: [],
	};

	const rendered = renderContractsTab(snapshot).join("\n");
	assert.match(rendered, /Active:/);
	assert.match(rendered, /c-live/);
	assert.match(rendered, /History:/);
	assert.match(rendered, /c-expired/);
	assert.match(rendered, /c-cancelled/);
	const activeIdx = rendered.indexOf("Active:");
	const historyIdx = rendered.indexOf("History:");
	const expiredIdx = rendered.indexOf("c-expired");
	const cancelledIdx = rendered.indexOf("c-cancelled");
	assert.ok(historyIdx > activeIdx, "History section must come after Active section");
	assert.ok(expiredIdx > historyIdx, "expired contract must appear after History heading");
	assert.ok(cancelledIdx > historyIdx, "cancelled contract must appear after History heading");
});

test("renderContractsTab shows no active contracts when all accepted contracts are historical", () => {
	const base = newGame(11);
	const contract = base.contractMarket[0]!;
	const snapshot = {
		...base,
		contracts: [
			{
				...contract,
				id: "c-expired" as typeof contract.id,
				status: "expired" as const,
				startedAtTick: 1,
				assignedDcId: "dc-1" as typeof contract.assignedDcId,
			},
		],
		contractMarket: [],
		activeContracts: [],
	};

	const rendered = renderContractsTab(snapshot).join("\n");
	assert.match(rendered, /No active contracts\./);
	assert.match(rendered, /History:/);
	assert.match(rendered, /c-expired/);
});
