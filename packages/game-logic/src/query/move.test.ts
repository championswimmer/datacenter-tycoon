import assert from "node:assert/strict";
import test from "node:test";

import { DATACENTER_CATALOG } from "../catalog/datacenters.js";
import { RACK_CATALOG } from "../catalog/racks.js";
import { listRackMoveTargets, type Datacenter, type GameState, type RackPlacement, type RackPlacementId } from "../index.js";

const rackPlacementId = (value: string): RackPlacementId => value as RackPlacementId;

function placement(id: string, specId: keyof typeof RACK_CATALOG, row: number, position: number): RackPlacement {
	const spec = RACK_CATALOG[specId];
	return {
		id: rackPlacementId(id),
		specId: spec.id,
		kind: spec.kind,
		installedAtTick: 0,
		health: "healthy",
		row,
		position,
	};
}

function makeDatacenter(id: string, regionId: string, placements: RackPlacement[]): Datacenter {
	return {
		id: id as Datacenter["id"],
		name: id,
		spec: DATACENTER_CATALOG.garage,
		placements,
		builtAtTick: 0,
		regionId: regionId as Datacenter["regionId"],
		maintenanceStaff: 0,
	};
}

test("listRackMoveTargets reports same-region and cross-region move candidates with legal-slot summaries", () => {
	const source = makeDatacenter("dc-source", "region-a", [placement("rack-source", "C1", 0, 0)]);
	const sameRegionTarget = makeDatacenter("dc-same", "region-a", []);
	const crossRegionTarget = makeDatacenter("dc-cross", "region-b", [
		placement("rack-1", "C0", 0, 0),
		placement("rack-2", "C0", 0, 1),
		placement("rack-3", "C0", 0, 2),
		placement("rack-4", "C0", 0, 3),
		placement("rack-5", "C0", 1, 0),
		placement("rack-6", "C0", 1, 1),
		placement("rack-7", "C0", 1, 2),
		placement("rack-8", "C0", 1, 3),
	]);
	const state = {
		datacenters: [source, sameRegionTarget, crossRegionTarget],
	} as Pick<GameState, "datacenters">;

	const targets = listRackMoveTargets(state, source.id, rackPlacementId("rack-source"));
	assert.equal(targets.length, 2);

	const sameRegion = targets.find((target) => target.targetDcId === sameRegionTarget.id);
	assert.ok(sameRegion);
	assert.equal(sameRegion?.sameRegion, true);
	assert.equal(sameRegion?.moveCost, Math.round(RACK_CATALOG.C1.capexCost * 0.1));
	assert.equal(sameRegion?.availableSlots, 8);
	assert.deepEqual(sameRegion?.firstAvailableSlot, { row: 0, position: 0 });

	const crossRegion = targets.find((target) => target.targetDcId === crossRegionTarget.id);
	assert.ok(crossRegion);
	assert.equal(crossRegion?.sameRegion, false);
	assert.equal(crossRegion?.moveCost, Math.round(RACK_CATALOG.C1.capexCost * 0.25));
	assert.equal(crossRegion?.availableSlots, 0);
	assert.equal(crossRegion?.firstAvailableSlot, null);
});
