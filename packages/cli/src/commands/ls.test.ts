import assert from "node:assert/strict";
import test from "node:test";

import { DATACENTER_CATALOG, RACK_CATALOG } from "@datacenter-tycoon/game-logic";
import type { DatacenterListItem, DatacenterMaintenanceStaffingView } from "../protocol/messages.js";
import { parseArgv } from "../argv.js";
import type { CatalogResult, ListResult, QueryParams, StatusView } from "../protocol/messages.js";
import type { CommandClient } from "./common.js";
import { runLsCommand } from "./ls.js";

function makeMaintenance(overrides: Partial<DatacenterMaintenanceStaffingView> = {}): DatacenterMaintenanceStaffingView {
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
		totalRackCount: 0,
		averageRackAgeMonths: 0,
		...overrides,
	};
}

function createCatalogClient(): CommandClient {
	return {
		connect: async () => undefined,
		dispatch: async () => ({ tick: 0 }),
		query: async (params: QueryParams): Promise<CatalogResult | ListResult | StatusView> => {
			if (params.kind === "catalog" && params.target === "racks") {
				return { kind: "racks", items: Object.values(RACK_CATALOG) };
			}

			if (params.kind === "catalog" && params.target === "datacenters") {
				return { kind: "datacenters", items: Object.values(DATACENTER_CATALOG) };
			}

			throw new Error(`Unexpected query: ${JSON.stringify(params)}`);
		},
		control: async () => ({ ok: true }),
		close: async () => undefined,
	};
}

function createDatacenterListClient(items: DatacenterListItem[]): CommandClient {
	return {
		connect: async () => undefined,
		dispatch: async () => ({ tick: 0 }),
		query: async (params: QueryParams): Promise<CatalogResult | ListResult | StatusView> => {
			if (params.kind === "list" && params.target === "datacenters") {
				return { kind: "datacenters", items };
			}

			throw new Error(`Unexpected query: ${JSON.stringify(params)}`);
		},
		control: async () => ({ ok: true }),
		close: async () => undefined,
	};
}

test("runLsCommand catalog text output shows row and column layout", async () => {
	const logged: string[] = [];
	const originalLog = console.log;
	console.log = (message?: unknown) => {
		logged.push(String(message ?? ""));
	};

	try {
		await runLsCommand(parseArgv(["ls", "catalog"]), () => createCatalogClient());
	} finally {
		console.log = originalLog;
	}

	assert.equal(logged.length, 1);
	assert.match(logged[0] ?? "", /Layout/);
	assert.match(logged[0] ?? "", /2 rows × 4 cols \(8 slots\)/);
	assert.match(logged[0] ?? "", /4 rows × 10 cols \(40 slots\)/);
});

test("runLsCommand catalog json output keeps rows and positionsPerRow fields", async () => {
	const logged: string[] = [];
	const originalLog = console.log;
	console.log = (message?: unknown) => {
		logged.push(String(message ?? ""));
	};

	try {
		await runLsCommand(parseArgv(["ls", "catalog", "--json"]), () => createCatalogClient());
	} finally {
		console.log = originalLog;
	}

	assert.equal(logged.length, 1);
	const parsed = JSON.parse(logged[0] ?? "{}") as {
		ok: boolean;
		data: {
			datacenters: Array<{ id: string; rows: number; positionsPerRow: number }>;
		};
	};
	assert.equal(parsed.ok, true);
	assert.equal(parsed.data.datacenters[0]?.id, "garage");
	assert.equal(parsed.data.datacenters[0]?.rows, 2);
	assert.equal(parsed.data.datacenters[0]?.positionsPerRow, 4);
});

