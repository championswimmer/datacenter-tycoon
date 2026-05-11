import assert from "node:assert/strict";
import test from "node:test";

import { DATACENTER_CATALOG } from "../catalog/datacenters.js";
import { RACK_CATALOG } from "../catalog/racks.js";
import { MAX_MAINTENANCE_STAFF, DAYS_PER_TICK, BASE_REPAIR_SPEED_MULTIPLIER, REPAIR_SPEED_BONUS_PER_MAINTENANCE_STAFF } from "../balance/index.js";
import type { Datacenter, RackPlacement, Region } from "../types.js";
import {
	canMoveRack,
	datacenterMaintenanceStaffingView,
	resolveDatacenterInfrastructure,
	resolveDatacenterUpgradeEconomics,
	resolveDatacenterUpgradeState,
} from "./datacenter.js";

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

function makeRegion(overrides: Partial<Region> = {}): Region {
	return {
		id: "us_west" as import("../types.js").RegionId,
		name: "US West",
		code: "US-W",
		city: "San Francisco",
		coordinates: { x: 0, y: 0 },
		powerCostPerKwh: 0.1,
		staffWage: 5000,
		taxRate: 0.05,
		totalPowerAvailable: 10000,
		totalStaffAvailable: 50,
		powerUsed: 0,
		staffUsed: 0,
		...overrides,
	};
}

test("upgrade resolvers derive default track state, effective infrastructure, and economics", () => {
	const datacenter = makeDatacenter("dc-1");
	const state = resolveDatacenterUpgradeState(datacenter);
	const infrastructure = resolveDatacenterInfrastructure(datacenter);
	const economics = resolveDatacenterUpgradeEconomics(datacenter);

	assert.equal(state.fabricEligible, false);
	assert.equal(state.tracks.find((track) => track.trackId === "cooling")?.currentNode.id, "air");
	assert.equal(state.tracks.find((track) => track.trackId === "networkType")?.nextNode?.id, "cat8");
	assert.equal(state.tracks.find((track) => track.trackId === "onsiteGeneration")?.currentNode.id, "gen-0");
	assert.deepEqual(infrastructure, {
		gridImportCapacityKw: DATACENTER_CATALOG.garage.powerCapacityKw,
		onsiteGenerationCapacityKw: 0,
		rackPowerCapacityKw: DATACENTER_CATALOG.garage.powerCapacityKw,
		coolingCapacityBtuPerHr: DATACENTER_CATALOG.garage.coolingCapacityBtuPerHr,
		coolingType: DATACENTER_CATALOG.garage.coolingType,
		networkType: DATACENTER_CATALOG.garage.networkType,
		bandwidthGbps: DATACENTER_CATALOG.garage.bandwidthGbps,
	});
	assert.deepEqual(economics, {
		fixedMonthly: 0,
		byTrack: { cooling: 0, networkType: 0, onsiteGeneration: 0 },
	});
});

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

// ── datacenterMaintenanceStaffingView tests ────────────────────────────────

test("datacenterMaintenanceStaffingView: defaults with 0 staff", () => {
	const dc = makeDatacenter("dc-1");
	const region = makeRegion();
	const view = datacenterMaintenanceStaffingView(dc, region, [dc], tick(0));

	assert.equal(view.dcId, dc.id);
	assert.equal(view.currentStaff, 0);
	assert.equal(view.maxStaff, MAX_MAINTENANCE_STAFF);
	assert.equal(view.canDecrease, false);
	assert.equal(view.staffWagePerHead, 4_000);
	assert.equal(view.extraWagesMonthly, 0);
	assert.equal(view.repairingRackCount, 0);
	assert.equal(view.totalRackCount, 0);
	assert.equal(view.averageRackAgeMonths, 0);
	// repair speed with 0 extra staff = base multiplier * DAYS_PER_TICK
	assert.equal(view.repairSpeedDaysPerTick, DAYS_PER_TICK * BASE_REPAIR_SPEED_MULTIPLIER);
});

