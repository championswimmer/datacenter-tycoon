import assert from "node:assert/strict";
import test from "node:test";

import type { Action } from "@datacenter-tycoon/game-logic";

import { parseArgv } from "../argv.js";
import type { CommandClient } from "./common.js";
import { runAcceptContractCommand, runCancelContractCommand } from "./contracts.js";

function createFakeClient(actions: Action[]): CommandClient {
	return {
		connect: async () => undefined,
		dispatch: async (action) => {
			actions.push(action);
			return { tick: 0 };
		},
		query: async () => ({ tick: 0 }),
		control: async () => ({ ok: true }),
		close: async () => undefined,
	};
}

test("runAcceptContractCommand dispatches AcceptContract", async () => {
	const actions: Action[] = [];
	await runAcceptContractCommand(parseArgv(["accept-contract", "offer-1", "dc-1", "--quiet"]), () => createFakeClient(actions));

	assert.deepEqual(actions, [{ type: "AcceptContract", contractId: "offer-1", dcId: "dc-1" }]);
});

test("runCancelContractCommand dispatches CancelContract", async () => {
	const actions: Action[] = [];
	await runCancelContractCommand(parseArgv(["cancel-contract", "offer-1", "--quiet"]), () => createFakeClient(actions));

	assert.deepEqual(actions, [{ type: "CancelContract", contractId: "offer-1" }]);
});
