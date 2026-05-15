import assert from "node:assert/strict";
import test from "node:test";

import { DATACENTER_CATALOG } from "@datacenter-tycoon/game-logic";
import type { DatacenterMaintenanceStaffingView, Action } from "@datacenter-tycoon/game-logic";
import type {
	DatacenterInfrastructureView,
	DatacenterListItem,
	DatacenterUpgradeView,
	ListResult,
	QueryParams,
} from "../protocol/messages.js";
import type { CommandClient } from "./common.js";
import { runDcMaintCommand } from "./dc-maint.js";

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Simulate the positionals that `runDcMaintCommand` receives after dc.ts has
 * already stripped the "maint" subcommand prefix via withShiftedPositionals.
 */
function argv(positionals: string[], flags: Record<string, string | boolean> = {}): import("../argv.js").ParsedArgv {
	return { command: undefined, positionals, flags, rawArgs: [] };
}

// ── fixtures ──────────────────────────────────────────────────────────────────

function makeMaintenance(
	overrides: Partial<DatacenterMaintenanceStaffingView> = {},
): DatacenterMaintenanceStaffingView {
	return {
		dcId: "dc-1",
		currentStaff: 0,
		maxStaff: 10,
		canIncrease: true,
		canDecrease: false,
		availableRegionalStaff: 20,
		staffWagePerHead: 5000,
		extraWagesMonthly: 0,
		repairSpeedDaysPerTick: 30,
		repairingRackCount: 0,
		totalRackCount: 2,
		averageRackAgeMonths: 6,
		...overrides,
	};
}

function makeInfrastructureView(dcId: string): DatacenterInfrastructureView {
	return {
		dcId: dcId as never,
		base: {
			gridImportCapacityKw: DATACENTER_CATALOG.garage.powerCapacityKw,
			onsiteGenerationCapacityKw: 0,
			rackPowerCapacityKw: DATACENTER_CATALOG.garage.powerCapacityKw,
			coolingCapacityBtuPerHr: DATACENTER_CATALOG.garage.coolingCapacityBtuPerHr,
			coolingType: DATACENTER_CATALOG.garage.coolingType,
			networkType: DATACENTER_CATALOG.garage.networkType,
			bandwidthGbps: DATACENTER_CATALOG.garage.bandwidthGbps,
		},
		effective: {
			gridImportCapacityKw: DATACENTER_CATALOG.garage.powerCapacityKw,
			onsiteGenerationCapacityKw: 0,
			rackPowerCapacityKw: DATACENTER_CATALOG.garage.powerCapacityKw,
			coolingCapacityBtuPerHr: DATACENTER_CATALOG.garage.coolingCapacityBtuPerHr,
			coolingType: DATACENTER_CATALOG.garage.coolingType,
			networkType: DATACENTER_CATALOG.garage.networkType,
			bandwidthGbps: DATACENTER_CATALOG.garage.bandwidthGbps,
		},
		fabricEligible: false,
	};
}

function makeUpgradeView(dcId: string): DatacenterUpgradeView {
	return {
		dcId: dcId as never,
		infrastructure: makeInfrastructureView(dcId),
		tracks: [],
		fixedMonthlyUpgradeOpex: 0,
		fabricEligible: false,
	};
}

function makeDatacenterItem(
	dcId: string,
	maintenance: DatacenterMaintenanceStaffingView,
): DatacenterListItem {
	return {
		datacenter: {
			id: dcId,
			name: "Test DC",
			spec: DATACENTER_CATALOG.garage,
			placements: [],
			builtAtTick: 0,
			regionId: "us-west",
			maintenanceStaff: maintenance.currentStaff,
		},
		capacity: { vCpu: 0, ramGb: 0, storageTb: 0, gpuFlops: 0 },
		infrastructure: makeInfrastructureView(dcId),
		upgrades: makeUpgradeView(dcId),
		powerKw: 0,
		powerCapacityKw: DATACENTER_CATALOG.garage.powerCapacityKw,
		heatOutputBtuPerHr: 0,
		coolingCapacityBtuPerHr: DATACENTER_CATALOG.garage.coolingCapacityBtuPerHr,
		bandwidthGbps: 0,
		bandwidthCapacityGbps: DATACENTER_CATALOG.garage.bandwidthGbps,
		slotsUsed: 0,
		totalSlots: DATACENTER_CATALOG.garage.rows * DATACENTER_CATALOG.garage.positionsPerRow,
		maintenance,
	};
}

/**
 * A stateful fake client that tracks dispatched actions and returns an updated
 * maintenance view on each subsequent list query.
 */
