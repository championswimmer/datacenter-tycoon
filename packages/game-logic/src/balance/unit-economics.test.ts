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
	assert.equal(audit.cheapestFacilitySlotBaseline.monthlyOpexPerSlot, 1_550);

	assert.equal(c1.cheapestRackOnlyRegionId, "us_west");
	assert.equal(c1.capexPerUnit.vCpu, 390.625);
	assert.equal(c1.rackOnlyOpexPerUnit.vCpu, 4.608);
	assert.equal(c1.facilityLoadedOpexPerUnit.vCpu, 16.717);
	assert.equal(c1.grossMarginPerPrimaryUnit, 28.037);
	assert.equal(c1.paybackMonths, 13.932);

	assert.equal(m1.capexPerUnit.ramGb, 31.738);
	assert.equal(m1.rackOnlyOpexPerUnit.ramGb, 0.342);
	assert.equal(m1.facilityLoadedOpexPerUnit.ramGb, 1.099);
	assert.equal(m1.grossMarginPerPrimaryUnit, 0.781);
	assert.equal(m1.paybackMonths, 40.638);

	assert.equal(s1.capexPerUnit.storageTb, 124);
	assert.equal(s1.rackOnlyOpexPerUnit.storageTb, 6.304);
	assert.equal(s1.facilityLoadedOpexPerUnit.storageTb, 9.404);
	assert.equal(s1.grossMarginPerPrimaryUnit, 12.078);
	assert.equal(s1.paybackMonths, 10.267);
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
	assert.equal(evaluation.storagePaybackVsFastestNonStorageRatio, 0.728);
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
