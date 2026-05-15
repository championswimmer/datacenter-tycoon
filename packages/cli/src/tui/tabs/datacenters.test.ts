import assert from "node:assert/strict";
import test from "node:test";

import { DATACENTER_CATALOG, newGame, reduce, RACK_CATALOG } from "@datacenter-tycoon/game-logic";

import { renderDatacentersTab } from "./datacenters.js";

test("renderDatacentersTab shows the list and rack grid for the selected datacenter", () => {
	let snapshot = newGame(1, { startingCash: 3_000_000 });
	const firstRegionId = snapshot.map.regions[0]!.id;
	snapshot = reduce(snapshot, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId: "dc-1" as never,
		regionId: firstRegionId,
	});
	snapshot = reduce(snapshot, {
		type: "PlaceRack",
		dcId: "dc-1" as never,
		specId: RACK_CATALOG.C1.id,
		row: 0,
		position: 0,
		placementId: "rp-1" as never,
	});

	const rendered = renderDatacentersTab(snapshot, 0).join("\n");
	assert.match(rendered, /Datacenters \(1\)/);
	assert.match(rendered, /> dc-1/);
	assert.match(rendered, /Rack grid/);
	assert.match(rendered, /\[C1\]/);
});

test("renderDatacentersTab shows effective infrastructure and upgrade summary for selected datacenter", () => {
	let snapshot = newGame(1, { startingCash: 3_000_000 });
	const firstRegionId = snapshot.map.regions[0]!.id;
	snapshot = reduce(snapshot, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId: "dc-1" as never,
		regionId: firstRegionId,
	});
	snapshot = reduce(snapshot, {
		type: "UpgradeDatacenter",
		dcId: "dc-1" as never,
		trackId: "cooling",
		targetNodeId: "hybrid",
	});

	const rendered = renderDatacentersTab(snapshot, 0).join("\n");
	assert.match(rendered, /Power 60kW \(60 grid \+ 0 onsite\)/, "should show grid\/onsite split");
	assert.match(rendered, /Cooling 250000 BTU\/h \(hybrid\)/, "should show effective cooling mode");
	assert.match(rendered, /Fabric NOT READY/, "should show fabric status");
	assert.match(rendered, /Tracks: cooling hybrid/, "should show upgrade track summary");
});

test("renderDatacentersTab shows maintenance staffing summary for selected datacenter", () => {
	let snapshot = newGame(1, { startingCash: 3_000_000 });
	const firstRegionId = snapshot.map.regions[0]!.id;
	snapshot = reduce(snapshot, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId: "dc-1" as never,
		regionId: firstRegionId,
	});

	const rendered = renderDatacentersTab(snapshot, 0).join("\n");
	assert.match(rendered, /Maintenance:/, "should show maintenance summary");
	assert.match(rendered, /staff/, "should show staff count");
	assert.match(rendered, /Repair speed/, "should show repair speed");
	assert.match(rendered, /Repairing:/, "should show repairing rack count");
	assert.match(rendered, /Avg age/, "should show average rack age");
});

test("renderDatacentersTab shows updated maintenance staff count after SetMaintenanceStaff", () => {
	let snapshot = newGame(1, { startingCash: 3_000_000 });
	const firstRegionId = snapshot.map.regions[0]!.id;
	snapshot = reduce(snapshot, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId: "dc-1" as never,
		regionId: firstRegionId,
	});
	snapshot = reduce(snapshot, {
		type: "SetMaintenanceStaff",
		dcId: "dc-1" as never,
		maintenanceStaff: 3,
	});

	const rendered = renderDatacentersTab(snapshot, 0).join("\n");
	assert.match(rendered, /3\/\d+ staff/, "should show updated staff count");
});

test("renderDatacentersTab shows hire/fire keybind hints", () => {
	let snapshot = newGame(1, { startingCash: 3_000_000 });
	const firstRegionId = snapshot.map.regions[0]!.id;
	snapshot = reduce(snapshot, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId: "dc-1" as never,
		regionId: firstRegionId,
	});

	const rendered = renderDatacentersTab(snapshot, 0).join("\n");
	assert.match(rendered, /\+ hire maint/, "should show + hire hint");
	assert.match(rendered, /- fire maint/, "should show - fire hint");
});

test("renderDatacentersTab with no datacenters shows empty message", () => {
	const snapshot = newGame(1, { startingCash: 3_000_000 });
	const rendered = renderDatacentersTab(snapshot, 0).join("\n");
	assert.match(rendered, /No datacenters yet/);
});