function makeMaintClient(
	dcId: string,
	initial: DatacenterMaintenanceStaffingView,
): { client: CommandClient; dispatched: Action[] } {
	let current = initial;
	const dispatched: Action[] = [];

	const client: CommandClient = {
		connect: async () => undefined,
		dispatch: async (action: Action) => {
			dispatched.push(action);
			if (action.type === "SetMaintenanceStaff" && action.dcId === dcId) {
				const next = action.maintenanceStaff;
				current = {
					...current,
					currentStaff: next,
					canDecrease: next > 0,
					canIncrease: next < current.maxStaff && current.availableRegionalStaff > 0,
					extraWagesMonthly: next * current.staffWagePerHead,
				};
			}
			return { tick: 0 };
		},
		query: async (params: QueryParams): Promise<ListResult> => {
			if (params.kind === "list" && params.target === "datacenters") {
				return { kind: "datacenters", items: [makeDatacenterItem(dcId, current)] };
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
	console.log = (msg?: unknown) => { logged.push(String(msg ?? "")); };
	return { logged, restore: () => { console.log = orig; } };
}

// ── show ──────────────────────────────────────────────────────────────────────

test("dct dc maint <dcId> shows maintenance staffing detail", async () => {
	const maintenance = makeMaintenance({ currentStaff: 3, extraWagesMonthly: 15000 });
	const { client } = makeMaintClient("dc-1", maintenance);
	const { logged, restore } = captureLog();

	try {
		await runDcMaintCommand(argv(["dc-1"]), () => client);
	} finally {
		restore();
	}

	const output = logged.join("\n");
	assert.match(output, /Maintenance staffing: dc-1/, "should show dc id");
	assert.match(output, /Current staff\s*:\s*3/, "should show current staff");
	assert.match(output, /Repair speed/, "should show repair speed");
	assert.match(output, /Wage\/head\/mo/, "should show wage per head");
	assert.match(output, /Extra wages\/mo/, "should show total extra wages");
});

test("dct dc maint <dcId> --json returns structured data", async () => {
	const maintenance = makeMaintenance({ currentStaff: 2, extraWagesMonthly: 10000 });
	const { client } = makeMaintClient("dc-1", maintenance);
	const { logged, restore } = captureLog();

	try {
		await runDcMaintCommand(argv(["dc-1"], { "--json": true }), () => client);
	} finally {
		restore();
	}

	const parsed = JSON.parse(logged[0] ?? "{}") as {
		ok: boolean;
		data: { ok: boolean; dcId: string; maintenance: DatacenterMaintenanceStaffingView };
	};
	assert.equal(parsed.ok, true);
	assert.equal(parsed.data.dcId, "dc-1");
	assert.equal(parsed.data.maintenance.currentStaff, 2);
	assert.equal(parsed.data.maintenance.extraWagesMonthly, 10000);
});

// ── inc ───────────────────────────────────────────────────────────────────────

test("dct dc maint inc <dcId> increases staff by 1 and shows updated view", async () => {
	const maintenance = makeMaintenance({ currentStaff: 1, canDecrease: true });
	const { client, dispatched } = makeMaintClient("dc-1", maintenance);
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
	const output = logged.join("\n");
	assert.match(output, /1 → 2/, "should show before → after transition");
});

test("dct dc maint inc <dcId> --by 3 increases by 3", async () => {
	const maintenance = makeMaintenance({ currentStaff: 2, canDecrease: true });
	const { client, dispatched } = makeMaintClient("dc-1", maintenance);
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
	const maintenance = makeMaintenance({ currentStaff: 10, maxStaff: 10, canIncrease: false });
	const { client } = makeMaintClient("dc-1", maintenance);
	const { restore } = captureLog();

	try {
		await assert.rejects(
			() => runDcMaintCommand(argv(["inc", "dc-1"]), () => client),
			/Cannot increase maintenance staff/,
		);
	} finally {
		restore();
	}
});

// ── dec ───────────────────────────────────────────────────────────────────────

test("dct dc maint dec <dcId> decreases staff by 1", async () => {
	const maintenance = makeMaintenance({ currentStaff: 3, canDecrease: true });
	const { client, dispatched } = makeMaintClient("dc-1", maintenance);
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
	const maintenance = makeMaintenance({ currentStaff: 0, canDecrease: false });
	const { client } = makeMaintClient("dc-1", maintenance);
	const { restore } = captureLog();

	try {
		await assert.rejects(
			() => runDcMaintCommand(argv(["dec", "dc-1"]), () => client),
			/Cannot decrease maintenance staff below 0/,
		);
	} finally {
		restore();
	}
});

// ── set ───────────────────────────────────────────────────────────────────────

test("dct dc maint set <dcId> <count> sets absolute level", async () => {
	const maintenance = makeMaintenance({ currentStaff: 1, canDecrease: true });
	const { client, dispatched } = makeMaintClient("dc-1", maintenance);
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
	const maintenance = makeMaintenance({ currentStaff: 3, canDecrease: true });
	const { client, dispatched } = makeMaintClient("dc-1", maintenance);
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
	const maintenance = makeMaintenance({ currentStaff: 0, canDecrease: false });
	const { client } = makeMaintClient("dc-1", maintenance);
	const { logged, restore } = captureLog();

	try {
		await runDcMaintCommand(
			argv(["set", "dc-1", "2"], { "--json": true }),
			() => client,
		);
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
			maintenance: DatacenterMaintenanceStaffingView;
		};
	};
	assert.equal(parsed.ok, true);
	assert.equal(parsed.data.changed, true);
	assert.equal(parsed.data.before.currentStaff, 0);
	assert.equal(parsed.data.maintenance.currentStaff, 2);
});

test("dct dc maint set fails when exceeding maxStaff cap", async () => {
	const maintenance = makeMaintenance({ currentStaff: 5, maxStaff: 10, canIncrease: true });
	const { client } = makeMaintClient("dc-1", maintenance);
	const { restore } = captureLog();

	try {
		await assert.rejects(
			() => runDcMaintCommand(argv(["set", "dc-1", "99"]), () => client),
			/Cannot exceed max maintenance staff/,
		);
	} finally {
		restore();
	}
});
