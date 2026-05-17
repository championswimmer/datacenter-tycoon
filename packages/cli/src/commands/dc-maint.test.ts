import assert from "node:assert/strict";
import test from "node:test";

import {
	DATACENTER_CATALOG,
	RACK_CATALOG,
	newGame,
	type Action,
	type DatacenterId,
	type GameState,
	type RackPlacementId,
} from "@datacenter-tycoon/game-logic";

import { runDcMaintCommand } from "./dc-maint.js";
import type { CommandClient } from "./common.js";

function argv(positionals: string[], flags: Record<string, string | boolean> = {}): import("../argv.js").ParsedArgv {
	return { command: undefined, positionals, flags, rawArgs: [] };
}

const datacenterId = (value: string): DatacenterId => value as DatacenterId;
const rackPlacementId = (value: string): RackPlacementId => value as RackPlacementId;

function buildSnapshot(currentStaff: number, options: { repairingRack?: boolean } = {}): GameState {
	const base = newGame(42);
	const region = base.map.regions[0]!;
	return {
		...base,
		datacenters: [
			{
				id: datacenterId("dc-1"),
				name: "Test DC",
				spec: DATACENTER_CATALOG.garage,
				placements: [
					{
						id: rackPlacementId("rp-1"),
						specId: RACK_CATALOG.C1.id,
						kind: RACK_CATALOG.C1.kind,
						installedAtTick: 0,
						health: options.repairingRack ? "repairing" : "healthy",
						...(options.repairingRack
							? {
								repairProgressDays: 3,
								lastFailureAtTick: 0 as GameState["tick"],
								lastFailureAtSubtick: 0,
							}
							: {}),
						row: 0,
						position: 0,
					},
				],
				builtAtTick: 0,
				regionId: region.id,
				maintenanceStaff: currentStaff,
			},
		],
	};
}

function makeMaintClient(
	dcId: string,
	initialStaff: number,
	options: { repairingRack?: boolean } = {},
): { client: CommandClient; dispatched: Action[] } {
	let currentStaff = initialStaff;
	const dispatched: Action[] = [];

	const client: CommandClient = {
		connect: async () => undefined,
		dispatch: async (action: Action) => {
			dispatched.push(action);
			if (action.type === "SetMaintenanceStaff" && action.dcId === dcId) {
				currentStaff = action.maintenanceStaff;
			}
			return { tick: 0 };
		},
		query: async (params) => {
			if (params.kind === "snapshot") {
				return buildSnapshot(currentStaff, options);
			}
			throw new Error(`Unexpected query: ${JSON.stringify(params)}`);
		},
		control: async () => ({ ok: true }),
		close: async () => undefined,
	};

	return { client, dispatched };
}

function captureLog(): { logged: string[]; restore: () => void } {
	const logged: string[] = [];
	const orig = console.log;
	console.log = (msg?: unknown) => {
		logged.push(String(msg ?? ""));
	};
	return { logged, restore: () => { console.log = orig; } };
}

test("dct dc maint <dcId> shows maintenance staffing detail", async () => {
	const { client } = makeMaintClient("dc-1", 3, { repairingRack: true });
	const { logged, restore } = captureLog();

	try {
		await runDcMaintCommand(argv(["dc-1"]), () => client);
	} finally {
		restore();
	}

	const output = logged.join("\n");
	assert.match(output, /Maintenance staffing: dc-1/, "should show dc id");
	assert.match(output, /Current staff\s*:\s*3/, "should show current staff");
	assert.match(output, /Repair speed\s*:\s*[\d.]+ repair-days\/day/, "should show day-level repair speed");
	assert.match(output, /Rack maintenance:/, "should show rack detail section");
	assert.match(output, /rp-1: \d+% repaired \| ETA \d+ day/, "should show per-rack ETA");
});

test("dct dc maint <dcId> --json returns structured data", async () => {
	const { client } = makeMaintClient("dc-1", 2, { repairingRack: true });
	const { logged, restore } = captureLog();

	try {
		await runDcMaintCommand(argv(["dc-1"], { "--json": true }), () => client);
	} finally {
		restore();
	}

	const parsed = JSON.parse(logged[0] ?? "{}") as {
		ok: boolean;
		data: {
			ok: boolean;
			dcId: string;
			maintenance: { currentStaff: number };
			rackViews: Array<{ placementId: string; repairEtaDays: number }>;
		};
	};
	assert.equal(parsed.ok, true);
	assert.equal(parsed.data.dcId, "dc-1");
	assert.equal(parsed.data.maintenance.currentStaff, 2);
	assert.equal(parsed.data.rackViews[0]?.placementId, "rp-1");
	assert.ok(Array.isArray(parsed.data.rackViews));
});