test("datacenterMaintenanceStaffingView: with 2 maintenance staff", () => {
	const dc = { ...makeDatacenter("dc-1"), maintenanceStaff: 2 };
	const region = makeRegion();
	const view = datacenterMaintenanceStaffingView(dc, region, [dc], tick(0));

	assert.equal(view.currentStaff, 2);
	assert.equal(view.canDecrease, true);
	assert.equal(view.extraWagesMonthly, 8_000);
	assert.equal(view.staffWagePerHead, 4_000);
	// repair speed: (base + 2 * bonus) * DAYS_PER_TICK
	const expectedSpeed = (BASE_REPAIR_SPEED_MULTIPLIER + 2 * REPAIR_SPEED_BONUS_PER_MAINTENANCE_STAFF) * DAYS_PER_TICK;
	assert.equal(view.repairSpeedDaysPerTick, expectedSpeed);
});

test("datacenterMaintenanceStaffingView: canIncrease false when at max staff cap", () => {
	const dc = { ...makeDatacenter("dc-1"), maintenanceStaff: MAX_MAINTENANCE_STAFF };
	const region = makeRegion({ totalStaffAvailable: 999 }); // plenty of regional labor
	const view = datacenterMaintenanceStaffingView(dc, region, [dc], tick(0));

	assert.equal(view.currentStaff, MAX_MAINTENANCE_STAFF);
	assert.equal(view.canIncrease, false); // capped by maxStaff
});

test("datacenterMaintenanceStaffingView: canIncrease false when regional labor exhausted", () => {
	// garage spec has staffCount = 2; plus 1 maintenanceStaff = 3 total
	const dc = { ...makeDatacenter("dc-1"), maintenanceStaff: 1 };
	// totalStaffAvailable exactly equal to staffUsed → availableRegionalStaff = 0
	const region = makeRegion({ totalStaffAvailable: dc.spec.staffCount + dc.maintenanceStaff });
	const view = datacenterMaintenanceStaffingView(dc, region, [dc], tick(0));

	assert.equal(view.availableRegionalStaff, 0);
	assert.equal(view.canIncrease, false);
});

test("datacenterMaintenanceStaffingView: canIncrease true when below cap with spare regional staff", () => {
	const dc = { ...makeDatacenter("dc-1"), maintenanceStaff: 1 };
	const region = makeRegion({ totalStaffAvailable: 50 }); // plenty of spare
	const view = datacenterMaintenanceStaffingView(dc, region, [dc], tick(0));

	assert.equal(view.canIncrease, true);
	assert.ok(view.availableRegionalStaff > 0);
});

test("datacenterMaintenanceStaffingView: computes averageRackAgeMonths from placements", () => {
	const placement1 = { ...makePlacement("rack-1", "C1", 0, 0), installedAtTick: tick(0) };
	const placement2 = { ...makePlacement("rack-2", "C1", 0, 1), installedAtTick: tick(0) };
	const dc = makeDatacenter("dc-1", [placement1, placement2]);
	const region = makeRegion();
	const view = datacenterMaintenanceStaffingView(dc, region, [dc], tick(12));

	assert.equal(view.totalRackCount, 2);
	assert.equal(view.averageRackAgeMonths, 12);
});

test("datacenterMaintenanceStaffingView: counts repairing racks correctly", () => {
	const healthy = makePlacement("rack-1", "C1", 0, 0);
	const repairing = { ...makePlacement("rack-2", "C1", 0, 1), health: "repairing" as const, repairProgressDays: 30 };
	const dc = makeDatacenter("dc-1", [healthy, repairing]);
	const region = makeRegion();
	const view = datacenterMaintenanceStaffingView(dc, region, [dc], tick(0));

	assert.equal(view.repairingRackCount, 1);
	assert.equal(view.totalRackCount, 2);
});
