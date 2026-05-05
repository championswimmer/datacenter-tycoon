import assert from "node:assert/strict";
import test from "node:test";

import { DATACENTER_CATALOG } from "../catalog/datacenters.js";
import { RACK_CATALOG } from "../catalog/racks.js";
import type { Datacenter, RackPlacement } from "../types.js";
import { canMoveRack } from "./datacenter.js";

const datacenterId = (value: string) => value as import("../types.js").DatacenterId;
const rackPlacementId = (value: string) => value as import("../types.js").RackPlacementId;
const rackSpecId = (value: string) => value as import("../types.js").RackSpecId;
const tick = (value: number) => value as import("../types.js").Tick;

function makePlacement(id: string, specKey: keyof typeof RACK_CATALOG, row: number, position: number): RackPlacement {
	const spec = RACK_CATALOG[specKey];
	return {
		id: rackPlacementId(id),
		specId: spec.id,
		kind: spec.kind,
		installedAtTick: tick(0),
		health: "healthy",
		row,
		position,
	};
}

function makeDatacenter(id: string, placements: RackPlacement[] = []): Datacenter {
	return {
		id: datacenterId(id),
		name: `Garage ${id}`,
		spec: DATACENTER_CATALOG.garage,
		placements,
		builtAtTick: tick(0),
		regionId: "us_west" as import("../types.js").RegionId,
		maintenanceStaff: 0,
	};
}

test("canMoveRack allows valid move between different datacenters", () => {
	const sourceDc = makeDatacenter("dc-1", [makePlacement("rack-1", "C1", 0, 0)]);
	const targetDc = makeDatacenter("dc-2");
	const placement = sourceDc.placements[0]!;

	const result = canMoveRack(sourceDc, targetDc, placement, { row: 0, position: 0 });
	assert.equal(result.ok, true);
});

test("canMoveRack rejects move to same datacenter", () => {
	const sourceDc = makeDatacenter("dc-1", [makePlacement("rack-1", "C1", 0, 0)]);
	const placement = sourceDc.placements[0]!;

	const result = canMoveRack(sourceDc, sourceDc, placement, { row: 0, position: 1 });
	assert.equal(result.ok, false);
	assert.ok((result as { ok: false; reason: string }).reason.includes("same datacenter"));
});

test("canMoveRack rejects missing placement in source datacenter", () => {
	const sourceDc = makeDatacenter("dc-1");
	const targetDc = makeDatacenter("dc-2");
	const ghostPlacement = makePlacement("rack-ghost", "C1", 0, 0);

	const result = canMoveRack(sourceDc, targetDc, ghostPlacement, { row: 0, position: 0 });
	assert.equal(result.ok, false);
	assert.ok((result as { ok: false; reason: string }).reason.includes("not found"));
});

test("canMoveRack rejects out-of-bounds target position", () => {
	const sourceDc = makeDatacenter("dc-1", [makePlacement("rack-1", "C1", 0, 0)]);
	const targetDc = makeDatacenter("dc-2");
	const placement = sourceDc.placements[0]!;

	const result = canMoveRack(sourceDc, targetDc, placement, { row: 99, position: 99 });
	assert.equal(result.ok, false);
	assert.ok((result as { ok: false; reason: string }).reason.includes("out_of_bounds"));
});

test("canMoveRack rejects occupied target slot", () => {
	const sourceDc = makeDatacenter("dc-1", [makePlacement("rack-1", "C1", 0, 0)]);
	const targetDc = makeDatacenter("dc-2", [makePlacement("rack-2", "C1", 0, 0)]);
	const placement = sourceDc.placements[0]!;

	const result = canMoveRack(sourceDc, targetDc, placement, { row: 0, position: 0 });
	assert.equal(result.ok, false);
	assert.ok((result as { ok: false; reason: string }).reason.includes("slot_taken"));
});