test("dct dc maint inc <dcId> increases staff by 1 and shows updated view", async () => {
	const { client, dispatched } = makeMaintClient("dc-1", 1);
	const { logged, restore } = captureLog();

	try {
		await runDcMaintCommand(argv(["inc", "dc-1"]), () => client);
	} finally {
		restore();
	}

	assert.equal(dispatched.length, 1);
	const action = dispatched[0];
	assert.ok(action !== undefined && action.type === "SetMaintenanceStaff");
	if (action?.type === "SetMaintenanceStaff") {
		assert.equal(action.maintenanceStaff, 2);
	}
	assert.match(logged.join("\n"), /1 → 2/, "should show before → after transition");
});

test("dct dc maint inc <dcId> --by 3 increases by 3", async () => {
	const { client, dispatched } = makeMaintClient("dc-1", 2);
	const { logged, restore } = captureLog();

	try {
		await runDcMaintCommand(argv(["inc", "dc-1"], { "--by": "3" }), () => client);
	} finally {
		restore();
	}

	assert.equal(dispatched.length, 1);
	const action = dispatched[0];
	if (action?.type === "SetMaintenanceStaff") {
		assert.equal(action.maintenanceStaff, 5);
	}
	assert.match(logged.join("\n"), /2 → 5/);
});

test("dct dc maint inc fails when canIncrease is false due to staff cap", async () => {
	const { client } = makeMaintClient("dc-1", 8);
	const { restore } = captureLog();

	try {
		await assert.rejects(() => runDcMaintCommand(argv(["inc", "dc-1"]), () => client), /Cannot increase maintenance staff/);
	} finally {
		restore();
	}
});

test("dct dc maint dec <dcId> decreases staff by 1", async () => {
	const { client, dispatched } = makeMaintClient("dc-1", 3);
	const { logged, restore } = captureLog();

	try {
		await runDcMaintCommand(argv(["dec", "dc-1"]), () => client);
	} finally {
		restore();
	}

	const action = dispatched[0];
	if (action?.type === "SetMaintenanceStaff") {
		assert.equal(action.maintenanceStaff, 2);
	}
	assert.match(logged.join("\n"), /3 → 2/);
});

test("dct dc maint dec fails when already at 0", async () => {
	const { client } = makeMaintClient("dc-1", 0);
	const { restore } = captureLog();

	try {
		await assert.rejects(() => runDcMaintCommand(argv(["dec", "dc-1"]), () => client), /Cannot decrease maintenance staff below 0/);
	} finally {
		restore();
	}
});

test("dct dc maint set <dcId> <count> sets absolute level", async () => {
	const { client, dispatched } = makeMaintClient("dc-1", 1);
	const { logged, restore } = captureLog();

	try {
		await runDcMaintCommand(argv(["set", "dc-1", "5"]), () => client);
	} finally {
		restore();
	}

	const action = dispatched[0];
	if (action?.type === "SetMaintenanceStaff") {
		assert.equal(action.maintenanceStaff, 5);
	}
	assert.match(logged.join("\n"), /1 → 5/);
});

test("dct dc maint set same value emits no-change response", async () => {
	const { client, dispatched } = makeMaintClient("dc-1", 3);
	const { logged, restore } = captureLog();

	try {
		await runDcMaintCommand(argv(["set", "dc-1", "3"]), () => client);
	} finally {
		restore();
	}

	assert.equal(dispatched.length, 0, "should not dispatch when value is unchanged");
	assert.match(logged.join("\n"), /already 3/, "should mention unchanged state");
});

test("dct dc maint set --json returns before+after data", async () => {
	const { client } = makeMaintClient("dc-1", 0);
	const { logged, restore } = captureLog();

	try {
		await runDcMaintCommand(argv(["set", "dc-1", "2"], { "--json": true }), () => client);
	} finally {
		restore();
	}

	const parsed = JSON.parse(logged[0] ?? "{}") as {
		ok: boolean;
		data: {
			ok: boolean;
			changed: boolean;
			dcId: string;
			before: { currentStaff: number };
			maintenance: { currentStaff: number };
			rackViews: Array<unknown>;
		};
	};
	assert.equal(parsed.ok, true);
	assert.equal(parsed.data.changed, true);
	assert.equal(parsed.data.before.currentStaff, 0);
	assert.equal(parsed.data.maintenance.currentStaff, 2);
	assert.ok(Array.isArray(parsed.data.rackViews));
});

test("dct dc maint set fails when exceeding maxStaff cap", async () => {
	const { client } = makeMaintClient("dc-1", 5);
	const { restore } = captureLog();

	try {
		await assert.rejects(() => runDcMaintCommand(argv(["set", "dc-1", "99"]), () => client), /Cannot exceed max maintenance staff/);
	} finally {
		restore();
	}
});
