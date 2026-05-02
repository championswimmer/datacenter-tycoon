import assert from "node:assert/strict";
import test from "node:test";

import type { Action } from "@datacenter-tycoon/game-logic";

import { parseArgv } from "../argv.js";
import type { CommandClient } from "./common.js";
import { runTickCommand } from "./tick.js";

function createFakeClient(actions: Action[], queried: string[]): CommandClient {
	return {
		connect: async () => undefined,
		dispatch: async (action) => {
			actions.push(action);
			return { tick: actions.length };
		},
		query: async () => {
			queried.push("status");
			return { tick: actions.length, paused: true, speedTps: 0, cash: 100, datacenterCount: 0, rackCount: 0, activeContractCount: 0, marketContractCount: 0 };
		},
		control: async () => ({ ok: true }),
		close: async () => undefined,
	};
}

test("runTickCommand dispatches Tick actions and queries status", async () => {
	const actions: Action[] = [];
	const queried: string[] = [];
	await runTickCommand(parseArgv(["tick", "3", "--quiet"]), () => createFakeClient(actions, queried));
	assert.deepEqual(actions, [{ type: "Tick" }, { type: "Tick" }, { type: "Tick" }]);
	assert.deepEqual(queried, ["status"]);
});
