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
			return {
				tick: actions.length,
				subtick: 0,
				dayOfMonth: 1,
				paused: true,
				speedTps: 0,
				cash: 100,
				datacenterCount: 0,
				rackCount: 0,
				activeContractCount: 0,
				marketContractCount: 0,
			};
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

test("runTickCommand keeps month-based wording for compatibility", async () => {
	const actions: Action[] = [];
	const queried: string[] = [];
	const printed: string[] = [];
	const originalLog = console.log;
	console.log = (message?: unknown) => {
		printed.push(String(message ?? ""));
	};

	try {
		await runTickCommand(parseArgv(["tick", "2"]), () => createFakeClient(actions, queried));
	} finally {
		console.log = originalLog;
	}

	assert.deepEqual(actions, [{ type: "Tick" }, { type: "Tick" }]);
	assert.match(printed[0] ?? "", /Advanced 2 months to tick 2/);
});