test("runLsCommand datacenters text output shows layout bounds", async () => {
	const logged: string[] = [];
	const originalLog = console.log;
	console.log = (message?: unknown) => {
		logged.push(String(message ?? ""));
	};

	try {
		await runLsCommand(
			parseArgv(["ls", "datacenters"]),
			() =>
				createDatacenterListClient([
					{
						datacenter: {
							id: "dc-1",
							name: "Garage One",
							spec: DATACENTER_CATALOG.garage,
							placements: [],
							builtAtTick: 0,
							regionId: "us-west",
							maintenanceStaff: 2,
						},
						capacity: { vCpu: 0, ramGb: 0, storageTb: 0, gpuFlops: 0 },
						capacitySummary: {
							dcId: "dc-1" as never,
							installed: { vCpu: 0, ramGb: 0, storageTb: 0, gpuFlops: 0 },
							usable: { vCpu: 0, ramGb: 0, storageTb: 0, gpuFlops: 0 },
							committed: { vCpu: 0, ramGb: 0, storageTb: 0, gpuFlops: 0 },
							available: { vCpu: 0, ramGb: 0, storageTb: 0, gpuFlops: 0 },
						},
						powerKw: 0,
						powerCapacityKw: DATACENTER_CATALOG.garage.powerCapacityKw,
						heatOutputBtuPerHr: 0,
						coolingCapacityBtuPerHr: DATACENTER_CATALOG.garage.coolingCapacityBtuPerHr,
						bandwidthGbps: 0,
						bandwidthCapacityGbps: DATACENTER_CATALOG.garage.bandwidthGbps,
						slotsUsed: 1,
						totalSlots: DATACENTER_CATALOG.garage.rows * DATACENTER_CATALOG.garage.positionsPerRow,
						maintenance: makeMaintenance({ currentStaff: 2, extraWagesMonthly: 10000 }),
					},
				]),
		);
	} finally {
		console.log = originalLog;
	}

	assert.equal(logged.length, 1);
	assert.match(logged[0] ?? "", /Layout: 2 rows × 4 cols \(8 slots\)/);
	assert.match(logged[0] ?? "", /Bounds: rows 0-1, cols 0-3/);
	assert.match(logged[0] ?? "", /Maintenance:/, "should show maintenance line");
	assert.match(logged[0] ?? "", /2 staff/, "should show staff count");
	assert.match(logged[0] ?? "", /Repair speed/, "should show repair speed");
});

import { newGame } from "@datacenter-tycoon/game-logic";
import type { GameState } from "@datacenter-tycoon/game-logic";

function createContractSnapshotClient(state: Pick<GameState, "contracts" | "contractMarket" | "activeContracts">): import("./common.js").CommandClient {
	return {
		connect: async () => undefined,
		dispatch: async () => ({ tick: 0 }),
		query: async (params: QueryParams): Promise<GameState | ListResult> => {
			if (params.kind === "list" && params.target === "contracts") {
				return {
					kind: "contracts",
					market: state.contracts.filter((contract) => contract.status === "offered"),
					active: state.contracts.filter((contract) => contract.status === "active" || contract.status === "breached"),
					history: state.contracts.filter((contract) => contract.status === "expired" || contract.status === "cancelled"),
				};
			}
			return state as GameState;
		},
		control: async () => ({ ok: true }),
		close: async () => undefined,
	};
}

test("runLsCommand contracts text output shows history section for expired contracts", async () => {
	const baseState = newGame(42);
	const base = baseState.contractMarket[0]!;
	const expiredContract = {
		...base,
		id: "exp-1" as typeof base.id,
		status: "expired" as const,
		startedAtTick: 1,
		assignedDcId: undefined,
	};
	const state = { ...baseState, contracts: [expiredContract], contractMarket: [], activeContracts: [] };
	const client = createContractSnapshotClient(state);

	const logged: string[] = [];
	const originalLog = console.log;
	console.log = (message?: unknown) => { logged.push(String(message)); };
	try {
		await runLsCommand(parseArgv(["ls", "contracts"]), () => client);
	} finally {
		console.log = originalLog;
	}

	const output = logged.join("\n");
	assert.match(output, /Contract History/i, "should have a history section");
	assert.ok(!output.includes("=== Active Contracts ===") || output.includes("No active contracts."), "expired contract must not appear in Active Contracts");
});

test("runLsCommand contracts JSON output includes history bucket", async () => {
	const baseState = newGame(42);
	const base = baseState.contractMarket[0]!;
	const expiredContract = {
		...base,
		id: "exp-json-1" as typeof base.id,
		status: "expired" as const,
		startedAtTick: 1,
		assignedDcId: undefined,
	};
	const state = { ...baseState, contracts: [expiredContract], contractMarket: [], activeContracts: [] };
	const client = createContractSnapshotClient(state);

	const logged: string[] = [];
	const originalLog = console.log;
	console.log = (message?: unknown) => { logged.push(String(message)); };
	try {
		await runLsCommand(parseArgv(["ls", "contracts", "--json"]), () => client);
	} finally {
		console.log = originalLog;
	}

	const parsed = JSON.parse(logged[0] ?? "{}");
	assert.ok(Array.isArray(parsed.data.history), "JSON output must have a history array");
	assert.equal(parsed.data.history.length, 1);
	assert.equal(parsed.data.active.length, 0, "expired contract must not be in active array");
});

