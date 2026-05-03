import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { setTimeout as sleep } from "node:timers/promises";

import { DATACENTER_CATALOG, RACK_CATALOG, reduce, type DatacenterId, type RackPlacementId } from "@datacenter-tycoon/game-logic";

import { GamePersistence, loadOrInit } from "./persist.js";

const datacenterId = (value: string): DatacenterId => value as DatacenterId;
const rackPlacementId = (value: string): RackPlacementId => value as RackPlacementId;

function createTempSavePath(): string {
	const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "dct-cli-persist-"));
	return path.join(tempDirectory, "save.json");
}

function createState(seed: number) {
	let state = loadOrInit("/path/that/does/not/exist.json", seed);
	const firstRegionId = state.map.regions[0]!.id;
	state = reduce(state, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId: datacenterId("dc-1"),
		regionId: firstRegionId,
	});
	state = reduce(state, {
		type: "PlaceRack",
		dcId: datacenterId("dc-1"),
		specId: RACK_CATALOG.C1.id,
		row: 0,
		position: 0,
		placementId: rackPlacementId("rp-1"),
	});
	return reduce(state, { type: "Tick" });
}

test("loadOrInit returns a new game when no savefile exists", () => {
	const savePath = createTempSavePath();
	const state = loadOrInit(savePath, 123);

	assert.equal(state.seed, 123);
	assert.equal(state.tick, 0);
	assert.equal(state.contractMarket.length > 0, true);
});

test("GamePersistence flushSync round-trips state through the savefile", () => {
	const savePath = createTempSavePath();
	const originalState = createState(42);
	const persistence = new GamePersistence({ savePath });

	persistence.flushSync(originalState);

	const reloadedState = loadOrInit(savePath, 999);
	assert.deepEqual(reloadedState, originalState);
	assert.equal(fs.existsSync(`${savePath}.tmp`), false);
});

test("GamePersistence scheduleAutosave debounces writes and persists the latest snapshot", async () => {
	const savePath = createTempSavePath();
	const persistence = new GamePersistence({ savePath, debounceMs: 20 });
	const firstState = createState(1);
	const secondState = reduce(createState(2), { type: "Tick" });

	persistence.scheduleAutosave(firstState);
	persistence.scheduleAutosave(secondState);

	await sleep(50);
	await persistence.waitForPendingFlush();

	const reloadedState = loadOrInit(savePath, 999);
	assert.deepEqual(reloadedState, secondState);
});
