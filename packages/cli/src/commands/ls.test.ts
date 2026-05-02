import assert from "node:assert/strict";
import test from "node:test";

import { parseArgv } from "../argv.js";
import { formatListResult, runLsCommand } from "./ls.js";
import type { CommandClient } from "./common.js";

const datacenterList = {
	kind: "datacenters" as const,
	items: [
		{
			datacenter: { id: "dc-1", name: "Garage", spec: {} as never, placements: [], builtAtTick: 0 },
			capacity: { vCpu: 16, ramGb: 64, storageTb: 4, gpuFlops: 0 },
			powerKw: 10,
			powerCapacityKw: 20,
			heatOutputBtuPerHr: 1000,
			coolingCapacityBtuPerHr: 2000,
			bandwidthGbps: 2,
			bandwidthCapacityGbps: 10,
			slotsUsed: 1,
			totalSlots: 8,
		},
	],
};

test("formatListResult renders datacenter tables", () => {
	const rendered = formatListResult(datacenterList);
	assert.match(rendered, /dc-1/);
	assert.match(rendered, /Garage/);
	assert.match(rendered, /1\/8/);
});

test("runLsCommand prints list output for datacenters", async () => {
	const printed: string[] = [];
	const originalConsoleLog = console.log;
	console.log = (message?: unknown) => {
		printed.push(String(message));
	};
	const calls: string[] = [];
	const fakeClient: CommandClient = {
		connect: async () => {
			calls.push("connect");
		},
		query: async () => {
			calls.push("query");
			return datacenterList;
		},
		control: async () => ({ ok: true }),
		close: async () => {
			calls.push("close");
		},
	};

	try {
		await runLsCommand(parseArgv(["ls", "dc"]), () => fakeClient);
	} finally {
		console.log = originalConsoleLog;
	}

	assert.deepEqual(calls, ["connect", "query", "close"]);
	assert.match(printed[0] ?? "", /dc-1/);
});

test("runLsCommand prints JSON when requested", async () => {
	const printed: string[] = [];
	const originalConsoleLog = console.log;
	console.log = (message?: unknown) => {
		printed.push(String(message));
	};
	const fakeClient: CommandClient = {
		connect: async () => undefined,
		query: async () => datacenterList,
		control: async () => ({ ok: true }),
		close: async () => undefined,
	};

	try {
		await runLsCommand(parseArgv(["ls", "dc", "--json"]), () => fakeClient);
	} finally {
		console.log = originalConsoleLog;
	}

	assert.match(printed[0] ?? "", /"kind": "datacenters"/);
});