// ── rack-risk listing tests ───────────────────────────────────────────────────

import type { RackListItem } from "../protocol/messages.js";
import { rackFailureChance } from "@datacenter-tycoon/game-logic";

function createRackListClient(dcId: string, items: RackListItem[]): import("./common.js").CommandClient {
	return {
		connect: async () => undefined,
		dispatch: async () => ({ tick: 0 }),
		query: async (params: QueryParams): Promise<ListResult> => {
			if (params.kind === "list" && params.target === "racks") {
				return { kind: "racks", dcId, items };
			}
			throw new Error(`Unexpected query: ${JSON.stringify(params)}`);
		},
		control: async () => ({ ok: true }),
		close: async () => undefined,
	};
}

const HEALTHY_RACK_ITEM: RackListItem = {
	dcId: "dc-1",
	dcName: "Test DC",
	placementId: "rp-1",
	spec: RACK_CATALOG.C1!,
	row: 0,
	position: 0,
	installedAtTick: 0,
	health: "healthy",
	ageMonths: 12,
	failureProbability: rackFailureChance(12),
};

const REPAIRING_RACK_ITEM: RackListItem = {
	...HEALTHY_RACK_ITEM,
	placementId: "rp-2",
	health: "repairing",
	ageMonths: 24,
	failureProbability: 0,
};

test("runLsCommand racks text output shows health and fail-risk for healthy rack", async () => {
	const logged: string[] = [];
	const originalLog = console.log;
	console.log = (message?: unknown) => { logged.push(String(message ?? "")); };
	try {
		await runLsCommand(
			parseArgv(["ls", "racks", "dc-1"]),
			() => createRackListClient("dc-1", [HEALTHY_RACK_ITEM]),
		);
	} finally {
		console.log = originalLog;
	}

	const output = logged.join("\n");
	assert.match(output, /Health: HEALTHY/, "should show HEALTHY status");
	assert.match(output, /Fail risk:.*%\/mo/, "should show fail risk percentage");
	assert.match(output, /Age: 12 mo/, "should show rack age");
});

test("runLsCommand racks text output shows UNDER REPAIR for repairing rack", async () => {
	const logged: string[] = [];
	const originalLog = console.log;
	console.log = (message?: unknown) => { logged.push(String(message ?? "")); };
	try {
		await runLsCommand(
			parseArgv(["ls", "racks", "dc-1"]),
			() => createRackListClient("dc-1", [REPAIRING_RACK_ITEM]),
		);
	} finally {
		console.log = originalLog;
	}

	const output = logged.join("\n");
	assert.match(output, /Health: REPAIRING/, "should show REPAIRING status");
	assert.match(output, /Fail risk: UNDER REPAIR/, "should show UNDER REPAIR for repairing rack");
});

test("runLsCommand racks JSON output includes health, ageMonths, failureProbability fields", async () => {
	const logged: string[] = [];
	const originalLog = console.log;
	console.log = (message?: unknown) => { logged.push(String(message ?? "")); };
	try {
		await runLsCommand(
			parseArgv(["ls", "racks", "dc-1", "--json"]),
			() => createRackListClient("dc-1", [HEALTHY_RACK_ITEM, REPAIRING_RACK_ITEM]),
		);
	} finally {
		console.log = originalLog;
	}

	const parsed = JSON.parse(logged[0] ?? "{}") as {
		ok: boolean;
		data: { dcId: string; racks: RackListItem[] };
	};
	assert.equal(parsed.ok, true);
	assert.equal(parsed.data.racks.length, 2);

	const healthy = parsed.data.racks[0]!;
	assert.equal(healthy.health, "healthy");
	assert.equal(healthy.ageMonths, 12);
	assert.ok(typeof healthy.failureProbability === "number");
	assert.ok(healthy.failureProbability > 0, "healthy rack probability should be > 0");

	const repairing = parsed.data.racks[1]!;
	assert.equal(repairing.health, "repairing");
	assert.equal(repairing.failureProbability, 0, "repairing rack probability should be 0");
});
