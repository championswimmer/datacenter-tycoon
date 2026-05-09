import assert from "node:assert/strict";
import test from "node:test";

import { newGame } from "@datacenter-tycoon/game-logic";

import { formatContractRequirements, presentContract, presentContracts } from "./contracts-view.js";

test("presentContract normalizes nullable contract fields and preserves monthlyPayment", () => {
	const contract = newGame(7).contractMarket[0]!;
	const view = presentContract(contract, "market");

	assert.equal(view.bucket, "market");
	assert.equal(view.monthlyPayment, contract.monthlyPayment);
	assert.equal(view.penaltyPerMonth, contract.penaltyPerMonth);
	assert.equal(view.startedAtTick, null);
	assert.equal(view.assignedDcId, null);
	assert.equal(view.expiresAtTick, contract.expiresAtTick);
	assert.equal(formatContractRequirements(view), formatContractRequirements({ requirements: contract.requirements }));
});

test("presentContracts applies the same DTO schema to each contract", () => {
	const snapshot = newGame(7);
	const views = presentContracts(snapshot.contractMarket.slice(0, 2), "market");

	assert.equal(views.length, 2);
	assert.deepEqual(Object.keys(views[0] ?? {}), Object.keys(views[1] ?? {}));
	assert.ok(views.every((view) => view.bucket === "market"));
});
