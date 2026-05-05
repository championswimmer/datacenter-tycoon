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

const FIRST_REGION_ID = Object.values(REGION_CATALOG)[0]!.id;

test("runBuildDatacenterCommand dispatches BuildDatacenter and honors --id", async () => {
	const actions: Action[] = [];
	await runBuildDatacenterCommand(parseArgv(["build-dc", "garage", "--id", "dc-custom", "--quiet"]), () => createFakeClient(actions));

	assert.deepEqual(actions, [{ type: "BuildDatacenter", specId: "garage", dcId: "dc-custom", regionId: FIRST_REGION_ID }]);
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
		{ message: /move-rack <dcId> <placementId> <targetDcId> <row> <position>/ },
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
