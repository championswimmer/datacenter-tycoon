import assert from "node:assert/strict";
import test from "node:test";

import { newGame } from "@datacenter-tycoon/game-logic";

import { REGION_CATALOG } from "@datacenter-tycoon/game-logic";

import {
	formatContractRegionAffinity,
	formatContractRequirements,
	presentAcceptedContract,
	presentContract,
	presentContractBuckets,
	presentContracts,
} from "./contracts-view.js";

test("presentContract normalizes nullable contract fields and preserves monthlyPayment", () => {
	const contract = newGame(7).contractMarket[0]!;
	const view = presentContract(contract, "market");

	assert.equal(view.bucket, "market");
	assert.equal(view.monthlyPayment, contract.monthlyPayment);
	assert.equal(view.penaltyPerMonth, contract.penaltyPerMonth);
	assert.equal(view.startedAtTick, null);
	assert.equal(view.assignedDcId, null);
	assert.equal(view.regionAffinity, undefined);
	assert.equal(view.expiresAtTick, contract.expiresAtTick);
	assert.equal(formatContractRequirements(view), formatContractRequirements({ requirements: contract.requirements }));
	assert.equal(formatContractRegionAffinity(view), "Any region");
});

test("presentContracts applies the same DTO schema to each contract", () => {
	const snapshot = newGame(7);
	const views = presentContracts(snapshot.contractMarket.slice(0, 2), "market");

	assert.equal(views.length, 2);
	assert.deepEqual(Object.keys(views[0] ?? {}), Object.keys(views[1] ?? {}));
	assert.ok(views.every((view) => view.bucket === "market"));
});

test("presentContract preserves assignedDcId for active contracts", () => {
	const contract = {
		...newGame(7).contractMarket[0]!,
		status: "active" as const,
		startedAtTick: 2,
		assignedDcId: "dc-1" as const,
	};
	const view = presentContract(contract, "active");

	assert.equal(view.bucket, "active");
	assert.equal(view.assignedDcId, "dc-1");
	assert.equal(view.startedAtTick, 2);
});


test("presentContract exposes region affinity labels and allowed regions when present", () => {
	const contract = {
		...newGame(7).contractMarket[0]!,
		regionAffinity: {
			key: "eu" as const,
			allowedRegionIds: [REGION_CATALOG.eu_west.id, REGION_CATALOG.eu_central.id],
		},
	};
	const view = presentContract(contract, "market");

	assert.deepEqual(view.regionAffinity, {
		key: "eu",
		label: "EU only",
		allowedRegionIds: [REGION_CATALOG.eu_west.id, REGION_CATALOG.eu_central.id],
		allowedRegions: [
			`${REGION_CATALOG.eu_west.code} · ${REGION_CATALOG.eu_west.city} · ${REGION_CATALOG.eu_west.name}`,
			`${REGION_CATALOG.eu_central.code} · ${REGION_CATALOG.eu_central.city} · ${REGION_CATALOG.eu_central.name}`,
		],
	});
	assert.match(formatContractRegionAffinity(view), /^EU only \(/);
});

test("presentContract preserves expired status without remapping", () => {
	const contract = {
		...newGame(7).contractMarket[0]!,
		status: "expired" as const,
		startedAtTick: 1,
	};
	const view = presentContract(contract, "active");

	assert.equal(view.status, "expired");
	assert.equal(view.startedAtTick, 1);
});

test("presentAcceptedContract puts active contract in active bucket", () => {
	const contract = {
		...newGame(7).contractMarket[0]!,
		status: "active" as const,
		startedAtTick: 1,
		assignedDcId: "dc-1" as const,
	};
	const view = presentAcceptedContract(contract);
	assert.equal(view.bucket, "active");
});

test("presentAcceptedContract puts breached contract in active bucket", () => {
	const contract = {
		...newGame(7).contractMarket[0]!,
		status: "breached" as const,
		startedAtTick: 1,
		assignedDcId: "dc-1" as const,
	};
	const view = presentAcceptedContract(contract);
	assert.equal(view.bucket, "active");
});

test("presentAcceptedContract puts expired contract in history bucket", () => {
	const contract = {
		...newGame(7).contractMarket[0]!,
		status: "expired" as const,
		startedAtTick: 1,
		assignedDcId: "dc-1" as const,
	};
	const view = presentAcceptedContract(contract);
	assert.equal(view.bucket, "history");
});

test("presentAcceptedContract puts cancelled contract in history bucket", () => {
	const contract = {
		...newGame(7).contractMarket[0]!,
		status: "cancelled" as const,
		startedAtTick: 1,
		assignedDcId: "dc-1" as const,
	};
	const view = presentAcceptedContract(contract);
	assert.equal(view.bucket, "history");
});

test("presentContractBuckets splits live and historical accepted contracts from canonical state", () => {
	const base = newGame(7).contractMarket[0]!;
	const activeContract = { ...base, id: "c-active" as typeof base.id, status: "active" as const, startedAtTick: 1, assignedDcId: "dc-1" as const };
	const expiredContract = { ...base, id: "c-expired" as typeof base.id, status: "expired" as const, startedAtTick: 1, assignedDcId: "dc-1" as const };
	const cancelledContract = { ...base, id: "c-cancelled" as typeof base.id, status: "cancelled" as const, startedAtTick: 1, assignedDcId: "dc-1" as const };

	const snapshot = {
		contracts: [activeContract, expiredContract, cancelledContract, ...newGame(7).contractMarket],
		contractMarket: [],
		activeContracts: [],
	};
	const buckets = presentContractBuckets(snapshot);

	assert.equal(buckets.active.length, 1);
	assert.equal(buckets.active[0]!.id, "c-active");
	assert.equal(buckets.history.length, 2);
	assert.ok(buckets.history.every((contract) => contract.bucket === "history"));
	assert.ok(buckets.market.length >= 1);
});

test("presentContractBuckets returns empty history when all accepted contracts are live", () => {
	const base = newGame(7).contractMarket[0]!;
	const activeContract = { ...base, id: "c-live" as typeof base.id, status: "active" as const, startedAtTick: 1, assignedDcId: "dc-1" as const };

	const snapshot = {
		contracts: [activeContract],
		contractMarket: [],
		activeContracts: [],
	};
	const buckets = presentContractBuckets(snapshot);

	assert.equal(buckets.active.length, 1);
	assert.equal(buckets.history.length, 0);
});
