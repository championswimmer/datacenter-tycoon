import assert from "node:assert/strict";
import test from "node:test";

import { DATACENTER_CATALOG } from "../catalog/datacenters.js";
import { UNIT_ECONOMICS_TARGET_BANDS, createUnitEconomicsAudit, evaluateUnitEconomicsTargets } from "./unit-economics.js";

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

	assert.equal(s1.capexPerUnit.storageTb, 124);
	assert.equal(s1.rackOnlyOpexPerUnit.storageTb, 6.304);
	assert.equal(s1.facilityLoadedOpexPerUnit.storageTb, 9.404);
	assert.equal(s1.grossMarginPerPrimaryUnit, 12.973);
	assert.equal(s1.paybackMonths, 9.558);
});

test("unit economics targets capture the remaining skew after storage maintenance tuning", () => {
	const evaluation = evaluateUnitEconomicsTargets(createUnitEconomicsAudit());

	assert.deepEqual(UNIT_ECONOMICS_TARGET_BANDS, {
		minimumGrossMarginPerPrimaryUnit: {
			compute: 15,
			memory: 0.7,
			storage: 12,
		},
		maximumPaybackMonths: {
			compute: 24,
			memory: 45,
		},
		minimumStoragePaybackMonths: 10,
		minimumStorageToFastestNonStoragePaybackRatio: 0.7,
	});
	assert.equal(evaluation.allSatisfied, false);
	assert.deepEqual(evaluation.sameTierStorageCapexBelowMemory, {
		0: true,
		1: true,
		2: true,
		3: true,
	});
	assert.deepEqual(evaluation.storageCheapestCapexPerTbByTier, {
		0: true,
		1: true,
		2: true,
		3: true,
	});
	assert.deepEqual(evaluation.storageCheapestRackOnlyOpexPerTbByTier, {
		0: true,
		1: true,
		2: true,
		3: true,
	});
	assert.deepEqual(evaluation.storageCheapestFacilityLoadedOpexPerTbByTier, {
		0: true,
		1: true,
		2: true,
		3: true,
	});
	assert.deepEqual(evaluation.minimumGrossMarginPerPrimaryUnitMet, {
		compute: true,
		memory: false,
		storage: true,
	});
	assert.deepEqual(evaluation.maximumPaybackMonthsMet, {
		compute: true,
		memory: false,
	});
	assert.equal(evaluation.minimumStoragePaybackMonthsMet, false);
	assert.equal(evaluation.storagePaybackVsFastestNonStorageRatio, 0.5);
	assert.equal(evaluation.storagePaybackRatioMet, false);
});
