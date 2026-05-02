import assert from "node:assert/strict";
import test from "node:test";

import { parseArgv } from "../argv.js";
import type { Action } from "@datacenter-tycoon/game-logic";
import type { CommandClient } from "./common.js";
import { runAddRackCommand, runBuildDatacenterCommand, runRemoveRackCommand } from "./build-dc.js";

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

test("runBuildDatacenterCommand dispatches BuildDatacenter and honors --id", async () => {
	const actions: Action[] = [];
	await runBuildDatacenterCommand(parseArgv(["build-dc", "garage", "--id", "dc-custom", "--quiet"]), () => createFakeClient(actions));

	assert.deepEqual(actions, [{ type: "BuildDatacenter", specId: "garage", dcId: "dc-custom" }]);
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
