import assert from "node:assert/strict";
import test from "node:test";

import { DATACENTER_CATALOG, RACK_CATALOG } from "@datacenter-tycoon/game-logic";
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
