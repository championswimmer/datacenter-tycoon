import assert from "node:assert/strict";
import test from "node:test";

import { DATACENTER_CATALOG } from "../catalog/datacenters.js";
import { RACK_CATALOG } from "../catalog/racks.js";
import type { ContractId, DatacenterId, RackPlacementId } from "../types.js";
import { serialize, deserialize, migrate, SAVE_VERSION } from "./serialize.js";
import { newGame } from "../state/newGame.js";
import { reduce } from "../state/reduce.js";

const datacenterId = (value: string): DatacenterId => value as DatacenterId;
const rackPlacementId = (value: string): RackPlacementId => value as RackPlacementId;
const contractId = (value: string): ContractId => value as ContractId;

test("serialize wraps state in a versioned envelope", () => {
	const state = newGame(42);

	assert.deepEqual(JSON.parse(serialize(state)), {
		saveVersion: SAVE_VERSION,
		state,
	});
});

test("serialize and deserialize round-trip a non-trivial game state", () => {
	let state = newGame(42, { startingCash: 3_000_000, playerName: "Alex" });
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
		placementId: rackPlacementId("rack-1"),
	});
	state = {
		...state,
		contractMarket: [
			{
				id: contractId("offer-1"),
				name: "Starter Contract",
				requirements: { vCpu: 32, ramGb: 64, storageTb: 8, gpuFlops: 0 },
				monthlyPayment: 3_000,
				penaltyPerMonth: 800,
				termMonths: 3,
				status: "offered",
				offeredAtTick: 0,
				expiresAtTick: 3,
			},
		],
	};
	state = reduce(state, {
		type: "AcceptContract",
		contractId: contractId("offer-1"),
		dcId: datacenterId("dc-1"),
	});
	state = reduce(state, { type: "Tick" });

	const restored = deserialize(serialize(state));

	assert.deepEqual(restored, state);
});

test("migrate is a no-op for current-version envelopes", () => {
	const state = newGame(7);
	const envelope = { saveVersion: SAVE_VERSION, state };

	assert.deepEqual(migrate(envelope), envelope);
});

test("migrate rejects outdated saves that require destructive recreation", () => {
	const state = newGame(7);

	assert.throws(() => migrate({ saveVersion: SAVE_VERSION - 1, state }), {
		message: /Outdated save version/,
	});
});

test("migrate throws on unknown save versions", () => {
	const state = newGame(7);

	assert.throws(() => migrate({ saveVersion: 999, state }), {
		message: /Outdated save version/,
	});
});

test("deserialize rejects invalid envelopes", () => {
	assert.throws(() => deserialize(JSON.stringify({ nope: true })), {
		message: /Invalid save envelope/,
	});
});
