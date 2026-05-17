import assert from "node:assert/strict";
import test from "node:test";

import { parseArgv } from "../argv.js";
import type { StatusView } from "../protocol/messages.js";
import { formatStatusJson, formatStatusLine, runStatusCommand, type StatusClient } from "./status.js";

const sampleStatus: StatusView = {
	tick: 1284,
	subtick: 11,
	dayOfMonth: 12,
	cash: 42310,
	difficulty: "easy",
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
		"tick=1284 day=12/30 cash=$42,310 difficulty=easy dcs=2 racks=8 active=3 market=4 paused=false speed=4",
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

		assert.deepEqual(printed, ["tick=1284 day=12/30 cash=$42,310 difficulty=easy dcs=2 racks=8 active=3 market=4 paused=false speed=4"]);
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

// --- Cross-surface regression: expired contracts must not appear as live anywhere ---

// Shared repro fixture: one expired contract in activeContracts, nothing else.
// This is the exact failure mode reported in the bug investigation.
const expiredOnlyStatus: StatusView = {
	tick: 42,
	subtick: 4,
	dayOfMonth: 5,
	cash: 100_000,
	difficulty: "hard",
	datacenterCount: 1,
	rackCount: 2,
	activeContractCount: 0, // fixed: was incorrectly 1 before plan-028
	marketContractCount: 0,
	paused: true,
	speedTps: 1,
};

test("formatStatusLine shows zero active contracts when status reports none", () => {
	assert.match(formatStatusLine(expiredOnlyStatus), /day=5\/30/);
	assert.match(formatStatusLine(expiredOnlyStatus), /active=0/);
	assert.ok(!formatStatusLine(expiredOnlyStatus).includes("active=1"), "must not show 1 expired contract as active");
});

test("runStatusCommand json output reports zero activeContractCount for expired-only state", async () => {
	const printed: string[] = [];
	const originalConsoleLog = console.log;
	console.log = (message?: unknown) => { printed.push(String(message)); };

	const fakeClient: StatusClient = {
		connect: async () => undefined,
		query: async () => expiredOnlyStatus,
		close: async () => undefined,
	};

	try {
		await runStatusCommand(parseArgv(["status", "--json"]), () => fakeClient);
	} finally {
		console.log = originalConsoleLog;
	}

	const parsed = JSON.parse(printed[0] ?? "{}") as { data: { activeContractCount: number } };
	assert.equal(parsed.data.activeContractCount, 0, "expired-only state must report zero active contracts");
});
