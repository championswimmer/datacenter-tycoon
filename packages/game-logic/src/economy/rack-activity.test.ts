import assert from "node:assert/strict";
import test from "node:test";

import {
	allocateRackActivity,
	summarizeRackActivity,
	type RackAllocationCandidate,
} from "./rack-activity.js";
import type { RackPlacementId, RackSpecId } from "../types.js";

const placementId = (value: string): RackPlacementId => value as RackPlacementId;
const specId = (value: string): RackSpecId => value as RackSpecId;

function rack(
	overrides: Partial<RackAllocationCandidate> &
		Pick<RackAllocationCandidate, "placementId" | "specId" | "kind" | "powerDrawKw" | "serviceUnits">,
): RackAllocationCandidate {
	return {
		isRepairing: false,
		...overrides,
	};
}

test("allocateRackActivity deterministically assigns active racks and keeps extras idle", () => {
	const racks: RackAllocationCandidate[] = [
		rack({
			placementId: placementId("m-02"),
			specId: specId("memory-h1"),
			kind: "memory",
			powerDrawKw: 4,
			serviceUnits: 128,
		}),
		rack({
			placementId: placementId("c-02"),
			specId: specId("compute-m1"),
			kind: "compute",
			powerDrawKw: 5,
			serviceUnits: 64,
		}),
		rack({
			placementId: placementId("c-01"),
			specId: specId("compute-h1"),
			kind: "compute",
			powerDrawKw: 6,
			serviceUnits: 64,
		}),
		rack({
			placementId: placementId("s-01"),
			specId: specId("storage-h1"),
			kind: "storage",
			powerDrawKw: 3,
			serviceUnits: 120,
		}),
	];

	const allocation = allocateRackActivity(racks, { compute: 60 });
	const summary = summarizeRackActivity(allocation.activities);

	assert.deepEqual(
		allocation.activities.map((activity) => activity.placementId),
		[placementId("c-01"), placementId("c-02"), placementId("m-02"), placementId("s-01")],
	);
	assert.deepEqual(
		allocation.activities.map((activity) => activity.status),
		["active", "idle", "idle", "idle"],
	);
	assert.equal(allocation.remainingDemandByKind.compute, 0);
	assert.equal(summary.activeRackCount, 1);
	assert.equal(summary.idleRackCount, 3);
	assert.equal(summary.repairingRackCount, 0);
	assert.equal(summary.activePowerKw, 6);
	assert.equal(summary.reservedPowerKw, 18);
	assert.ok(Math.abs(summary.idleBaselinePowerKw - 2.4) < 1e-9);
	assert.ok(Math.abs(summary.billedPowerKw - 6.0) < 1e-9);
});

test("allocateRackActivity excludes repairing racks from active assignment", () => {
	const racks: RackAllocationCandidate[] = [
		rack({
			placementId: placementId("c-01"),
			specId: specId("compute-h1"),
			kind: "compute",
			powerDrawKw: 6,
			serviceUnits: 64,
			isRepairing: true,
		}),
		rack({
			placementId: placementId("c-02"),
			specId: specId("compute-m1"),
			kind: "compute",
			powerDrawKw: 5,
			serviceUnits: 64,
		}),
	];

	const allocation = allocateRackActivity(racks, { compute: 100 });
	const summary = summarizeRackActivity(allocation.activities);

	assert.deepEqual(
		allocation.activities.map((activity) => activity.status),
		["repairing", "active"],
	);
	assert.equal(allocation.remainingDemandByKind.compute, 36);
	assert.equal(summary.activeRackCount, 1);
	assert.equal(summary.idleRackCount, 0);
	assert.equal(summary.repairingRackCount, 1);
	assert.equal(summary.activePowerKw, 5);
	assert.equal(summary.reservedPowerKw, 11);
	assert.equal(summary.idleBaselinePowerKw, 0.8);
	assert.equal(summary.billedPowerKw, 3.8);
});
