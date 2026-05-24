import assert from "node:assert/strict";
import test from "node:test";

import { createRebalanceScenarioValidationReport } from "./scenario-validation.js";

test("rebalance scenario validation reports deterministic before/after economics", () => {
	const report = createRebalanceScenarioValidationReport();

	assert.deepEqual(report.legacyPricing, {
		baseMonthlyFee: 5_000,
		weights: {
			vCpu: 40,
			ramGb: 1.8,
			storageTb: 25,
			gpuFlops: 35,
		},
	});
	assert.deepEqual(report.rebalancedPricing, {
		baseMonthlyFee: 5_000,
		weights: {
			vCpu: 50,
			ramGb: 2.1,
			storageTb: 24,
			gpuFlops: 39,
		},
	});
	assert.deepEqual(
		report.scenarios.map(({ scenario, legacy, rebalanced }) => ({
			id: scenario.id,
			legacy: {
				totalCapex: legacy.totalCapex,
				activeMargin: legacy.activeMargin,
				paybackMonths: legacy.paybackMonths,
				cashAfterOneIdleMonth: legacy.cashAfterOneIdleMonth,
			},
			rebalanced: {
				totalCapex: rebalanced.totalCapex,
				activeMargin: rebalanced.activeMargin,
				paybackMonths: rebalanced.paybackMonths,
				cashAfterOneIdleMonth: rebalanced.cashAfterOneIdleMonth,
			},
		})),
		[
			{
				id: "starter-garage-mixed",
				legacy: {
					totalCapex: 445_000,
					activeMargin: 3_682.93,
					paybackMonths: 120.828,
					cashAfterOneIdleMonth: 2_039_343.91,
				},
				rebalanced: {
					totalCapex: 427_000,
					activeMargin: 3_822.93,
					paybackMonths: 111.694,
					cashAfterOneIdleMonth: 2_054_983.91,
				},
			},
			{
				id: "warehouse-storage-heavy",
				legacy: {
					totalCapex: 2_040_000,
					activeMargin: 41_921.73,
					paybackMonths: 48.662,
					cashAfterOneIdleMonth: 392_090.43,
				},
				rebalanced: {
					totalCapex: 1_896_000,
					activeMargin: 21_641.73,
					paybackMonths: 87.609,
					cashAfterOneIdleMonth: 517_210.43,
				},
			},
			{
				id: "garage-oltp-edge",
				legacy: {
					totalCapex: 480_000,
					activeMargin: 6_119.78,
					paybackMonths: 78.434,
					cashAfterOneIdleMonth: 1_999_608.16,
				},
				rebalanced: {
					totalCapex: 480_000,
					activeMargin: 10_519.78,
					paybackMonths: 45.628,
					cashAfterOneIdleMonth: 1_999_608.16,
				},
			},
		],
	);
});

test("rebalance scenario validation improves survivability without making storage warehouses the best ROI lane", () => {
	const report = createRebalanceScenarioValidationReport();
	const starterGarage = report.scenarios.find(({ scenario }) => scenario.id === "starter-garage-mixed");
	const storageWarehouse = report.scenarios.find(({ scenario }) => scenario.id === "warehouse-storage-heavy");
	const oltpGarage = report.scenarios.find(({ scenario }) => scenario.id === "garage-oltp-edge");

	assert.ok(starterGarage, "expected starter garage scenario");
	assert.ok(storageWarehouse, "expected storage warehouse scenario");
	assert.ok(oltpGarage, "expected OLTP garage scenario");

	assert.ok(starterGarage.rebalanced.cashAfterOneIdleMonth > starterGarage.legacy.cashAfterOneIdleMonth);
	assert.ok(starterGarage.rebalanced.paybackMonths! < starterGarage.legacy.paybackMonths!);

	assert.ok(oltpGarage.rebalanced.activeMargin - oltpGarage.legacy.activeMargin > 4_000);
	assert.ok(oltpGarage.rebalanced.paybackMonths! < oltpGarage.legacy.paybackMonths!);

	assert.ok(storageWarehouse.rebalanced.cashAfterOneIdleMonth > storageWarehouse.legacy.cashAfterOneIdleMonth);
	assert.ok(storageWarehouse.rebalanced.paybackMonths! > storageWarehouse.legacy.paybackMonths!);
	assert.ok(storageWarehouse.rebalanced.paybackMonths! > oltpGarage.rebalanced.paybackMonths!);
	assert.ok(storageWarehouse.rebalanced.activeMargin < oltpGarage.rebalanced.activeMargin * 2.2);
});
