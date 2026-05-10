import assert from "node:assert/strict";
import test from "node:test";

import { DATACENTER_CATALOG, RACK_CATALOG } from "@datacenter-tycoon/game-logic";
import type { DatacenterListItem } from "../protocol/messages.js";
import { parseArgv } from "../argv.js";
import type { CatalogResult, ListResult, QueryParams, StatusView } from "../protocol/messages.js";
import type { CommandClient } from "./common.js";
import { runLsCommand } from "./ls.js";

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
						powerKw: 0,
						powerCapacityKw: DATACENTER_CATALOG.garage.powerCapacityKw,
						heatOutputBtuPerHr: 0,
						coolingCapacityBtuPerHr: DATACENTER_CATALOG.garage.coolingCapacityBtuPerHr,
						bandwidthGbps: 0,
						bandwidthCapacityGbps: DATACENTER_CATALOG.garage.bandwidthGbps,
						slotsUsed: 1,
						totalSlots: DATACENTER_CATALOG.garage.rows * DATACENTER_CATALOG.garage.positionsPerRow,
					},
				]),
		);
	} finally {
		console.log = originalLog;
	}

	assert.equal(logged.length, 1);
	assert.match(logged[0] ?? "", /Layout: 2 rows × 4 cols \(8 slots\)/);
	assert.match(logged[0] ?? "", /Bounds: rows 0-1, cols 0-3/);
});

import { newGame } from "@datacenter-tycoon/game-logic";
import type { GameState } from "@datacenter-tycoon/game-logic";

function createContractSnapshotClient(state: Pick<GameState, "contractMarket" | "activeContracts">): import("./common.js").CommandClient {
	return {
		connect: async () => undefined,
		dispatch: async () => ({ tick: 0 }),
		query: async (): Promise<GameState> => state as GameState,
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
	const state = { ...baseState, contractMarket: [], activeContracts: [expiredContract] };
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
	const state = { ...baseState, contractMarket: [], activeContracts: [expiredContract] };
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
