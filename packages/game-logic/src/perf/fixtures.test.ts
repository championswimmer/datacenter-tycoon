import assert from "node:assert/strict";
import test from "node:test";

import { contractsFromState, isLiveContract } from "../contracts/lifecycle.js";
import {
	PERFORMANCE_FIXTURE_PROFILES,
	createCustomPerformanceFixture,
	createPerformanceFixture,
	summarizePerformanceFixture,
} from "./fixtures.js";

test("performance fixtures are deterministic for the same seed and profile", () => {
	const first = createPerformanceFixture("medium", { seed: 20260518 });
	const second = createPerformanceFixture("medium", { seed: 20260518 });

	assert.deepEqual(first, second);
});

test("performance fixtures scale from small to medium to stress profiles", () => {
	const small = createPerformanceFixture("small", { seed: 101 });
	const medium = createPerformanceFixture("medium", { seed: 101 });
	const stress = createPerformanceFixture("stress", { seed: 101 });

	const smallSummary = summarizePerformanceFixture(small);
	const mediumSummary = summarizePerformanceFixture(medium);
	const stressSummary = summarizePerformanceFixture(stress);

	assert.equal(smallSummary.regionCount, PERFORMANCE_FIXTURE_PROFILES.small.regionCount);
	assert.equal(mediumSummary.regionCount, PERFORMANCE_FIXTURE_PROFILES.medium.regionCount);
	assert.equal(stressSummary.regionCount, PERFORMANCE_FIXTURE_PROFILES.stress.regionCount);
	assert.ok(smallSummary.datacenterCount < mediumSummary.datacenterCount);
	assert.ok(mediumSummary.datacenterCount < stressSummary.datacenterCount);
	assert.ok(smallSummary.rackCount < mediumSummary.rackCount);
	assert.ok(mediumSummary.rackCount < stressSummary.rackCount);
	assert.ok(smallSummary.contractCount < mediumSummary.contractCount);
	assert.ok(mediumSummary.contractCount < stressSummary.contractCount);
});

test("performance fixture targets point at valid reducer and query entities", () => {
	const fixture = createPerformanceFixture("small", { seed: 77 });
	const { state, targets } = fixture;
	const contracts = contractsFromState(state);
	const primaryDatacenter = state.datacenters.find((datacenter) => datacenter.id === targets.primaryDatacenterId);
	const secondaryDatacenter = state.datacenters.find((datacenter) => datacenter.id === targets.secondaryDatacenterId);
	const openContract = contracts.find((contract) => contract.id === targets.openContractId);
	const liveContract = contracts.find((contract) => contract.id === targets.liveContractId);

	assert.ok(primaryDatacenter);
	assert.ok(secondaryDatacenter);
	assert.ok(openContract);
	assert.ok(liveContract);
	assert.equal(openContract?.lifecycleState, "market_open");
	assert.equal(isLiveContract(liveContract ?? { lifecycleState: "completed" }), true);
	assert.ok(primaryDatacenter?.placements.some((placement) => placement.id === targets.removeRack.placementId));
	assert.ok(primaryDatacenter?.placements.some((placement) => placement.id === targets.moveRack.placementId));
	assert.notEqual(targets.moveRack.dcId, targets.moveRack.targetDcId);
	assert.ok(
		!primaryDatacenter?.placements.some(
			(placement) => placement.row === targets.placeRack.row && placement.position === targets.placeRack.position,
		),
	);
	if (targets.fabricLink) {
		const region = state.map.regions.find((candidate) =>
			candidate.fabric?.memberDcIds.includes(targets.fabricLink!.sourceDcId),
		);
		assert.ok(region);
	}
});

test("custom performance fixtures support deterministic profile overrides", () => {
	const custom = createCustomPerformanceFixture(
		{
			regionCount: 3,
			datacentersPerRegion: 4,
			racksPerDatacenter: 10,
			liveContractsPerDatacenter: 3,
			marketContractsPerRegion: 5,
			fabricGroupSize: 2,
			currentTick: 12,
			currentSubtick: 6,
			repairingRackFrequency: 8,
			committedCapacityRatio: 0.35,
		},
		{ seed: 555 },
	);
	const summary = summarizePerformanceFixture(custom);

	assert.equal(summary.regionCount, 3);
	assert.equal(summary.datacenterCount, 12);
	assert.equal(custom.state.subtick, 6);
	assert.ok(summary.marketContractCount > 0);
	assert.ok(summary.liveContractCount > 0);
});
