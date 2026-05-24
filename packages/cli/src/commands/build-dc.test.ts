import assert from "node:assert/strict";
import test from "node:test";

import { parseArgv } from "../argv.js";
import type { Action } from "@datacenter-tycoon/game-logic";
import { REGION_CATALOG } from "@datacenter-tycoon/game-logic";
import type { CommandClient } from "./common.js";
import { runAddRackCommand, runBuildDatacenterCommand, runMoveRackCommand, runRemoveRackCommand } from "./build-dc.js";

function createFakeClient(actions: Action[]): CommandClient {
	return {
		connect: async () => undefined,
		dispatch: async (action) => {
			actions.push(action);
			return { tick: 0 };
		},
		query: async () => ({ kind: "status", tick: 0 }),
		control: async () => ({ ok: true }),
		close: async () => undefined,
	};
}

const FIRST_REGION = Object.values(REGION_CATALOG)[0]!;
const FIRST_REGION_ID = FIRST_REGION.id;

test("runBuildDatacenterCommand dispatches BuildDatacenter and honors --id", async () => {
	const actions: Action[] = [];
	await runBuildDatacenterCommand(parseArgv(["build-dc", "garage", "--id", "dc-custom", "--quiet"]), () => createFakeClient(actions));

	assert.deepEqual(actions, [{ type: "BuildDatacenter", specId: "garage", dcId: "dc-custom", regionId: FIRST_REGION_ID }]);
});

test("runBuildDatacenterCommand prints region label in text output", async () => {
	const actions: Action[] = [];
	const printed: string[] = [];
	const originalConsoleLog = console.log;
	console.log = (message?: unknown) => {
		printed.push(String(message ?? ""));
	};

	try {
		await runBuildDatacenterCommand(parseArgv(["build-dc", "garage", "--id", "dc-custom"]), () => createFakeClient(actions));
	} finally {
		console.log = originalConsoleLog;
	}

	assert.deepEqual(actions, [{ type: "BuildDatacenter", specId: "garage", dcId: "dc-custom", regionId: FIRST_REGION_ID }]);
	assert.match(printed[0] ?? "", new RegExp(`Built datacenter dc-custom in ${FIRST_REGION.code} .* ${FIRST_REGION.name}`));
	assert.match(printed[0] ?? "", new RegExp(`Power \\\$${FIRST_REGION.powerCostPerKwh.toFixed(3).replace(".", "\\.")}/kWh`));
	assert.match(printed[0] ?? "", /Labor \$[\d,]+\/mo/);
});

test("runBuildDatacenterCommand prints json output when --json is set", async () => {
	const actions: Action[] = [];
	const printed: string[] = [];
	const originalConsoleLog = console.log;
	console.log = (message?: unknown) => {
		printed.push(String(message ?? ""));
	};

	try {
		await runBuildDatacenterCommand(parseArgv(["build-dc", "garage", "--id", "dc-custom", "--json"]), () => createFakeClient(actions));
	} finally {
		console.log = originalConsoleLog;
	}

	assert.deepEqual(actions, [{ type: "BuildDatacenter", specId: "garage", dcId: "dc-custom", regionId: FIRST_REGION_ID }]);
	assert.deepEqual(JSON.parse(printed[0] ?? "{}"), {
		ok: true,
		data: {
			dcId: "dc-custom",
			specId: "garage",
			region: FIRST_REGION_ID,
			regionCode: FIRST_REGION.code,
			regionCity: FIRST_REGION.city,
			regionName: FIRST_REGION.name,
			regionLabel: `${FIRST_REGION.code} · ${FIRST_REGION.city} · ${FIRST_REGION.name}`,
			powerCostPerKwh: FIRST_REGION.powerCostPerKwh,
			staffWagePerMonth: FIRST_REGION.staffWage,
		},
	});
});

test("runAddRackCommand dispatches PlaceRack with numeric coordinates", async () => {
	const actions: Action[] = [];
	await runAddRackCommand(parseArgv(["add-rack", "dc-1", "0", "2", "C1", "--id", "rp-1", "--quiet"]), () => createFakeClient(actions));

	assert.deepEqual(actions, [
		{ type: "PlaceRack", dcId: "dc-1", specId: "C1", row: 0, position: 2, placementId: "rp-1" },
	]);
});

test("runRemoveRackCommand dispatches RemoveRack", async () => {
	const actions: Action[] = [];
	await runRemoveRackCommand(parseArgv(["remove-rack", "dc-1", "rp-1", "--quiet"]), () => createFakeClient(actions));

	assert.deepEqual(actions, [{ type: "RemoveRack", dcId: "dc-1", placementId: "rp-1" }]);
});

test("runMoveRackCommand dispatches MoveRack with all arguments", async () => {
	const actions: Action[] = [];
	await runMoveRackCommand(parseArgv(["move-rack", "dc-1", "rp-1", "dc-2", "1", "3", "--quiet"]), () => createFakeClient(actions));

	assert.deepEqual(actions, [
		{ type: "MoveRack", dcId: "dc-1", placementId: "rp-1", targetDcId: "dc-2", row: 1, position: 3 },
	]);
});

test("runMoveRackCommand throws on missing arguments", async () => {
	const actions: Action[] = [];
	await assert.rejects(
		() => runMoveRackCommand(parseArgv(["move-rack", "dc-1", "rp-1", "--quiet"]), () => createFakeClient(actions)),
		{ message: /racks move <dcId> <placementId> <targetDcId> <row> <position>/ },
	);
});

test("runMoveRackCommand throws on invalid row", async () => {
	const actions: Action[] = [];
	await assert.rejects(
		() => runMoveRackCommand(parseArgv(["move-rack", "dc-1", "rp-1", "dc-2", "abc", "0", "--quiet"]), () => createFakeClient(actions)),
		{ message: /Invalid row: abc/ },
	);
});

test("runMoveRackCommand throws on invalid position", async () => {
	const actions: Action[] = [];
	await assert.rejects(
		() => runMoveRackCommand(parseArgv(["move-rack", "dc-1", "rp-1", "dc-2", "0", "abc", "--quiet"]), () => createFakeClient(actions)),
		{ message: /Invalid position: abc/ },
	);
});
