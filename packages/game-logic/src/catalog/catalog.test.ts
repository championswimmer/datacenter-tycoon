import assert from "node:assert/strict";
import test from "node:test";

import { DATACENTER_CATALOG } from "./datacenters.js";
import { RACK_CATALOG } from "./racks.js";
import {
	BALANCE_VERSION,
	BANDWIDTH_USD_PER_GBPS_MONTH,
	COOLING_OVERHEAD_RATIO,
	ELECTRICITY_USD_PER_KWH,
	HOURS_PER_MONTH,
	MARKET_REFRESH_SIZE,
	STARTING_CASH,
} from "../economy/constants.js";

const rackKindByPrefix = {
	C: "compute",
	M: "memory",
	S: "storage",
	G: "gpu",
} as const;

test("rack catalog contains all 12 starter rack SKUs", () => {
	assert.equal(Object.keys(RACK_CATALOG).length, 12);
	assert.deepEqual(Object.keys(RACK_CATALOG).sort(), [
		"C1",
		"C2",
		"C3",
		"G1",
		"G2",
		"G3",
		"M1",
		"M2",
		"M3",
		"S1",
		"S2",
		"S3",
	]);
});

test("rack specs expose positive numeric fields and IDs line up with keys", () => {
	const seenIds = new Set<string>();

	for (const [key, rack] of Object.entries(RACK_CATALOG)) {
		assert.equal(rack.id, key);
		assert.equal(rack.name.length > 0, true);
		assert.equal(seenIds.has(rack.id), false);
		seenIds.add(rack.id);

		assert.match(key, /^[CGMS][123]$/);
		assert.equal(rack.kind, rackKindByPrefix[key[0] as keyof typeof rackKindByPrefix]);
		assert.equal(rack.tier, Number(key[1]));

		assert.ok(rack.vCpu > 0);
		assert.ok(rack.ramGb > 0);
		assert.ok(rack.storageTb > 0);
		assert.ok(rack.powerDrawKw > 0);
		assert.ok(rack.heatOutputBtuPerHr > 0);
		assert.ok(rack.bandwidthGbps > 0);
		assert.ok(rack.capexCost > 0);
		assert.ok(rack.monthlyMaintenance > 0);
	}
});

test("only GPU racks expose GPU FLOPS", () => {
	for (const rack of Object.values(RACK_CATALOG)) {
		if (rack.kind === "gpu") {
			assert.ok(rack.gpuFlops > 0);
		} else {
			assert.equal(rack.gpuFlops, 0);
		}
	}
});

test("tier progression increases heat and primary output within each rack family", () => {
	for (const family of ["C", "M", "S", "G"] as const) {
		const tier1 = RACK_CATALOG[`${family}1`];
		const tier2 = RACK_CATALOG[`${family}2`];
		const tier3 = RACK_CATALOG[`${family}3`];

		assert.ok(tier2.heatOutputBtuPerHr > tier1.heatOutputBtuPerHr);
		assert.ok(tier3.heatOutputBtuPerHr > tier2.heatOutputBtuPerHr);
		assert.ok(tier3.capexCost > tier2.capexCost);
		assert.ok(tier2.capexCost > tier1.capexCost);

		switch (family) {
			case "C":
				assert.ok(tier2.vCpu > tier1.vCpu);
				assert.ok(tier3.vCpu > tier2.vCpu);
				break;
			case "M":
				assert.ok(tier2.ramGb > tier1.ramGb);
				assert.ok(tier3.ramGb > tier2.ramGb);
				break;
			case "S":
				assert.ok(tier2.storageTb > tier1.storageTb);
				assert.ok(tier3.storageTb > tier2.storageTb);
				break;
			case "G":
				assert.ok(tier2.gpuFlops > tier1.gpuFlops);
				assert.ok(tier3.gpuFlops > tier2.gpuFlops);
				break;
		}
	}
});

test("tier-3 racks exceed any air-cooled datacenter per-slot cooling budget", () => {
	const airCooledPerSlotBudgets = Object.values(DATACENTER_CATALOG)
		.filter((datacenter) => datacenter.coolingType === "air")
		.map((datacenter) => datacenter.coolingCapacityBtuPerHr / (datacenter.rows * datacenter.positionsPerRow));
	const strongestAirBudgetPerSlot = Math.max(...airCooledPerSlotBudgets);

	for (const rack of Object.values(RACK_CATALOG).filter((rack) => rack.tier === 3)) {
		assert.ok(rack.heatOutputBtuPerHr > strongestAirBudgetPerSlot);
	}
});

test("datacenter catalog exposes three starter blueprints with sane capacities", () => {
	assert.deepEqual(Object.keys(DATACENTER_CATALOG).sort(), ["garage", "hyperscale", "warehouse"]);

	const seenIds = new Set<string>();
	for (const [key, datacenter] of Object.entries(DATACENTER_CATALOG)) {
		assert.equal(datacenter.id, key);
		assert.equal(datacenter.name.length > 0, true);
		assert.equal(seenIds.has(datacenter.id), false);
		seenIds.add(datacenter.id);

		assert.ok(datacenter.rows > 0);
		assert.ok(datacenter.positionsPerRow > 0);
		assert.ok(datacenter.rows * datacenter.positionsPerRow >= 4);
		assert.ok(datacenter.powerCapacityKw > 0);
		assert.ok(datacenter.coolingCapacityBtuPerHr > 0);
		assert.ok(datacenter.bandwidthGbps > 0);
		assert.ok(datacenter.capexCost > 0);
		assert.ok(datacenter.monthlyStaffCost > 0);
	}

	assert.equal(DATACENTER_CATALOG.garage.coolingType, "air");
	assert.equal(DATACENTER_CATALOG.warehouse.coolingType, "air");
	assert.equal(DATACENTER_CATALOG.hyperscale.coolingType, "liquid");
});

test("economy constants are positive and within expected ranges", () => {
	assert.equal(BALANCE_VERSION, 1);
	assert.ok(ELECTRICITY_USD_PER_KWH > 0);
	assert.equal(HOURS_PER_MONTH, 730);
	assert.ok(BANDWIDTH_USD_PER_GBPS_MONTH > 0);
	assert.ok(COOLING_OVERHEAD_RATIO > 0 && COOLING_OVERHEAD_RATIO < 1);
	assert.ok(STARTING_CASH > DATACENTER_CATALOG.garage.capexCost);
	assert.ok(MARKET_REFRESH_SIZE >= 3);
});
