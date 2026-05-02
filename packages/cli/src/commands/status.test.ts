import assert from "node:assert/strict";
import test from "node:test";

import { parseArgv } from "../argv.js";
import type { StatusView } from "../protocol/messages.js";
import { formatStatusJson, formatStatusLine, runStatusCommand, type StatusClient } from "./status.js";

const sampleStatus: StatusView = {
	tick: 1284,
	cash: 42310,
	datacenterCount: 2,
	rackCount: 8,
	activeContractCount: 3,
	marketContractCount: 4,
	paused: false,
	speedTps: 4,
};

test("formatStatusLine renders the expected status summary", () => {
	assert.equal(
		formatStatusLine(sampleStatus),
		"tick=1284 cash=$42,310 dcs=2 racks=8 active=3 market=4 paused=false speed=4",
	);
});

test("formatStatusJson renders machine-readable output", () => {
	assert.equal(
		formatStatusJson(sampleStatus),
		JSON.stringify(
			{
				ok: true,
				data: sampleStatus,
			},
			null,
			2,
		),
	);
});

test("runStatusCommand prints text output and closes the client", async () => {
		const printed: string[] = [];
		const originalConsoleLog = console.log;
		let closed = false;
		console.log = (message?: unknown) => {
			printed.push(String(message));
		};

		const fakeClient: StatusClient = {
			connect: async () => undefined,
			query: async () => sampleStatus,
			close: async () => {
				closed = true;
			},
		};

		try {
			await runStatusCommand(parseArgv(["status"]), () => fakeClient);
		} finally {
			console.log = originalConsoleLog;
		}

		assert.deepEqual(printed, ["tick=1284 cash=$42,310 dcs=2 racks=8 active=3 market=4 paused=false speed=4"]);
		assert.equal(closed, true);
});

test("runStatusCommand prints json output when --json is set", async () => {
		const printed: string[] = [];
		const originalConsoleLog = console.log;
		console.log = (message?: unknown) => {
			printed.push(String(message));
		};

		const fakeClient: StatusClient = {
			connect: async () => undefined,
			query: async () => sampleStatus,
			close: async () => undefined,
		};

		try {
			await runStatusCommand(parseArgv(["status", "--json"]), () => fakeClient);
		} finally {
			console.log = originalConsoleLog;
		}

		assert.deepEqual(printed, [formatStatusJson(sampleStatus)]);
});
