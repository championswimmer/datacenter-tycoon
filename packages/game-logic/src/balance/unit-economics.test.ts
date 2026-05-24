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
		vCpu: 44.754,
		ramGb: 1.88,
		storageTb: 21.482,
		gpuFlops: 34.908,
	});
	assert.equal(audit.pricing.averageMonthlyPayment, 41_631.67);

	assert.equal(audit.cheapestFacilitySlotBaseline.datacenterId, DATACENTER_CATALOG.warehouse.id);
	assert.equal(audit.cheapestFacilitySlotBaseline.regionId, "sa_east");
	assert.equal(audit.cheapestFacilitySlotBaseline.monthlyOpexPerSlot, 1_305);
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
			{ regionId: "sa_east", power: 0.13, staff: 2_275, garage: 1_418.75, warehouse: 1_305, cheapest: 1_305 },
			{ regionId: "me_central", power: 0.09, staff: 4_225, garage: 1_906.25, warehouse: 1_695, cheapest: 1_695 },
			{ regionId: "ap_northeast", power: 0.16, staff: 5_070, garage: 2_117.5, warehouse: 1_864, cheapest: 1_864 },
			{ regionId: "ap_southeast", power: 0.18, staff: 5_200, garage: 2_150, warehouse: 1_890, cheapest: 1_890 },
			{ regionId: "eu_west", power: 0.18, staff: 5_850, garage: 2_312.5, warehouse: 2_020, cheapest: 2_020 },
			{ regionId: "eu_central", power: 0.17, staff: 5_980, garage: 2_345, warehouse: 2_046, cheapest: 2_046 },
			{ regionId: "us_west", power: 0.06, staff: 6_175, garage: 2_393.75, warehouse: 2_085, cheapest: 2_085 },
			{ regionId: "us_east", power: 0.08, staff: 6_500, garage: 2_475, warehouse: 2_150, cheapest: 2_150 },
		],
	);

	assert.equal(c1.cheapestRackOnlyRegionId, "us_west");
	assert.equal(c1.capexPerUnit.vCpu, 390.625);
	assert.equal(c1.rackOnlyOpexPerUnit.vCpu, 4.904);
	assert.equal(c1.facilityLoadedOpexPerUnit.vCpu, 17.176);
	assert.equal(c1.grossMarginPerPrimaryUnit, 27.578);
	assert.equal(c1.paybackMonths, 14.164);

	assert.equal(m1.capexPerUnit.ramGb, 31.738);
	assert.equal(m1.rackOnlyOpexPerUnit.ramGb, 0.36);
	assert.equal(m1.facilityLoadedOpexPerUnit.ramGb, 1.12);
	assert.equal(m1.grossMarginPerPrimaryUnit, 0.76);
	assert.equal(m1.paybackMonths, 41.761);

	assert.equal(s1.capexPerUnit.storageTb, 124);
	assert.equal(s1.rackOnlyOpexPerUnit.storageTb, 6.364);
	assert.equal(s1.facilityLoadedOpexPerUnit.storageTb, 9.4);
	assert.equal(s1.grossMarginPerPrimaryUnit, 12.082);
	assert.equal(s1.paybackMonths, 10.263);
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
		minimumStoragePaybackMonths: 10,
		minimumStorageToFastestNonStoragePaybackRatio: 0.7,
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
	assert.equal(evaluation.storagePaybackVsFastestNonStorageRatio, 0.725);
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

	assert.equal(candidates.chosen.pricing.averageMonthlyPayment, 41_631.67);
	assert.equal(candidates.mild.pricing.averageMonthlyPayment, 43_511.67);
	assert.equal(candidates.medium.pricing.averageMonthlyPayment, 44_199.17);
	assert.equal(candidates.aggressive.pricing.averageMonthlyPayment, 46_368.33);
	assert.ok(candidates.chosen.pricing.averageMonthlyPayment < candidates.mild.pricing.averageMonthlyPayment);
	assert.ok(candidates.mild.pricing.averageMonthlyPayment < candidates.medium.pricing.averageMonthlyPayment);
	assert.ok(candidates.medium.pricing.averageMonthlyPayment < candidates.aggressive.pricing.averageMonthlyPayment);
	assert.equal(chosenEvaluation.allSatisfied, true);
	assert.equal(mildEvaluation.allSatisfied, true);
	assert.equal(mediumEvaluation.allSatisfied, true);
	assert.equal(aggressiveEvaluation.allSatisfied, false);
	assert.equal(aggressiveEvaluation.minimumStoragePaybackMonthsMet, false);
	assert.ok(candidates.chosen.pricing.averageMarginalPayoutPerUnit.vCpu > candidates.aggressive.pricing.averageMarginalPayoutPerUnit.storageTb);
	assert.ok(candidates.chosen.pricing.averageMarginalPayoutPerUnit.ramGb > 1.611);
	assert.ok(candidates.chosen.pricing.averageMarginalPayoutPerUnit.storageTb < 22.377);
});
