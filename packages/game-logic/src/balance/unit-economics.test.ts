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
		vCpu: 78.319,
		ramGb: 3.289,
		storageTb: 37.593,
		gpuFlops: 61.089,
	});
	assert.equal(audit.pricing.averageMonthlyPayment, 72_853.33);

	assert.equal(audit.cheapestFacilitySlotBaseline.datacenterId, DATACENTER_CATALOG.warehouse.id);
	assert.equal(audit.cheapestFacilitySlotBaseline.regionId, "sa_east");
	assert.equal(audit.cheapestFacilitySlotBaseline.monthlyOpexPerSlot, 1_077.5);
	assert.equal(audit.mostExpensiveFacilitySlotBaseline.datacenterId, DATACENTER_CATALOG.hyperscale.id);
	assert.equal(audit.mostExpensiveFacilitySlotBaseline.regionId, "us_east");
	assert.equal(audit.mostExpensiveFacilitySlotBaseline.monthlyOpexPerSlot, 3_587.5);
	assert.deepEqual(
		audit.regionalOpex.map((region) => ({
			regionId: region.regionId,
			power: region.powerCostPerKwh,
			staff: region.staffWage,
			garage: region.garageBaseline.monthlyOpexPerSlot,
			warehouse: region.warehouseBaseline.monthlyOpexPerSlot,
			cheapest: region.cheapestFacilityBaseline.monthlyOpexPerSlot,
		})),
		[
			{ regionId: "sa_east", power: 0.13, staff: 2_275, garage: 1_134.38, warehouse: 1_077.5, cheapest: 1_077.5 },
			{ regionId: "me_central", power: 0.09, staff: 4_225, garage: 1_378.13, warehouse: 1_272.5, cheapest: 1_272.5 },
			{ regionId: "ap_northeast", power: 0.16, staff: 5_070, garage: 1_483.75, warehouse: 1_357, cheapest: 1_357 },
			{ regionId: "ap_southeast", power: 0.18, staff: 5_200, garage: 1_500, warehouse: 1_370, cheapest: 1_370 },
			{ regionId: "eu_west", power: 0.18, staff: 5_850, garage: 1_581.25, warehouse: 1_435, cheapest: 1_435 },
			{ regionId: "eu_central", power: 0.17, staff: 5_980, garage: 1_597.5, warehouse: 1_448, cheapest: 1_448 },
			{ regionId: "us_west", power: 0.06, staff: 6_175, garage: 1_621.88, warehouse: 1_467.5, cheapest: 1_467.5 },
			{ regionId: "us_east", power: 0.08, staff: 6_500, garage: 1_662.5, warehouse: 1_500, cheapest: 1_500 },
		],
	);

	assert.equal(c1.cheapestRackOnlyRegionId, "us_west");
	assert.equal(c1.capexPerUnit.vCpu, 390.625);
	assert.equal(c1.rackOnlyOpexPerUnit.vCpu, 4.193);
	assert.equal(c1.facilityLoadedOpexPerUnit.vCpu, 13.856);
	assert.equal(c1.grossMarginPerPrimaryUnit, 64.463);
	assert.equal(c1.paybackMonths, 6.06);

	assert.equal(m1.capexPerUnit.ramGb, 31.738);
	assert.equal(m1.rackOnlyOpexPerUnit.ramGb, 0.317);
	assert.equal(m1.facilityLoadedOpexPerUnit.ramGb, 0.917);
	assert.equal(m1.grossMarginPerPrimaryUnit, 2.372);
	assert.equal(m1.paybackMonths, 13.38);

	assert.equal(s1.capexPerUnit.storageTb, 124);
	assert.equal(s1.rackOnlyOpexPerUnit.storageTb, 6.219);
	assert.equal(s1.facilityLoadedOpexPerUnit.storageTb, 8.629);
	assert.equal(s1.grossMarginPerPrimaryUnit, 28.964);
	assert.equal(s1.paybackMonths, 4.281);
});

test("contract pricing rebalance clears the target bands without over-buffing storage", () => {
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
		minimumStoragePaybackMonths: 4,
		minimumStorageToFastestNonStoragePaybackRatio: 0.65,
	});
	assert.equal(evaluation.allSatisfied, true);
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
		memory: true,
		storage: true,
	});
	assert.deepEqual(evaluation.maximumPaybackMonthsMet, {
		compute: true,
		memory: true,
	});
	assert.equal(evaluation.minimumStoragePaybackMonthsMet, true);
	assert.equal(evaluation.storagePaybackVsFastestNonStorageRatio, 0.706);
	assert.equal(evaluation.storagePaybackRatioMet, true);
});

test("candidate pricing directions show the chosen weights are the smallest viable uplift", () => {
	const candidates = {
		chosen: createUnitEconomicsAudit({
			pricing: { baseMonthlyFee: 5_000, weights: { vCpu: 50, ramGb: 2.1, storageTb: 24, gpuFlops: 39 } },
		}),
		mild: createUnitEconomicsAudit({
			pricing: { baseMonthlyFee: 5_000, weights: { vCpu: 54, ramGb: 2.4, storageTb: 24, gpuFlops: 41 } },
		}),
		medium: createUnitEconomicsAudit({
			pricing: { baseMonthlyFee: 5_500, weights: { vCpu: 54, ramGb: 2.5, storageTb: 24, gpuFlops: 41 } },
		}),
		aggressive: createUnitEconomicsAudit({
			pricing: { baseMonthlyFee: 6_000, weights: { vCpu: 56, ramGb: 2.6, storageTb: 25, gpuFlops: 43 } },
		}),
	};
	const chosenEvaluation = evaluateUnitEconomicsTargets(candidates.chosen);
	const mildEvaluation = evaluateUnitEconomicsTargets(candidates.mild);
	const mediumEvaluation = evaluateUnitEconomicsTargets(candidates.medium);
	const aggressiveEvaluation = evaluateUnitEconomicsTargets(candidates.aggressive);

	assert.equal(candidates.chosen.pricing.averageMonthlyPayment, 72_853.33);
	assert.equal(candidates.mild.pricing.averageMonthlyPayment, 76_155.83);
	assert.equal(candidates.medium.pricing.averageMonthlyPayment, 77_348.33);
	assert.equal(candidates.aggressive.pricing.averageMonthlyPayment, 81_153.33);
	assert.ok(candidates.chosen.pricing.averageMonthlyPayment < candidates.mild.pricing.averageMonthlyPayment);
	assert.ok(candidates.mild.pricing.averageMonthlyPayment < candidates.medium.pricing.averageMonthlyPayment);
	assert.ok(candidates.medium.pricing.averageMonthlyPayment < candidates.aggressive.pricing.averageMonthlyPayment);
	assert.equal(chosenEvaluation.allSatisfied, true);
	assert.equal(mildEvaluation.allSatisfied, true);
	assert.equal(mediumEvaluation.allSatisfied, true);
	assert.equal(aggressiveEvaluation.allSatisfied, true);
	assert.ok(candidates.chosen.pricing.averageMarginalPayoutPerUnit.vCpu > candidates.aggressive.pricing.averageMarginalPayoutPerUnit.storageTb);
	assert.ok(candidates.chosen.pricing.averageMarginalPayoutPerUnit.ramGb > 3.0);
	assert.ok(candidates.chosen.pricing.averageMarginalPayoutPerUnit.storageTb < 40.0);
});
