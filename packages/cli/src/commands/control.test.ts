import assert from "node:assert/strict";
import test from "node:test";

import { parseArgv } from "../argv.js";
import type { CommandClient } from "./common.js";
import { runPauseCommand, runResumeCommand, runSpeedCommand } from "./control.js";

function createFakeClient(log: string[]): CommandClient {
	return {
		connect: async () => {
			log.push("connect");
		},
		dispatch: async () => ({ tick: 0 }),
		query: async () => {
			log.push("query:status");
			return { tick: 3, paused: false, speedTps: 4, cash: 100, datacenterCount: 1, rackCount: 1, activeContractCount: 0, marketContractCount: 2 };
		},
		control: async (params) => {
			log.push(`control:${params.op}${"ticksPerSecond" in params ? `:${params.ticksPerSecond}` : ""}`);
			return { ok: true };
		},
		close: async () => {
			log.push("close");
		},
	};
}

test("runPauseCommand sends pause and queries status", async () => {
	const log: string[] = [];
	await runPauseCommand(parseArgv(["pause", "--quiet"]), () => createFakeClient(log));
	assert.deepEqual(log, ["connect", "control:pause", "query:status", "close"]);
});

test("runResumeCommand sends resume and queries status", async () => {
	const log: string[] = [];
	await runResumeCommand(parseArgv(["resume", "--quiet"]), () => createFakeClient(log));
	assert.deepEqual(log, ["connect", "control:resume", "query:status", "close"]);
});

test("runSpeedCommand sends set-speed and validates input", async () => {
	const log: string[] = [];
	await runSpeedCommand(parseArgv(["speed", "8", "--quiet"]), () => createFakeClient(log));
	assert.deepEqual(log, ["connect", "control:set-speed:8", "query:status", "close"]);
	await assert.rejects(() => runSpeedCommand(parseArgv(["speed"])), /Usage: dct speed/);
});
