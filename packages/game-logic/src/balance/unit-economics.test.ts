import assert from "node:assert/strict";
import test from "node:test";

import { DATACENTER_CATALOG } from "../catalog/datacenters.js";
import { createUnitEconomicsAudit } from "./unit-economics.js";

test("unit economics audit reports the current deterministic rack and contract baseline", () => {
	const audit = createUnitEconomicsAudit();
	const c1 = audit.racks.find((rack) => rack.rackId === "C1");
	const m1 = audit.racks.find((rack) => rack.rackId === "M1");
	const s1 = audit.racks.find((rack) => rack.rackId === "S1");

	assert.ok(c1, "expected C1 rack snapshot");
	assert.ok(m1, "expected M1 rack snapshot");
	assert.ok(s1, "expected S1 rack snapshot");

	assert.deepEqual(audit.pricing.difficulties, [0.2, 0.35, 0.5, 0.65, 0.8]);
	assert.equal(audit.pricing.samplesPerDifficulty, 24);
	assert.equal(audit.pricing.totalSamples, 120);
	assert.equal(audit.pricing.baseMonthlyFee, 5_000);
	assert.equal(audit.pricing.averageMarginalMultiplier, 0.895);
	assert.deepEqual(audit.pricing.averageMarginalPayoutPerUnit, {
		vCpu: 35.803,
		ramGb: 1.611,
		storageTb: 22.377,
		gpuFlops: 31.328,
	});
	assert.equal(audit.pricing.averageMonthlyPayment, 38_673.33);

	assert.equal(audit.cheapestFacilitySlotBaseline.datacenterId, DATACENTER_CATALOG.warehouse.id);
	assert.equal(audit.cheapestFacilitySlotBaseline.regionId, "sa_east");
	assert.equal(audit.cheapestFacilitySlotBaseline.monthlyOpexPerSlot, 1_550);

	assert.equal(c1.cheapestRackOnlyRegionId, "us_west");
	assert.equal(c1.capexPerUnit.vCpu, 390.625);
	assert.equal(c1.rackOnlyOpexPerUnit.vCpu, 4.608);
	assert.equal(c1.facilityLoadedOpexPerUnit.vCpu, 16.717);
	assert.equal(c1.grossMarginPerPrimaryUnit, 19.086);
	assert.equal(c1.paybackMonths, 20.467);

	assert.equal(m1.capexPerUnit.ramGb, 31.738);
	assert.equal(m1.rackOnlyOpexPerUnit.ramGb, 0.342);
	assert.equal(m1.facilityLoadedOpexPerUnit.ramGb, 1.099);
	assert.equal(m1.grossMarginPerPrimaryUnit, 0.512);
	assert.equal(m1.paybackMonths, 61.989);

	assert.equal(s1.capexPerUnit.storageTb, 160);
	assert.equal(s1.rackOnlyOpexPerUnit.storageTb, 1.584);
	assert.equal(s1.facilityLoadedOpexPerUnit.storageTb, 4.684);
	assert.equal(s1.grossMarginPerPrimaryUnit, 17.693);
	assert.equal(s1.paybackMonths, 9.043);
});
