import assert from "node:assert/strict";
import test from "node:test";

import { createEarlyGameRunwayValidationReport, createRebalanceScenarioValidationReport } from "./scenario-validation.js";

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
					activeMargin: 6_132.93,
					paybackMonths: 72.559,
					cashAfterOneIdleMonth: 3_541_793.91,
				},
				rebalanced: {
					totalCapex: 427_000,
					activeMargin: 6_272.93,
					paybackMonths: 68.07,
					cashAfterOneIdleMonth: 3_557_433.91,
				},
			},
			{
				id: "warehouse-storage-heavy",
				legacy: {
					totalCapex: 2_040_000,
					activeMargin: 51_721.73,
					paybackMonths: 39.442,
					cashAfterOneIdleMonth: 1_901_890.43,
				},
				rebalanced: {
					totalCapex: 1_896_000,
					activeMargin: 31_441.73,
					paybackMonths: 60.302,
					cashAfterOneIdleMonth: 2_027_010.43,
				},
			},
			{
				id: "garage-oltp-edge",
				legacy: {
					totalCapex: 480_000,
					activeMargin: 5_221.74,
					paybackMonths: 91.923,
					cashAfterOneIdleMonth: 3_498_827.79,
				},
				rebalanced: {
					totalCapex: 480_000,
					activeMargin: 9_621.74,
					paybackMonths: 49.887,
					cashAfterOneIdleMonth: 3_498_827.79,
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
	assert.ok(storageWarehouse.rebalanced.activeMargin < oltpGarage.rebalanced.activeMargin * 3.5);
});

test("early-game runway validation keeps hard mode survivable while easy mode preserves a larger safety buffer", () => {
	const report = createEarlyGameRunwayValidationReport();

	assert.deepEqual(
		report.scenarios.map(({ scenario, hard, easy }) => ({
			id: scenario.id,
			hard: {
				activeMargin: hard.activeMargin,
				paybackMonths: hard.paybackMonths,
				cashAfterBuild: hard.cashAfterBuild,
				idleRunwayMonths: hard.idleRunwayMonths,
			},
			easy: {
				cashAfterBuild: easy.cashAfterBuild,
				idleRunwayMonths: easy.idleRunwayMonths,
			},
		})),
		[
			{ id: "starter-garage-us-east", hard: { activeMargin: 8_675.65, paybackMonths: 55.327, cashAfterBuild: 3_520_000, idleRunwayMonths: 160.856 }, easy: { cashAfterBuild: 7_520_000, idleRunwayMonths: 343.647 } },
			{ id: "starter-garage-us-west", hard: { activeMargin: 9_621.74, paybackMonths: 49.887, cashAfterBuild: 3_520_000, idleRunwayMonths: 166.256 }, easy: { cashAfterBuild: 7_520_000, idleRunwayMonths: 355.183 } },
			{ id: "starter-garage-eu-west", hard: { activeMargin: 8_495.21, paybackMonths: 56.502, cashAfterBuild: 3_520_000, idleRunwayMonths: 168.529 }, easy: { cashAfterBuild: 7_520_000, idleRunwayMonths: 360.039 } },
			{ id: "starter-garage-ap-southeast", hard: { activeMargin: 9_795.21, paybackMonths: 49.004, cashAfterBuild: 3_520_000, idleRunwayMonths: 179.715 }, easy: { cashAfterBuild: 7_520_000, idleRunwayMonths: 383.936 } },
			{ id: "starter-garage-sa-east", hard: { activeMargin: 16_385.43, paybackMonths: 29.294, cashAfterBuild: 3_520_000, idleRunwayMonths: 259.114 }, easy: { cashAfterBuild: 7_520_000, idleRunwayMonths: 553.561 } },
			{ id: "starter-garage-me-central", hard: { activeMargin: 13_077.6, paybackMonths: 36.704, cashAfterBuild: 3_520_000, idleRunwayMonths: 202.726 }, easy: { cashAfterBuild: 7_520_000, idleRunwayMonths: 433.097 } },
		],
	);

	for (const { hard, easy } of report.scenarios) {
		assert.ok(hard.activeMargin > 0, `${hard.difficulty} build should be profitable for ${hard.startingCash}`);
		assert.ok(hard.idleRunwayMonths > 120, `hard mode should keep at least 10 years of idle runway for ${hard.difficulty}`);
		assert.ok(easy.cashAfterBuild > hard.cashAfterBuild);
		assert.ok(easy.idleRunwayMonths > hard.idleRunwayMonths * 2);
	}

	const byId = Object.fromEntries(report.scenarios.map((entry) => [entry.scenario.id, entry]));
	assert.ok(byId["starter-garage-eu-west"].hard.activeMargin < byId["starter-garage-us-west"].hard.activeMargin);
	assert.ok(byId["starter-garage-ap-southeast"].hard.activeMargin < byId["starter-garage-sa-east"].hard.activeMargin);
	assert.ok(byId["starter-garage-sa-east"].hard.paybackMonths! < byId["starter-garage-us-east"].hard.paybackMonths!);

	const hardMargins = report.scenarios.map(({ hard }) => hard.activeMargin);
	const hardPaybacks = report.scenarios.map(({ hard }) => hard.paybackMonths ?? Number.POSITIVE_INFINITY);
	assert.ok(Math.max(...hardMargins) / Math.min(...hardMargins) < 2, "no region should dominate purely on active margin");
	assert.ok(Math.max(...hardPaybacks) < 60, "worst hard-mode payback should stay below five years");
});
