import assert from "node:assert/strict";
import test from "node:test";

import { DATACENTER_CATALOG, newGame, reduce, RACK_CATALOG , DEFAULT_REGION_ID } from "@datacenter-tycoon/game-logic";

import { renderDatacentersTab } from "./datacenters.js";

test("renderDatacentersTab shows the list and rack grid for the selected datacenter", () => {
	let snapshot = newGame(1, { startingCash: 3_000_000 });
	snapshot = reduce(snapshot, { type: "BuildDatacenter", specId: DATACENTER_CATALOG.garage.id, dcId: "dc-1" as never });
		regionId: DEFAULT_REGION_ID,
	snapshot = reduce(snapshot, { type: "PlaceRack", dcId: "dc-1" as never, specId: RACK_CATALOG.C1.id, row: 0, position: 0, placementId: "rp-1" as never });

	const rendered = renderDatacentersTab(snapshot, 0).join("\n");
	assert.match(rendered, /Datacenters \(1\)/);
	assert.match(rendered, /> dc-1/);
	assert.match(rendered, /Rack grid/);
	assert.match(rendered, /\[C1\]/);
});
