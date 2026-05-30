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
					activeMargin: 24_350.76,
					paybackMonths: 18.275,
					cashAfterOneIdleMonth: 3_544_068.91,
				},
				rebalanced: {
					totalCapex: 427_000,
					activeMargin: 26_190.76,
					paybackMonths: 16.303,
					cashAfterOneIdleMonth: 3_559_708.91,
				},
			},
			{
				id: "warehouse-storage-heavy",
				legacy: {
					totalCapex: 2_040_000,
					activeMargin: 146_185.04,
					paybackMonths: 13.955,
					cashAfterOneIdleMonth: 1_910_990.43,
				},
				rebalanced: {
					totalCapex: 1_896_000,
					activeMargin: 124_905.04,
					paybackMonths: 15.18,
					cashAfterOneIdleMonth: 2_036_110.43,
				},
			},
			{
				id: "garage-oltp-edge",
				legacy: {
					totalCapex: 480_000,
					activeMargin: 32_052.04,
					paybackMonths: 14.976,
					cashAfterOneIdleMonth: 3_505_002.79,
				},
				rebalanced: {
					totalCapex: 480_000,
					activeMargin: 39_752.04,
					paybackMonths: 12.075,
					cashAfterOneIdleMonth: 3_505_002.79,
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
			{ id: "starter-garage-us-east", hard: { activeMargin: 39_249.39, paybackMonths: 12.229, cashAfterBuild: 3_520_000, idleRunwayMonths: 228.825 }, easy: { cashAfterBuild: 7_520_000, idleRunwayMonths: 488.853 } },
			{ id: "starter-garage-us-west", hard: { activeMargin: 39_752.04, paybackMonths: 12.075, cashAfterBuild: 3_520_000, idleRunwayMonths: 234.71 }, easy: { cashAfterBuild: 7_520_000, idleRunwayMonths: 501.427 } },
			{ id: "starter-garage-eu-west", hard: { activeMargin: 39_011.12, paybackMonths: 12.304, cashAfterBuild: 3_520_000, idleRunwayMonths: 234.095 }, easy: { cashAfterBuild: 7_520_000, idleRunwayMonths: 500.112 } },
			{ id: "starter-garage-ap-southeast", hard: { activeMargin: 39_661.12, paybackMonths: 12.103, cashAfterBuild: 3_520_000, idleRunwayMonths: 244.672 }, easy: { cashAfterBuild: 7_520_000, idleRunwayMonths: 522.708 } },
			{ id: "starter-garage-sa-east", hard: { activeMargin: 43_030.26, paybackMonths: 11.155, cashAfterBuild: 3_520_000, idleRunwayMonths: 311.235 }, easy: { cashAfterBuild: 7_520_000, idleRunwayMonths: 664.911 } },
			{ id: "starter-garage-me-central", hard: { activeMargin: 41_435.56, paybackMonths: 11.584, cashAfterBuild: 3_520_000, idleRunwayMonths: 267.919 }, easy: { cashAfterBuild: 7_520_000, idleRunwayMonths: 572.372 } },
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
